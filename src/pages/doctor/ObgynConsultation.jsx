import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, Baby, CalendarHeart, CheckCircle2, Droplets, FolderOpen,
  HeartPulse, Pill, Plus, Search, Stethoscope, Trash2, UserPlus,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Modal, Select, Spinner, Textarea } from '../../components/ui'
import ObgynChart from '../../components/ObgynChart'
import { ageFrom, formatDateShort, todayStr } from '../../lib/format'
import { fmtPrice } from '../../lib/dental'
import { friendlyDbError } from '../../lib/hooks'
import {
  addWeeks, bmiLabel, bmiOf, eddFromLmp, gaLabel, gestationalAge, gpaLabel,
  nextFollowupWeeks, obgynAlerts, pregnancyStatus, riskLevel,
} from '../../lib/obgyn'

const EMPTY_OB = {
  // التاريخ الحائضي
  lmp: '',
  cycle_length: '28',
  cycle_duration: '5',
  cycle_regular: 'منتظمة',
  dysmenorrhea: '',
  menorrhagia: '',
  leucorrhea: '',
  contraception: '',
  // التاريخ التوليدي
  gravida: '0',
  para: '0',
  abortions: '0',
  living: '0',
  blood_group: '',
  rh: '',
  // العلامات الحيوية
  bp_systolic: '',
  bp_diastolic: '',
  pulse: '',
  temperature: '',
  weight: '',
  height: '',
  // فحص البطن والرحم
  uterine_height: '',
  abdomen_tenderness: '',
  mass_palpable: '',
  // فحص عنق الرحم
  cervix_dilation: '',
  cervix_effacement: '',
  cervix_station: '',
  cervix_consistency: '',
  cervix_membranes: '',
  cervix_tenderness: '',
  // الجنين
  fetal_heart_rate: '',
  fetal_movement: '',
  presentation: '',
  // السونار والمفحوصات
  ultrasound: '',
  labs: '',
  // عوامل الخطر (مفاتيح)
  gdm: false,
  preeclampsia: false,
  threatened_abortion: false,
  placenta_previa: false,
  pap_due: false,
}

const EMPTY_MED = { name: '', dosage: '', duration: '', instructions: '' }

const STEPS = [
  { key: 'history', label: 'التاريخ' },
  { key: 'exam', label: 'الفحص' },
  { key: 'draw', label: 'الرسومات' },
  { key: 'plan', label: 'التشخيص والمتابعة' },
  { key: 'meds', label: 'الأدوية' },
]

