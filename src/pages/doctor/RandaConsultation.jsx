import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight, Stethoscope, Pill, Plus, Trash2, CheckCircle2, AlertTriangle,
  ChevronDown, FolderOpen, HeartPulse, Search, X, Wallet, Activity,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Textarea, Spinner, EmptyState, Modal, Tag } from '../../components/ui'
import { specialtyByKey } from '../../lib/specialties'
import PrescriptionStage from './PrescriptionStage'
import { ageFrom, formatDateShort, todayStr } from '../../lib/format'
import { fmtPrice } from '../../lib/dental'
import { glucoseLabel, hba1cLabel, bmiOf, bmiLabel, bpLabel, endocrineAlerts, endocrineRiskLevel, ENDOCRINE_DEFAULT_CATALOG } from '../../lib/endocrine'

const EMPTY_FORM = {
  chief_complaint: '',
  symptoms: '',
  physical_examination: '',
  diagnosis: '',
  treatment_plan: '',
  medical_notes: '',
}
const EMPTY_MED = { name: '', dosage: '', duration: '', instructions: '' }

export default function RandaConsultation() {
  const { appointmentId, patientId } = useParams()
  const { profile, settings, toast, effectiveRole } = useApp()
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

  const [stage, setStage] = useState('consult')
  const [favorites, setFavorites] = useState([])
  const [medSearch, setMedSearch] = useState('')
  const [medSearchOpen, setMedSearchOpen] = useState(false)
  const [rxSearch, setRxSearch] = useState('')
  const [savedVisit, setSavedVisit] = useState(null)
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')

  // بيانات الغدد والسكري الخاصة
  const [specData, setSpecData] = useState({
    blood_glucose: '', hba1c: '', blood_pressure: '', weight: '', height: '', bmi: '',
    thyroid: '', kidney: '', lipid: '', foot_exam: '', vision: '', notes: '',
  })

  const normMed = (s) =>
    (s || '')
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u0652\u0640]/g, '')
      .trim()

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
      if (vRes.data?.[0]?.specialty_data?.endocrine) {
        setSpecData(vRes.data[0].specialty_data.endocrine)
      }
    }
    if (appt && appt.status === 'in_consultation') setStarted(true)
    setLoading(false)
  }, [appointmentId, patientId])

  useEffect(() => {
    load()
  }, [load])

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
      const emptyIdx = ms.findIndex((m) => !m.name.trim())
      const row = { name: f.name, dosage: f.dosage || '', duration: f.duration || '', instructions: f.instructions || '' }
      if (emptyIdx >= 0) return ms.map((m, i) => (i === emptyIdx ? row : m))
      return [...ms, row]
    })
  }

  const filteredFavorites = useMemo(() => {
    const q = normMed(medSearch)
    if (!q) return favorites
    return favorites.filter((f) => normMed(f.name).includes(q))
  }, [favorites, medSearch])
  const medsMany = favorites.length > 18
  const shownMeds = medsMany && !medSearch && !medSearchOpen ? filteredFavorites.slice(0, 18) : filteredFavorites

  const shownRx = useMemo(() => {
    const q = normMed(rxSearch)
    if (!q) return meds.map((m, i) => ({ m, i }))
    return meds.map((m, i) => ({ m, i })).filter(({ m }) => normMed(m.name).includes(q) || normMed(m.dosage).includes(q) || normMed(m.instructions).includes(q))
  }, [meds, rxSearch])

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
  const setSpec = (k) => (e) => setSpecData((d) => ({ ...d, [k]: e.target.value }))

  const valid = form.diagnosis.trim()

  const finish = () => {
    if (!valid) {
      return toast('error', 'التشخيص مطلوب')
    }
    doSave(null)
  }

  const doSave = async (paid) => {
    if (!valid) {
      return toast('error', 'التشخيص مطلوب')
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
      specialty_data: { endocrine: specData },
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
    setSavedVisit({ ...visit, patient, medications: realMeds, doctor: { full_name: profile.full_name } })
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

  if (stage === 'done') {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={30} />
          </span>
          <h1 className="text-lg font-bold text-slate-800">تم إنهاء كشف {patient.full_name}</h1>
          <p className="mt-1 text-xs text-slate-500">حُفظت الزيارة في السجل الطبي وأصبح الموعد مكتملًا</p>
        </div>
        <div className="flex justify-center gap-2">
          <Button size="lg" onClick={() => nav('/doctor')}>
            العودة إلى لوحة اليوم
          </Button>
          <Button size="lg" variant="secondary" onClick={() => nav(`/doctor/patients/${patient.id}`)}>
            فتح ملف المريض
          </Button>
        </div>
      </div>
    )
  }

  const allergies = medInfo?.allergies?.trim()
  const lastGlucose = latestVisit?.specialty_data?.endocrine?.blood_glucose
  const lastHbA1c = latestVisit?.specialty_data?.endocrine?.hba1c

  const needsStart = appointment && ['arrived', 'waiting'].includes(appointment.status) && !started

  return (
    <div className="mx-auto max-w-3xl pb-24 sm:max-w-4xl">
      <button onClick={() => nav('/doctor')} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
        <ArrowRight size={14} />
        رجوع للوحة اليوم
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
              سيتم نقل حالة الموعد إلى «قيد الكشف» وفتح نموذج التسجيل الطبي للغدد والسكري
            </p>
            <Button size="lg" onClick={startConsultation}>
              <Stethoscope size={17} />
              بدء الكشف
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card title="بيانات الغدد والسكري">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="سكر الدم (مجم/دل)">
                  <Input dir="ltr" type="number" value={specData.blood_glucose} onChange={setSpec('blood_glucose')} placeholder="90" className="randa-glucose-input" />
                </Field>
                <Field label="السكر التراكمي HbA1c (%)">
                  <Input dir="ltr" type="number" step="0.1" value={specData.hba1c} onChange={setSpec('hba1c')} placeholder="6.5" className="randa-glucose-input" />
                </Field>
                <Field label="الوزن (كغ)">
                  <Input dir="ltr" type="number" step="0.1" value={specData.weight} onChange={setSpec('weight')} placeholder="70" className="randa-glucose-input" />
                </Field>
                <Field label="الطول (سم)">
                  <Input dir="ltr" type="number" step="0.1" value={specData.height} onChange={setSpec('height')} placeholder="170" className="randa-glucose-input" />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="ضغط الدم">
                  <Input value={specData.blood_pressure} onChange={setSpec('blood_pressure')} placeholder="120/80" />
                </Field>
                <Field label="كتلة الجسم BMI">
                  <Input dir="ltr" type="number" step="0.1" value={specData.bmi} onChange={setSpec('bmi')} placeholder="24.1" className="randa-glucose-input" readOnly />
                </Field>
              </div>
              {specData.blood_glucose && (
                <div className="rounded-xl p-3 bg-amber-50 border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-700 mb-1">تقييم السكر</p>
                  <p className="text-xs font-semibold text-amber-800">
                    {glucoseLabel(Number(specData.blood_glucose))?.label || '—'}
                  </p>
                </div>
              )}
              {specData.hba1c && (
                <div className="rounded-xl p-3 bg-amber-50 border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-700 mb-1">تقييم HbA1c</p>
                  <p className="text-xs font-semibold text-amber-800">
                    {hba1cLabel(Number(specData.hba1c))?.label || '—'}
                  </p>
                </div>
              )}
              {specData.blood_pressure && (
                <div className="rounded-xl p-3 bg-amber-50 border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-700 mb-1">تقييم الضغط</p>
                  <p className="text-xs font-semibold text-amber-800">
                    {bpLabel(specData.blood_pressure)?.label || '—'}
                  </p>
                </div>
              )}
              {specData.weight && specData.height && (
                <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-700 mb-1">تقييم BMI</p>
                  <p className="text-xs font-semibold text-emerald-800">
                    {bmiLabel(bmiOf(specData.weight, specData.height))?.label || '—'}
                  </p>
                </div>
              )}
            </div>
            <Field label="فحص الأقدام">
              <Input value={specData.foot_exam} onChange={setSpec('foot_exam')} placeholder="أي تقرحات أو تورم في القدمين؟" />
            </Field>
            <Field label="الرؤية">
              <Input value={specData.vision} onChange={setSpec('vision')} placeholder="أي تدهور في النظر؟" />
            </Field>
            <Field label="وظيفة الغدة الدرقية">
              <Input value={specData.thyroid} onChange={setSpec('thyroid')} placeholder="نتائج تحليل الغدة" />
            </Field>
            <Field label="وظيفة الكلى (كرياتينين/BUN)">
              <Input value={specData.kidney} onChange={setSpec('kidney')} placeholder="نتائج تحليل الكلى" />
            </Field>
            <Field label="الدهون (كوليسترول/تريجلاسريد)">
              <Input value={specData.lipid} onChange={setSpec('lipid')} placeholder="نتائج ملف الدهون" />
            </Field>
            <Field label="ملاحظات إضافية">
              <Textarea value={specData.notes} onChange={setSpec('notes')} rows={2} placeholder="أي ملاحظات حول الحالة" />
            </Field>
          </Card>
          <Card
            title="الأدوية الموصوفة"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setMeds((m) => [...m, { ...EMPTY_MED }])}>
              <Plus size={14} />
              إضافة دواء
            </Button>
          }
        >
            {meds.length > 3 && (
              <div className="relative mb-3">
                <Search size={14} className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-slate-400" />
                <Input
                  value={rxSearch}
                  onChange={(e) => setRxSearch(e.target.value)}
                  placeholder="ابحث في الأدوية الموصوفة…"
                  className="!ps-9 !text-xs"
                />
                {rxSearch && (
                  <button
                    type="button"
                    onClick={() => setRxSearch('')}
                    className="absolute top-1/2 end-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                    aria-label="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            {favorites.length > 0 && (
              <div className="mb-4 border-b border-slate-100 pb-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-400">
                    أدويتك الشائعة — اضغط للإدراج السريع
                    <span className="ms-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{favorites.length}</span>
                  </p>
                  {medsMany && (
                    <div className="relative w-full sm:w-56">
                      <Search size={13} className="pointer-events-none absolute top-1/2 start-2.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={medSearch}
                        onChange={(e) => setMedSearch(e.target.value)}
                        placeholder="ابحث عن دواء…"
                        className="input-base h-8 !py-0 !ps-8 !text-xs"
                      />
                      {medSearch && (
                        <button
                          type="button"
                          onClick={() => setMedSearch('')}
                          className="absolute top-1/2 end-2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                          aria-label="مسح البحث"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {shownMeds.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slate-400">لا يوجد دواء بهذا الاسم في قائمتك</p>
                ) : (
                  <div className="flex max-h-60 flex-wrap content-start gap-1.5 overflow-y-auto">
                    {shownMeds.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => addFavorite(f)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-100"
                        title={[f.dosage, f.duration, f.instructions].filter(Boolean).join(' · ')}
                      >
                        <Pill size={12} />
                        {f.name}
                        {f.dosage ? ` · ${f.dosage}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                {medsMany && !medSearch && !medSearchOpen && (
                  <button
                    type="button"
                    onClick={() => setMedSearchOpen(true)}
                    className="mt-2 text-xs font-bold text-primary-700 hover:underline"
                  >
                    عرض كل {favorites.length} دواءً
                  </button>
                )}
                {medsMany && medSearchOpen && !medSearch && (
                  <button
                    type="button"
                    onClick={() => setMedSearchOpen(false)}
                    className="mt-2 text-xs font-bold text-slate-500 hover:underline"
                  >
                    عرض مختصر
                  </button>
                )}
              </div>
            )}
            {meds.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-400">لا توجد أدوية — أضف دواءً إذا لزم</p>
            ) : (
              <ul className="space-y-3">
                {shownRx.map(({ m, i }) => (
                  <li key={i} className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 p-3 sm:grid-cols-5">
                    <div className="col-span-2 sm:col-span-1">
                      <Field label="اسم الدواء">
                        <Input dir="ltr" value={m.name} onChange={setMed(i, 'name')} placeholder="Metformin" className="text-right" />
                      </Field>
                    </div>
                    <Field label="الجرعة">
                      <Input value={m.dosage} onChange={setMed(i, 'dosage')} placeholder="500 ملغ" />
                    </Field>
                    <Field label="المدة">
                      <Input value={m.duration} onChange={setMed(i, 'duration')} placeholder="شهر" />
                    </Field>
                    <div className="col-span-2 sm:col-span-1">
                      <Field label="التعليمات">
                        <Input value={m.instructions} onChange={setMed(i, 'instructions')} placeholder="قرص كل 12 ساعة مع الطعام" />
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
        </>
      )}

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:ms-60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">{valid ? 'جاهز للحفظ' : 'التشخيص مطلوب'}</p>
          <Button size="lg" onClick={finish} loading={saving} disabled={!valid}>
            <CheckCircle2 size={17} />
            إنهاء الكشف
          </Button>
        </div>
      </div>
    </div>
  )
}
