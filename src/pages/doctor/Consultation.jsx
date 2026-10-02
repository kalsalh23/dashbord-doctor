import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight, Stethoscope, Pill, Plus, Trash2, CheckCircle2, AlertTriangle,
  ChevronDown, FolderOpen, Send, HeartPulse,
} from 'lucide-react'
import { useApp, audit, notify } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Textarea, Spinner, EmptyState, Tag } from '../../components/ui'
import DentalChart from '../../components/DentalChart'
import { useSchedules, friendlyDbError } from '../../lib/hooks'
import { addDays, getWeekday, ageFrom, formatDateShort, todayStr } from '../../lib/format'

const EMPTY_FORM = {
  chief_complaint: '',
  symptoms: '',
  physical_examination: '',
  diagnosis: '',
  treatment_plan: '',
  medical_notes: '',
}
const EMPTY_MED = { name: '', dosage: '', duration: '', instructions: '' }
const FOLLOW_UP_OPTIONS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 30]

export default function Consultation() {
  const { appointmentId, patientId } = useParams()
  const { profile, settings, toast, effectiveRole } = useApp()
  const [schedules] = useSchedules()
  const nav = useNavigate()

  const [patient, setPatient] = useState(null)
  const [appointment, setAppointment] = useState(null)
  const [medInfo, setMedInfo] = useState(null)
  const [latestVisit, setLatestVisit] = useState(null)
  const [loading, setLoading] = useState(true)

  const [started, setStarted] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [meds, setMeds] = useState([{ ...EMPTY_MED }])
  const [saving, setSaving] = useState(false)

  const [stage, setStage] = useState('consult') // consult | followup | done
  const [needsFollowUp, setNeedsFollowUp] = useState(null)
  const [followDays, setFollowDays] = useState(null)
  const [sendingFu, setSendingFu] = useState(false)
  const [favorites, setFavorites] = useState([])
  const [dentalEntries, setDentalEntries] = useState([])

  // the doctor's own specialty (set on his account) drives his tools;
  // falls back to the clinic's specialty for admins viewing doctor mode
  const specialtyKey = profile?.specialty_key || profile?.clinic?.specialty_key || 'general'
  const isDental = specialtyKey === 'dentistry'

  const load = useCallback(async () => {
    setLoading(true)
    let appt = null
    let pat = null
    if (appointmentId) {
      const { data } = await supabase
        .from('appointments')
        .select('id, appointment_date, start_time, status, patient:patients(*)')
        .eq('id', appointmentId)
        .maybeSingle()
      appt = data
      pat = data?.patient
    } else if (patientId) {
      const { data } = await supabase.from('patients').select('*').eq('id', patientId).maybeSingle()
      pat = data
    }
    setAppointment(appt)
    setPatient(pat)
    if (pat) {
      const [miRes, vRes] = await Promise.all([
        supabase.from('medical_information').select('*').eq('patient_id', pat.id).maybeSingle(),
        supabase
          .from('visits')
          .select('*, medications(*), doctor:profiles(full_name)')
          .eq('patient_id', pat.id)
          .order('visit_date', { ascending: false })
          .limit(1),
      ])
      setMedInfo(miRes.data || null)
      setLatestVisit(vRes.data?.[0] || null)
    }
    if (appt && appt.status === 'in_consultation') setStarted(true)
    setLoading(false)
  }, [appointmentId, patientId])

  useEffect(() => {
    load()
  }, [load])

  // doctor's frequently prescribed medications for one-tap entry
  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('doctor_favorite_medications')
      .select('id, name, dosage, duration, instructions')
      .eq('doctor_id', profile.id)
      .order('created_at')
      .then(({ data }) => setFavorites(data || []))
  }, [profile?.id])

  const addFavorite = (f) => {
    setMeds((ms) => {
      // replace a completely empty default row if present
      const emptyIdx = ms.findIndex((m) => !m.name.trim())
      const row = { name: f.name, dosage: f.dosage || '', duration: f.duration || '', instructions: f.instructions || '' }
      if (emptyIdx >= 0) return ms.map((m, i) => (i === emptyIdx ? row : m))
      return [...ms, row]
    })
  }

  const startConsultation = async () => {
    if (!appointment) return setStarted(true)
    const { error } = await supabase.from('appointments').update({ status: 'in_consultation' }).eq('id', appointment.id)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'start_consultation', 'appointments', appointment.id)
    setAppointment({ ...appointment, status: 'in_consultation' })
    setStarted(true)
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setMed = (i, k) => (e) => setMeds((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: e.target.value } : m)))

  const valid = form.chief_complaint.trim() && form.diagnosis.trim()

  const finish = async () => {
    if (!valid) {
      return toast('error', 'الشكوى الرئيسية والتشخيص مطلوبان')
    }
    setSaving(true)
    const visitPayload = {
      clinic_id: profile.clinic_id,
      patient_id: patient.id,
      appointment_id: appointment?.id || null,
      doctor_id: profile.id,
      visit_date: todayStr(),
      chief_complaint: form.chief_complaint.trim(),
      symptoms: form.symptoms.trim() || null,
      physical_examination: form.physical_examination.trim() || null,
      diagnosis: form.diagnosis.trim(),
      treatment_plan: form.treatment_plan.trim() || null,
      medical_notes: form.medical_notes.trim() || null,
    }
    const { data: visit, error: vErr } = await supabase.from('visits').insert(visitPayload).select().single()
    if (vErr) {
      setSaving(false)
      return toast('error', friendlyDbError(vErr))
    }
    const realMeds = meds.filter((m) => m.name.trim())
    if (realMeds.length) {
      const { error: mErr } = await supabase.from('medications').insert(
        realMeds.map((m) => ({
          clinic_id: profile.clinic_id,
          visit_id: visit.id,
          patient_id: patient.id,
          name: m.name.trim(),
          dosage: m.dosage.trim() || null,
          duration: m.duration.trim() || null,
          instructions: m.instructions.trim() || null,
        }))
      )
      if (mErr) {
        setSaving(false)
        return toast('error', 'تم حفظ الزيارة لكن تعذر حفظ الأدوية: ' + mErr.message)
      }
    }
    if (isDental && dentalEntries.length > 0) {
      const { error: dErr } = await supabase.from('dental_chart_entries').insert(
        dentalEntries.map((e) => ({
          clinic_id: profile.clinic_id,
          patient_id: patient.id,
          visit_id: visit.id,
          tooth_no: e.tooth_no,
          procedure: e.procedure,
          notes: e.notes || null,
          created_by: profile.id,
        }))
      )
      if (dErr) {
        setSaving(false)
        return toast('error', 'تم حفظ الزيارة لكن تعذر حفظ مخطط الأسنان: ' + dErr.message)
      }
    }
    if (appointment) {
      const { error: aErr } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', appointment.id)
      if (aErr) {
        setSaving(false)
        return toast('error', friendlyDbError(aErr))
      }
    }
    audit(profile.clinic_id, 'complete_visit', 'visits', visit.id)
    setSaving(false)
    toast('success', 'تم حفظ الزيارة بنجاح')
    setStage('followup')
  }

  // next working day on/after a given date
  const nextWorkingDay = useMemo(() => {
    return (dateStr) => {
      let d = dateStr
      for (let i = 0; i < 21; i++) {
        const probe = addDays(d, i)
        const sched = schedules.find((s) => s.weekday === getWeekday(probe) && s.is_active)
        if (sched) return probe
      }
      return d
    }
  }, [schedules])

  const sendFollowUp = async () => {
    if (!followDays) return
    setSendingFu(true)
    const suggested = nextWorkingDay(addDays(todayStr(), followDays))
    const { error } = await supabase
      .from('follow_up_requests')
      .insert({
        clinic_id: profile.clinic_id,
        patient_id: patient.id,
        doctor_id: profile.id,
        visit_id: null,
        interval_days: followDays,
        suggested_date: suggested,
        status: 'pending',
      })
    setSendingFu(false)
    if (error) return toast('error', friendlyDbError(error))
    notify(
      profile.clinic_id,
      'reception',
      'طلب متابعة جديد',
      `${patient.full_name} — مراجعة بعد ${followDays} يوم (المقترح ${suggested})`,
      'follow_up',
      '/reception/follow-ups',
      profile.id
    )
    audit(profile.clinic_id, 'send_follow_up_request', 'patients', patient.id, { days: followDays })
    toast('success', 'تم إرسال طلب المتابعة إلى الاستقبال')
    setStage('done')
  }

  if (loading) return <Spinner />
  if (!patient)
    return (
      <EmptyState
        icon={FolderOpen}
        title="لم يتم العثور على المريض"
        action={<Button onClick={() => nav('/doctor')}>رجوع لقائمة الانتظار</Button>}
      />
    )

  const needsStart = appointment && ['arrived', 'waiting'].includes(appointment.status) && !started

  /* ---------- stage: follow-up ---------- */
  if (stage === 'followup' || stage === 'done') {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={30} />
          </span>
          <h1 className="text-lg font-bold text-slate-800">تم إنهاء كشف {patient.full_name}</h1>
          <p className="mt-1 text-xs text-slate-500">حُفظت الزيارة في السجل الطبي وأصبح الموعد مكتملًا</p>
        </div>

        {stage === 'followup' ? (
          <Card title="هل يحتاج المريض موعد مراجعة؟">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={needsFollowUp === false ? 'primary' : 'secondary'}
                size="lg"
                onClick={() => {
                  setNeedsFollowUp(false)
                  setStage('done')
                }}
              >
                لا يحتاج متابعة
              </Button>
              <Button
                variant={needsFollowUp === true ? 'primary' : 'secondary'}
                size="lg"
                onClick={() => setNeedsFollowUp(true)}
              >
                يحتاج متابعة
              </Button>
            </div>

            {needsFollowUp === true && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="label-base">بعد كم يوم تفضل المراجعة؟</p>
                <div className="flex flex-wrap gap-2">
                  {FOLLOW_UP_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setFollowDays(d)}
                      className={`h-11 min-w-14 rounded-xl border px-3 text-sm font-bold transition-colors ${
                        followDays === d
                          ? 'border-primary-700 bg-primary-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-primary-400'
                      }`}
                    >
                      {d} يوم
                    </button>
                  ))}
                </div>
                {followDays && (
                  <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
                    <p className="text-xs text-slate-500">تاريخ المراجعة المقترح</p>
                    <p className="text-sm font-bold text-primary-800">{formatDateShort(nextWorkingDay(addDays(todayStr(), followDays)))}</p>
                    <p className="mt-1 text-[10px] text-slate-400">يُحسب تلقائيًا حسب أيام عمل العيادة</p>
                  </div>
                )}
                <div className="mt-4">
                  <Button size="lg" className="w-full" disabled={!followDays} loading={sendingFu} onClick={sendFollowUp}>
                    <Send size={16} />
                    إرسال طلب المتابعة إلى الاستقبال
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <div className="flex justify-center gap-2">
            <Button size="lg" onClick={() => nav('/doctor')}>
              العودة إلى قائمة الانتظار
            </Button>
            <Button size="lg" variant="secondary" onClick={() => nav(`/doctor/patients/${patient.id}`)}>
              فتح ملف المريض
            </Button>
          </div>
        )}
      </div>
    )
  }

  /* ---------- stage: consultation ---------- */
  const allergies = medInfo?.allergies?.trim()

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <button onClick={() => nav('/doctor')} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
        <ArrowRight size={14} />
        رجوع لقائمة الانتظار
      </button>

      {/* patient header */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{patient.full_name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {patient.date_of_birth ? `${ageFrom(patient.date_of_birth)} سنة · ` : ''}
              <span dir="ltr">{patient.phone}</span>
              {appointment ? ` · موعد اليوم ${appointment.start_time?.slice(0, 5)}` : ' · كشف بدون موعد مسبق'}
            </p>
          </div>
          <Link to={`/doctor/patients/${patient.id}`}>
            <Button size="sm" variant="secondary">
              <FolderOpen size={14} />
              الملف الكامل
            </Button>
          </Link>
        </div>

        {allergies && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" />
            <p className="text-xs leading-relaxed text-rose-800">
              <b>تنبيه حساسية:</b> {allergies}
            </p>
          </div>
        )}

        {/* medical summary */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { label: 'أمراض مزمنة', value: medInfo?.chronic_diseases },
            { label: 'أدوية حالية', value: medInfo?.current_medications },
            { label: 'عمليات سابقة', value: medInfo?.previous_surgeries },
            { label: 'ملاحظات طبية مهمة', value: medInfo?.important_notes },
          ]
            .filter((c) => c.value?.trim())
            .map((c) => (
              <div key={c.label} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                  <HeartPulse size={11} />
                  {c.label}
                </p>
                <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-700">{c.value}</p>
              </div>
            ))}
        </div>

        {latestVisit && (
          <details className="mt-3 rounded-lg border border-slate-100">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-600">
              آخر زيارة — {formatDateShort(latestVisit.visit_date)} ({latestVisit.diagnosis || latestVisit.chief_complaint || ''})
              <ChevronDown size={14} className="text-slate-400" />
            </summary>
            <div className="space-y-2 border-t border-slate-100 px-3 py-3 text-xs leading-relaxed text-slate-600">
              {latestVisit.chief_complaint && <p><b className="text-slate-400">الشكوى:</b> {latestVisit.chief_complaint}</p>}
              {latestVisit.treatment_plan && <p><b className="text-slate-400">العلاج:</b> {latestVisit.treatment_plan}</p>}
              {(latestVisit.medications || []).map((m) => (
                <p key={m.id}><b className="text-slate-400">دواء:</b> {m.name} {m.dosage || ''} {m.duration || ''}</p>
              ))}
            </div>
          </details>
        )}
      </Card>

      {needsStart ? (
        <Card>
          <div className="flex flex-col items-center py-6 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-700">
              <Stethoscope size={26} />
            </span>
            <h2 className="text-base font-bold text-slate-800">جاهز لبدء الكشف؟</h2>
            <p className="mb-4 mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              سيتم نقل حالة الموعد إلى «قيد الكشف» وفتح نموذج التسجيل الطبي
            </p>
            <Button size="lg" onClick={startConsultation}>
              <Stethoscope size={17} />
              بدء الكشف
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card title="بيانات الكشف">
            <div className="space-y-4">
              <Field label="الشكوى الرئيسية" required>
                <Textarea value={form.chief_complaint} onChange={setF('chief_complaint')} rows={2} placeholder="سبب الزيارة الرئيسي..." autoFocus />
              </Field>
              <Field label="الأعراض">
                <Textarea value={form.symptoms} onChange={setF('symptoms')} rows={2} />
              </Field>
              <Field label="الفحص السريري">
                <Textarea value={form.physical_examination} onChange={setF('physical_examination')} rows={2} />
              </Field>
              <Field label="التشخيص" required>
                <Textarea value={form.diagnosis} onChange={setF('diagnosis')} rows={2} />
              </Field>
              <Field label="خطة العلاج">
                <Textarea value={form.treatment_plan} onChange={setF('treatment_plan')} rows={2} />
              </Field>
            </div>
          </Card>

          {isDental && (
            <Card title="مخطط الأسنان" subtitle="اضغط على السن لتحديد الإجراء — الألوان: برتقالي عولج سابقاً، أخضر زيارة اليوم">
              <DentalChart
                patientId={patient.id}
                entries={dentalEntries}
                onEntriesChange={setDentalEntries}
              />
            </Card>
          )}

          <Card
            title="الأدوية الموصوفة"
            actions={
              <Button size="sm" variant="secondary" onClick={() => setMeds((m) => [...m, { ...EMPTY_MED }])}>
                <Plus size={14} />
                إضافة دواء
              </Button>
            }
          >
            {favorites.length > 0 && (
              <div className="mb-4 border-b border-slate-100 pb-4">
                <p className="mb-2 text-[11px] font-bold text-slate-400">أدويتك الشائعة — اضغط للإدراج السريع</p>
                <div className="flex flex-wrap gap-1.5">
                  {favorites.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addFavorite(f)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-100"
                      title={[f.dosage, f.duration, f.instructions].filter(Boolean).join(' · ')}
                    >
                      <Pill size={12} />
                      {f.name}
                      {f.dosage ? ` · ${f.dosage}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {meds.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-400">لا توجد أدوية — أضف دواءً إذا لزم</p>
            ) : (
              <ul className="space-y-3">
                {meds.map((m, i) => (
                  <li key={i} className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 p-3 sm:grid-cols-5">
                    <div className="col-span-2 sm:col-span-1">
                      <Field label="اسم الدواء">
                        <Input value={m.name} onChange={setMed(i, 'name')} placeholder="باراسيتامول" />
                      </Field>
                    </div>
                    <Field label="الجرعة">
                      <Input value={m.dosage} onChange={setMed(i, 'dosage')} placeholder="500 ملغ" />
                    </Field>
                    <Field label="المدة">
                      <Input value={m.duration} onChange={setMed(i, 'duration')} placeholder="5 أيام" />
                    </Field>
                    <div className="col-span-2 sm:col-span-1">
                      <Field label="التعليمات">
                        <Input value={m.instructions} onChange={setMed(i, 'instructions')} placeholder="قرص كل 8 ساعات" />
                      </Field>
                    </div>
                    <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                      <Button size="sm" variant="ghost" onClick={() => setMeds((ms) => ms.filter((_, j) => j !== i))} title="حذف">
                        <Trash2 size={14} className="text-rose-500" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="ملاحظات طبية إضافية">
            <Textarea value={form.medical_notes} onChange={setF('medical_notes')} rows={2} />
          </Card>
        </div>
      )}

      {/* sticky finish bar */}
      {!needsStart && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:ms-60">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              {valid ? 'جاهز للحفظ' : 'الشكوى الرئيسية والتشخيص مطلوبان'}
            </p>
            <Button size="lg" onClick={finish} loading={saving} disabled={!valid}>
              <CheckCircle2 size={17} />
              إنهاء الكشف
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