export default function ObgynConsultation() {
  const { appointmentId, patientId } = useParams()
  const { profile, settings, toast } = useApp()
  const nav = useNavigate()

  const [stage, setStage] = useState('pick') // pick | work | done
  const [patient, setPatient] = useState(null)
  const [appointment, setAppointment] = useState(null)
  const [medInfo, setMedInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  const [ob, setOb] = useState(EMPTY_OB)
  const [findings, setFindings] = useState([])
  const [sketch, setSketch] = useState(null)
  const [chartTab, setChartTab] = useState('pelvis')
  const [pregnancies, setPregnancies] = useState([])
  const [complaint, setComplaint] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [plan, setPlan] = useState('')
  const [notes, setNotes] = useState('')
  const [nextVisit, setNextVisit] = useState('')
  const [meds, setMeds] = useState([{ ...EMPTY_MED }])
  const [favorites, setFavorites] = useState([])
  const [pricebook, setPricebook] = useState(null)
  const [paidNow, setPaidNow] = useState('')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  /* ---------- تحميل المريض ---------- */
  const load = useCallback(async () => {
    if (!appointmentId && !patientId) {
      setLoading(false)
      return
    }
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
    } else {
      const { data } = await supabase.from('patients').select('*').eq('id', patientId).maybeSingle()
      pat = data
    }
    setAppointment(appt)
    setPatient(pat)
    if (pat) {
      setStage('work')
      const [mi, lastVisit] = await Promise.all([
        supabase.from('medical_information').select('*').eq('patient_id', pat.id).maybeSingle(),
        supabase
          .from('visits')
          .select('*, specialty_data')
          .eq('patient_id', pat.id)
          .order('visit_date', { ascending: false })
          .limit(1),
      ])
      setMedInfo(mi.data || null)
      const prev = lastVisit.data?.[0]
      // استرجاع بيانات النساء والتوليد من آخر كشف (استمرارية المتابعة)
      if (prev?.specialty_data?.obgyn) {
        const d = prev.specialty_data.obgyn
        setOb((o) => ({ ...o, ...d }))
        setFindings(Array.isArray(prev.specialty_data.findings) ? prev.specialty_data.findings : [])
        setPregnancies(Array.isArray(prev.specialty_data.pregnancies) ? prev.specialty_data.pregnancies : [])
      }
      if (appt && ['arrived', 'waiting'].includes(appt.status)) {
        supabase.from('appointments').update({ status: 'in_consultation' }).eq('id', appt.id)
      }
    }
    setLoading(false)
  }, [appointmentId, patientId])

  useEffect(() => {
    load()
  }, [load])

  /* ---------- أدوية الطبيبة الشائعة ---------- */
  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('doctor_favorite_medications')
      .select('id, name, dosage, duration, instructions')
      .eq('doctor_id', profile.id)
      .order('created_at')
      .then(({ data }) => setFavorites(data || []))
  }, [profile?.id])

  /* ---------- جدول أسعار الفحوصات ---------- */
  useEffect(() => {
    if (!profile?.clinic_id) return
    supabase
      .from('dental_pricebook')
      .select('category, treatment, price, color')
      .eq('clinic_id', profile.clinic_id)
      .then(({ data }) => setPricebook(data || []))
  }, [profile?.clinic_id])

  /* ---------- حسابات ---------- */
  const ga = useMemo(() => gestationalAge(ob.lmp), [ob.lmp])
  const edd = useMemo(() => eddFromLmp(ob.lmp), [ob.lmp])
  const bmi = useMemo(() => bmiOf(ob.weight, ob.height), [ob.weight, ob.height])
  const status = useMemo(() => pregnancyStatus(ob), [ob])
  const alerts = useMemo(() => obgynAlerts({ ...ob, gestational_age: ga }), [ob, ga])
  const risk = useMemo(() => riskLevel({ ...ob, gestational_age: ga }), [ob, ga])

  const setO = (k) => (e) => {
    const v = e?.target ? e.target.value : e
    setOb((o) => ({ ...o, [k]: v }))
  }
  const toggleFlag = (k) => () => setOb((o) => ({ ...o, [k]: !o[k] }))
  const setMed = (i, k) => (e) => setMeds((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: e.target.value } : m)))

  const addFavorite = (f) => {
    setMeds((ms) => {
      const emptyIdx = ms.findIndex((m) => !m.name.trim())
      const row = { name: f.name, dosage: f.dosage || '', duration: f.duration || '', instructions: f.instructions || '' }
      if (emptyIdx >= 0) return ms.map((m, i) => (i === emptyIdx ? row : m))
      return [...ms, row]
    })
  }

  /* ---------- المتابعة المقترحة ---------- */
  const suggestedNext = useMemo(() => {
    const w = nextFollowupWeeks(ga)
    if (!w) return ''
    return addWeeks(todayStr(), w)
  }, [ga])

  /* ---------- الحفظ ---------- */
  const finish = async () => {
    if (!patient) return
    if (!diagnosis.trim()) return toast('error', 'التشخيص مطلوب')
    setSaving(true)
    const fee = Number(settings?.consultation_price) || 0
    const paid = Math.max(0, Math.min(fee || Infinity, Math.floor(Number(paidNow) || 0)))
    try {
      const specialtyData = {
        obgyn: { ...ob, gestational_age: ga, edd, bmi },
        findings,
        pregnancies,
        sketch,
        gpa: gpaLabel(ob.gravida, ob.para, ob.abortions),
      }
      const { data: visit, error: vErr } = await supabase
        .from('visits')
        .insert({
          clinic_id: profile.clinic_id,
          patient_id: patient.id,
          appointment_id: appointment?.id || null,
          doctor_id: profile.id,
          visit_date: todayStr(),
          chief_complaint: complaint.trim() || (status.pregnant ? 'متابعة حمل' : 'كشف نساء وتوليد'),
          symptoms: symptoms.trim() || null,
          physical_examination: buildExamSummary(ob),
          diagnosis: diagnosis.trim(),
          treatment_plan: plan.trim() || null,
          medical_notes: notes.trim() || null,
          specialty_data: specialtyData,
        })
        .select()
        .single()
      if (vErr) throw vErr

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
        if (mErr) throw mErr
      }

      // الدفعات — تُحسب من سعر الكشفية في الإعدادات
      if (fee > 0 || paid > 0) {
        const { error: pErr } = await supabase.from('payments').insert({
          clinic_id: profile.clinic_id,
          patient_id: patient.id,
          appointment_id: appointment?.id || null,
          total_amount: fee || paid,
          amount: paid,
          remaining: Math.max(0, (fee || paid) - paid),
          method: 'cash',
          status: paid >= (fee || paid) ? 'paid' : 'due_later',
          paid_at: paid > 0 ? new Date().toISOString() : null,
          created_by: profile.id,
        })
        if (pErr) throw pErr
      }

      // طلب المتابعة — يُضاف لقائمة المتابعات في الاستقبال
      if (nextVisit) {
        const { error: fErr } = await supabase.from('follow_up_requests').insert({
          clinic_id: profile.clinic_id,
          patient_id: patient.id,
          doctor_id: profile.id,
          visit_id: visit.id,
          appointment_id: appointment?.id || null,
          interval_days: ga ? Math.max(1, Math.round((nextFollowupWeeks(ga) || 1) * 7)) : 14,
          suggested_date: nextVisit,
          status: 'pending',
          notes: `متابعة نساء وتوليد — ${diagnosis.trim()}`.slice(0, 300),
        })
        if (fErr) throw fErr
      }

      if (appointment) {
        await supabase.from('appointments').update({ status: 'completed' }).eq('id', appointment.id)
      }
      audit(profile.clinic_id, 'complete_obgyn_visit', 'visits', visit.id)
      toast('success', 'تم حفظ كشف النساء والتوليد بنجاح')
      setStage('done')
    } catch (e) {
      toast('error', friendlyDbError(e) || e.message)
    } finally {
      setSaving(false)
    }
  }

  /* ---------- الشاشات ---------- */
  if (loading) return <Spinner />

  if (stage === 'pick') {
    return (
      <PatientPicker
        onPicked={(p, appt, extra) => {
          setPatient(p)
          setAppointment(appt || null)
          if (extra?.lmp) setOb((o) => ({ ...o, lmp: extra.lmp }))
          setStage('work')
        }}
      />
    )
  }

  if (stage === 'done') {
    return (
      <div className="mx-auto max-w-2xl pt-6">
        <div className="ob-hero mb-6 px-6 py-8 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <CheckCircle2 size={30} />
          </span>
          <h1 className="text-lg font-bold">تم إنهاء كشف {patient.full_name}</h1>
          <p className="mt-1 text-xs text-white/80">
            {status.pregnant ? `${gaLabel(ga)} — ${findings.length} نتيجة على المخطط` : `${findings.length} نتيجة على المخطط`}
            {sketch ? ' · حُفظ الرسم اليدوي' : ''}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={() => nav('/doctor')}>العودة إلى لوحة اليوم</Button>
          <Button size="lg" variant="secondary" onClick={() => nav(`/doctor/patients/${patient.id}`)}>
            <FolderOpen size={15} />
            فتح ملف المريضة
          </Button>
        </div>
      </div>
    )
  }

  const allergies = medInfo?.allergies?.trim()
  const age = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : null

  return (
    <div className="mx-auto max-w-5xl pb-32">
      {/* ===== ترويسة المريضة ===== */}
      <div className="ob-hero mb-4 px-4 py-4 sm:px-6 sm:py-5">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-black text-white sm:text-xl">{patient.full_name}</h1>
              {status.pregnant && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  <Baby size={12} />
                  {gaLabel(ga)}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  risk.cls === 'rose' ? 'bg-rose-500/90 text-white' : risk.cls === 'amber' ? 'bg-amber-400/90 text-amber-950' : 'bg-emerald-400/90 text-emerald-950'
                }`}
              >
                {risk.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/80">
              {age != null ? `${age} سنة · ` : ''}
              <span dir="ltr">{patient.phone}</span>
              {edd ? ` · الولادة المتوقعة ${formatDateShort(edd)}` : ''}
              {appointment ? ` · موعد ${appointment.start_time?.slice(0, 5)}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="ob-chip !border-white/30 !bg-white/15 !text-white">
                <Droplets size={11} />
                {ob.blood_group ? `فصيلة ${ob.blood_group}${ob.rh ? ` — ${ob.rh}` : ''}` : 'فصيلة الدم غير محددة'}
              </span>
              <span className="ob-chip !border-white/30 !bg-white/15 !text-white">
                <HeartPulse size={11} />
                {gpaLabel(ob.gravida, ob.para, ob.abortions)} (حمل/ولادة/إجهاض)
              </span>
              {bmi != null && (
                <span className="ob-chip !border-white/30 !bg-white/15 !text-white">
                  BMI {bmi} — {bmiLabel(bmi)?.text}
                </span>
              )}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/patients/${patient.id}`)}>
            <FolderOpen size={14} />
            الملف الكامل
          </Button>
        </div>

        {allergies && (
          <div className="relative z-10 mt-3 flex items-start gap-2 rounded-xl bg-white/15 px-3 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-200" />
            <p className="text-xs leading-relaxed text-white">
              <b>تنبيه حساسية:</b> {allergies}
            </p>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span
                key={a.key}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  a.tone === 'rose' ? 'bg-rose-500 text-white' : a.tone === 'amber' ? 'bg-amber-300 text-amber-950' : 'bg-white/20 text-white'
                }`}
              >
                {a.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ===== الخطوات ===== */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(i)}
            className={`ob-step ${step === i ? 'is-active' : ''} ${i < step ? 'is-done' : ''} justify-center`}
          >
            <span className="ob-step-num">{i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* ===== محتوى الخطوة ===== */}
      <div className="space-y-4">
        {step === 0 && (
          <>
            <Card title="الشكوى والتاريخ">
              <div className="space-y-3">
                <Field label="الشكوى الرئيسية">
                  <Textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={2} placeholder="مثال: تأخر الحيض مع غثيان" />
                </Field>
                <Field label="الأعراض المصاحبة">
                  <Textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={2} />
                </Field>
              </div>
            </Card>

            <Card title="التاريخ الحائضي" subtitle="آخر دورة + خواص الدورة">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="آخر دورة شهرية (LMP)">
                  <Input type="date" value={ob.lmp} onChange={setO('lmp')} />
                </Field>
                <Field label="طول الدورة (يوم)">
                  <Input type="number" dir="ltr" value={ob.cycle_length} onChange={setO('cycle_length')} />
                </Field>
                <Field label="مدة النزف (يوم)">
                  <Input type="number" dir="ltr" value={ob.cycle_duration} onChange={setO('cycle_duration')} />
                </Field>
                <Field label="انتظام الدورة">
                  <Select value={ob.cycle_regular} onChange={setO('cycle_regular')}>
                    <option>منتظمة</option>
                    <option>غير منتظمة</option>
                    <option>غائبة (Amenorrhea)</option>
                  </Select>
                </Field>
                <Field label="عسر الحيض">
                  <Input value={ob.dysmenorrhea} onChange={setO('dysmenorrhea')} placeholder="شديد / متوسط / خفيف" />
                </Field>
                <Field label="نزيف مطوّل">
                  <Input value={ob.menorrhagia} onChange={setO('menorrhagia')} placeholder="نعم / لا" />
                </Field>
                <Field label="الإفرازات المهبلية">
                  <Input value={ob.leucorrhea} onChange={setO('leucorrhea')} placeholder="اللون والرائحة" />
                </Field>
                <Field label="طريقة منع الحمل" className="col-span-2">
                  <Input value={ob.contraception} onChange={setO('contraception')} placeholder="حساب / لولب / حقن / لا يوجد" />
                </Field>
              </div>
              {ob.lmp && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-primary-50 px-3 py-2.5 text-xs font-bold text-primary-800">
                  <span className="inline-flex items-center gap-1">
                    <CalendarHeart size={13} /> عمر الحمل: {gaLabel(ga)}
                  </span>
                  <span>الولادة المتوقعة: {formatDateShort(edd)}</span>
                  {suggestedNext && <span>المتابعة المقترحة: {formatDateShort(suggestedNext)}</span>}
                </div>
              )}
            </Card>

            <Card title="التاريخ التوليدي">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="عدد الحمول (G)">
                  <Input type="number" dir="ltr" value={ob.gravida} onChange={setO('gravida')} />
                </Field>
                <Field label="عدد الولادات (P)">
                  <Input type="number" dir="ltr" value={ob.para} onChange={setO('para')} />
                </Field>
                <Field label="عدد الإجهاضات (A)">
                  <Input type="number" dir="ltr" value={ob.abortions} onChange={setO('abortions')} />
                </Field>
                <Field label="الأطفال الأحياء">
                  <Input type="number" dir="ltr" value={ob.living} onChange={setO('living')} />
                </Field>
                <Field label="فصيلة الدم">
                  <Select value={ob.blood_group} onChange={setO('blood_group')}>
                    <option value="">—</option>
                    <option>A</option>
                    <option>B</option>
                    <option>AB</option>
                    <option>O</option>
                  </Select>
                </Field>
                <Field label="عامل Rh">
                  <Select value={ob.rh} onChange={setO('rh')}>
                    <option value="">—</option>
                    <option value="POSITIVE">Positive (+)</option>
                    <option value="NEGATIVE">Negative (-)</option>
                  </Select>
                </Field>
              </div>

              {/* جدول الحمول السابقة */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-500">سجل الحمول السابقة</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setPregnancies((p) => [...p, { year: '', outcome: '', mode: '', complications: '' }])
                    }
                  >
                    <Plus size={13} />
                    إضافة حمل
                  </Button>
                </div>
                {pregnancies.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
                    لا يوجد سجل حمول سابقة — اضغط «إضافة حمل» لتسجيل كل ولادة
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {pregnancies.map((p, i) => (
                      <li key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-5">
                        <Input
                          placeholder="السنة"
                          value={p.year}
                          onChange={(e) =>
                            setPregnancies((list) => list.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))
                          }
                        />
                        <Input
                          placeholder="النتيجة (ولادة/إجهاض)"
                          value={p.outcome}
                          onChange={(e) =>
                            setPregnancies((list) => list.map((x, j) => (j === i ? { ...x, outcome: e.target.value } : x)))
                          }
                        />
                        <Input
                          placeholder="نوع الولادة"
                          value={p.mode}
                          onChange={(e) =>
                            setPregnancies((list) => list.map((x, j) => (j === i ? { ...x, mode: e.target.value } : x)))
                          }
                        />
                        <Input
                          placeholder="المضاعفات"
                          value={p.complications}
                          onChange={(e) =>
                            setPregnancies((list) => list.map((x, j) => (j === i ? { ...x, complications: e.target.value } : x)))
                          }
                        />
                        <div className="flex items-center justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setPregnancies((list) => list.filter((_, j) => j !== i))}>
                            <Trash2 size={14} className="text-rose-500" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </>
        )}

        {step === 1 && (
          <>
            <Card title="العلامات الحيوية">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Field label="الضغط الانقباضي">
                  <Input type="number" dir="ltr" value={ob.bp_systolic} onChange={setO('bp_systolic')} placeholder="120" />
                </Field>
                <Field label="الضغط الانبساطي">
                  <Input type="number" dir="ltr" value={ob.bp_diastolic} onChange={setO('bp_diastolic')} placeholder="80" />
                </Field>
                <Field label="النبض">
                  <Input type="number" dir="ltr" value={ob.pulse} onChange={setO('pulse')} placeholder="80" />
                </Field>
                <Field label="الحرارة">
                  <Input type="number" dir="ltr" value={ob.temperature} onChange={setO('temperature')} placeholder="36.8" />
                </Field>
                <Field label="الوزن (كغ)">
                  <Input type="number" dir="ltr" value={ob.weight} onChange={setO('weight')} />
                </Field>
                <Field label="الطول (سم)">
                  <Input type="number" dir="ltr" value={ob.height} onChange={setO('height')} />
                </Field>
              </div>
              {bmi != null && (
                <p className="mt-2 rounded-lg bg-primary-50 px-3 py-2 text-xs font-bold text-primary-800">
                  مؤشر كتلة الجسم: {bmi} — {bmiLabel(bmi)?.text}
                </p>
              )}
            </Card>

            <Card title="فحص البطن والرحم">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="ارتفاع قاع الرحم (سم)">
                  <Input type="number" dir="ltr" value={ob.uterine_height} onChange={setO('uterine_height')} />
                </Field>
                <Field label="حساسية البطن">
                  <Input value={ob.abdomen_tenderness} onChange={setO('abdomen_tenderness')} placeholder="لا يوجد / موضع الألم" />
                </Field>
                <Field label="كتلة محسوسة">
                  <Input value={ob.mass_palpable} onChange={setO('mass_palpable')} placeholder="لا يوجد / وصف الكتلة" />
                </Field>
                <Field label="وضع الجنين">
                  <Select value={ob.presentation} onChange={setO('presentation')}>
                    <option value="">—</option>
                    <option>رأس (Cephalic)</option>
                    <option>مؤخرة (Breech)</option>
                    <option>عرضية (Transverse)</option>
                  </Select>
                </Field>
                <Field label="نبض الجنين (د/د)">
                  <Input type="number" dir="ltr" value={ob.fetal_heart_rate} onChange={setO('fetal_heart_rate')} />
                </Field>
                <Field label="حركة الجنين">
                  <Input value={ob.fetal_movement} onChange={setO('fetal_movement')} placeholder="محسوس / غير محسوس" />
                </Field>
              </div>
            </Card>

            <Card title="الفحص النسائي (عنق الرحم)">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="اتساع العنق (سم)">
                  <Input type="number" dir="ltr" value={ob.cervix_dilation} onChange={setO('cervix_dilation')} />
                </Field>
                <Field label="الانقباض / Effacement %">
                  <Input type="number" dir="ltr" value={ob.cervix_effacement} onChange={setO('cervix_effacement')} />
                </Field>
                <Field label="موقع الرأس (Station)">
                  <Input type="number" dir="ltr" value={ob.cervix_station} onChange={setO('cervix_station')} placeholder="-3 .. +3" />
                </Field>
                <Field label="قوام العنق">
                  <Select value={ob.cervix_consistency} onChange={setO('cervix_consistency')}>
                    <option value="">—</option>
                    <option>طري</option>
                    <option>متوسط</option>
                    <option>صلب</option>
                  </Select>
                </Field>
                <Field label="الأغشية">
                  <Select value={ob.cervix_membranes} onChange={setO('cervix_membranes')}>
                    <option value="">—</option>
                    <option>سليمة</option>
                    <option>متمزقة</option>
                  </Select>
                </Field>
                <Field label="حساسية العنق">
                  <Input value={ob.cervix_tenderness} onChange={setO('cervix_tenderness')} placeholder="نعم / لا" />
                </Field>
              </div>
            </Card>

            <Card title="علامات الخطر أثناء الفحص">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'gdm', label: 'سكري حمل' },
                  { key: 'preeclampsia', label: 'تسمم حمل' },
                  { key: 'threatened_abortion', label: 'تهديد إجهاض' },
                  { key: 'placenta_previa', label: 'مشيمة نازلة' },
                  { key: 'pap_due', label: 'حاجة لفحص مسحة' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={toggleFlag(f.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                      ob[f.key]
                        ? 'border-rose-400 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}

        {step === 2 && (
          <Card
            title="الرسومات أثناء الكشف"
            subtitle="اضغط على أي منطقة في الرسم التشريحي لتسجيل النتيجة، وارسم باليد ما تريدين توضيحه"
          >
            <ObgynChart
              patientId={patient.id}
              findings={findings}
              onFindingsChange={setFindings}
              pricebook={pricebook}
              sketch={sketch}
              onSketchChange={setSketch}
              tab={chartTab}
              onTabChange={setChartTab}
            />
          </Card>
        )}

        {step === 3 && (
          <>
            <Card title="التشخيص والخطة العلاجية">
              <div className="space-y-3">
                <Field label="التشخيص" required>
                  <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} placeholder="اكتب التشخيص — مثال: حمل طبيعي من الأسبوع 24" />
                </Field>
                <Field label="الخطة العلاجية">
                  <Textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} placeholder="المتابعة، التحاليل المطلوبة، Medication، موعد المراجعة" />
                </Field>
                <Field label="نتائج السونار">
                  <Textarea value={ob.ultrasound} onChange={setO('ultrasound')} rows={2} placeholder="نوع الجنين، الكيس، المشيمة، السائل" />
                </Field>
                <Field label="التحاليل المطلوبة">
                  <Textarea value={ob.labs} onChange={setO('labs')} rows={2} placeholder="CBC، سكر، نوع الدم، تحليل بول..." />
                </Field>
              </div>
            </Card>

            <Card title="المتابعة">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="موعد المتابعة القادمة" hint={suggestedNext ? `المقترح: ${formatDateShort(suggestedNext)}` : undefined}>
                  <Input type="date" value={nextVisit} onChange={(e) => setNextVisit(e.target.value)} />
                </Field>
                <Field label="ملاحظات إضافية">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </Field>
              </div>
              {suggestedNext && !nextVisit && (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setNextVisit(suggestedNext)}>
                  <CalendarHeart size={14} />
                  اعتماد المتابعة المقترحة ({formatDateShort(suggestedNext)})
                </Button>
              )}
            </Card>
          </>
        )}

        {step === 4 && (
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
              <div className="mb-4 border-b border-slate-100 pb-3">
                <p className="mb-2 text-[11px] font-bold text-slate-400">أدويتك الشائعة — اضغط للإدراج</p>
                <div className="flex flex-wrap gap-1.5">
                  {favorites.map((f) => (
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
              </div>
            )}

            {meds.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-400">لا توجد أدوية</p>
            ) : (
              <ul className="space-y-3">
                {meds.map((m, i) => (
                  <li key={i} className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 p-3 sm:grid-cols-5">
                    <div className="col-span-2 sm:col-span-1">
                      <Field label="اسم الدواء">
                        <Input dir="ltr" value={m.name} onChange={setMed(i, 'name')} placeholder="Paracetamol" className="text-right" />
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

            {/* الدفعة */}
            <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/60 p-3">
              <p className="mb-2 text-xs font-bold text-primary-800">
                سعر الكشفية: {fmtPrice(settings?.consultation_price, settings?.currency)}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  dir="ltr"
                  min={0}
                  value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)}
                  placeholder="المدفوع الآن (اختياري)"
                  className="h-9 max-w-[180px]"
                />
                <span className="text-xs font-bold text-slate-500">{settings?.currency || ''}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ===== شريط الإجراءات الثابت ===== */}
      <div className="ob-actionbar fixed inset-x-0 bottom-16 z-20 px-4 py-3 lg:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            السابق
          </Button>
          <p className="hidden text-[11px] font-bold text-slate-400 sm:block">
            {diagnosis.trim() ? 'جاهزة للحفظ' : 'التشخيص مطلوب'}
          </p>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              التالي
              <Stethoscope size={15} />
            </Button>
          ) : (
            <Button onClick={finish} loading={saving} disabled={!diagnosis.trim()}>
              <CheckCircle2 size={17} />
              إنهاء الكشف وحفظه
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * ملخص الفحص السريري — يُحفظ في خانة الفحص بالسجل الطبي
 * ============================================================ */
function buildExamSummary(ob) {
  const parts = []
  if (ob.bp_systolic && ob.bp_diastolic) parts.push(`الضغط ${ob.bp_systolic}/${ob.bp_diastolic}`)
  if (ob.pulse) parts.push(`النبض ${ob.pulse}`)
  if (ob.temperature) parts.push(`الحرارة ${ob.temperature}`)
  if (ob.weight) parts.push(`الوزن ${ob.weight} كغ`)
  if (ob.height) parts.push(`الطول ${ob.height} سم`)
  if (ob.uterine_height) parts.push(`ارتفاع قاع الرحم ${ob.uterine_height} سم`)
  if (ob.cervix_dilation) parts.push(`اتساع العنق ${ob.cervix_dilation} سم`)
  if (ob.cervix_effacement) parts.push(`انقباض العنق ${ob.cervix_effacement}%`)
  if (ob.cervix_station) parts.push(`موقع الرأس ${ob.cervix_station}`)
  if (ob.fetal_heart_rate) parts.push(`نبض الجنين ${ob.fetal_heart_rate}`)
  if (ob.presentation) parts.push(`وضع الجنين: ${ob.presentation}`)
  if (ob.abdomen_tenderness) parts.push(`البطن: ${ob.abdomen_tenderness}`)
  if (ob.mass_palpable) parts.push(`كتلة: ${ob.mass_palpable}`)
  return parts.length ? parts.join(' · ') : null
}

/* ============================================================
 * ملخص الفحص السريري — يُحفظ في خانة الفحص بالسجل الطبي
 * ============================================================ */
function PatientPicker({ onPicked }) {
  const { profile, toast } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newP, setNewP] = useState({ name: '', age: '', phone: '', lmp: '' })
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (!profile?.clinic_id) return
    const term = q.trim()
    if (!term) {
      setResults(null)
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, date_of_birth')
        .eq('clinic_id', profile.clinic_id)
        .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(8)
      setResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, profile?.clinic_id])

  const pickExisting = async (p) => {
    const { data: full } = await supabase.from('patients').select('*').eq('id', p.id).maybeSingle()
    onPicked(full || p)
  }

  const createPatient = async () => {
    if (!newP.name.trim()) return toast('error', 'اسم المريضة مطلوب')
    const age = Number(newP.age)
    if (!Number.isFinite(age) || age < 0 || age > 120) return toast('error', 'أدخل عمراً صحيحاً')
    setCreating(true)
    const now = new Date()
    const dob = new Date(now.getFullYear() - age, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('patients')
      .insert({
        clinic_id: profile.clinic_id,
        full_name: newP.name.trim(),
        phone: newP.phone.trim() || '—',
        date_of_birth: dob,
        gender: 'female',
        created_by: profile.id,
      })
      .select()
      .single()
    setCreating(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'create_patient', 'patients', data.id)
    toast('success', `أُضيفت ${data.full_name} — ابدأي تسجيل الكشف`)
    onPicked(data, null, { lmp: newP.lmp || '' })
  }

  return (
    <div className="mx-auto max-w-2xl pt-4">
      <div className="ob-hero mb-6 px-6 py-8 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
          <Stethoscope size={26} />
        </span>
        <h1 className="text-lg font-bold text-white">كشف النساء والتوليد</h1>
        <p className="mt-1 text-xs text-white/80">
          ابحثي عن مريضة أو أضيفي مريضة جديدة — ثم سجّلي الفحص على المخطط التشريحي مباشرة
        </p>
      </div>

      <Card>
        <Field label="بحث عن مريضة">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اكتبي الاسم أو رقم الهاتف..." autoFocus />
        </Field>
        {results !== null && (
          results.length === 0 ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-400">
              {q.trim() ? 'لا توجد نتائج مطابقة — أضيفيها كمريضة جديدة' : 'اكتبي للبحث...'}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {results.map((p) => (
                <li key={p.id}>
                  <button onClick={() => pickExisting(p)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-start hover:bg-primary-50">
                    <span className="text-sm font-bold text-slate-800">{p.full_name}</span>
                    <span className="text-xs text-slate-400">
                      {p.date_of_birth ? ageFrom(p.date_of_birth) + ' سنة' : ''} <span dir="ltr">{p.phone}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        <div className="my-4 flex items-center gap-3 text-[11px] text-slate-300">
          <span className="h-px flex-1 bg-slate-200" /> أو <span className="h-px flex-1 bg-slate-200" />
        </div>

        <Button size="lg" className="w-full" onClick={() => setAddOpen(true)}>
          <UserPlus size={17} />
          إضافة مريضة جديدة
        </Button>
      </Card>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={() => nav('/doctor')}>رجوع إلى لوحة اليوم</Button>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="مريضة جديدة"
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={createPatient} loading={creating}>إضافة وفتح الكشف</Button>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>إلغاء</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="الاسم" required>
            <Input value={newP.name} onChange={(e) => setNewP((p) => ({ ...p, name: e.target.value }))} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="العمر (سنة)" required>
              <Input type="number" dir="ltr" min={0} max={120} value={newP.age} onChange={(e) => setNewP((p) => ({ ...p, age: e.target.value }))} />
            </Field>
            <Field label="الهاتف (اختياري)">
              <Input dir="ltr" value={newP.phone} onChange={(e) => setNewP((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
          </div>
          <Field label="آخر دورة شهرية (اختياري)">
            <Input type="date" value={newP.lmp} onChange={(e) => setNewP((p) => ({ ...p, lmp: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
