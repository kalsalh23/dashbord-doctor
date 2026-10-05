import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, FolderOpen, Pill, Plus, Printer, Search, Trash2, UserPlus, X } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Modal } from '../../components/ui'
import PrescriptionSheet from '../../components/PrescriptionSheet'
import { usePrintIsolation } from '../../lib/print'
import { ageFrom, todayStr } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'

const EMPTY_MED = { name: '', dosage: '', duration: '', instructions: '' }

/**
 * الكشف الحي لعيادات قالب نزار — بلا حقول نموذج إطلاقاً:
 * ورقة المعاينة تظهر فوراً والتشخيص والعمر يُكتبان عليها مباشرة،
 * أدويتك الشائعة بضغطة تُضاف أمام عينك، ثم «حفظ وطباعة» يحفظ في أرشيف المريض ويطبع.
 */
export default function NizarLiveConsultation({ appointmentId, patientId }) {
  const { profile, settings, toast } = useApp()
  const nav = useNavigate()
  usePrintIsolation()

  const [stage, setStage] = useState('pick') // pick | work | done
  const [patient, setPatient] = useState(null)
  const [appointment, setAppointment] = useState(null)
  const [top, setTop] = useState({ name: '', age: '', diagnosis: '' })
  const [meds, setMeds] = useState([])
  const [favorites, setFavorites] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // أدويتي الشائعة
  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('doctor_favorite_medications')
      .select('id, name, dosage, duration, instructions')
      .eq('doctor_id', profile.id)
      .order('created_at')
      .then(({ data }) => setFavorites(data || []))
  }, [profile?.id])

  // مريض من رابط مباشر (موعد من قائمة الانتظار أو ملف مريض)
  useEffect(() => {
    if (!appointmentId && !patientId) return
    ;(async () => {
      let pat = null
      let appt = null
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
      if (pat) {
        setPatient(pat)
        setAppointment(appt)
        setTop((t) => ({ ...t, name: pat.full_name || '' }))
        setStage('work')
        if (appt && ['arrived', 'waiting', 'in_consultation'].includes(appt.status)) {
          supabase.from('appointments').update({ status: 'in_consultation' }).eq('id', appt.id)
        }
      }
    })()
  }, [appointmentId, patientId])

  // تصغير الورقة لتناسب عرض الشاشة (بنفس عرض الطباعة 745px)
  const frameRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const fit = () => {
      const el = frameRef.current
      if (!el) return
      const avail = el.parentElement?.clientWidth || 0
      if (avail > 0) setZoom(Math.min(1, avail / 745))
    }
    if (stage === 'work') {
      fit()
      const t = setTimeout(fit, 400)
      window.addEventListener('resize', fit)
      return () => {
        window.removeEventListener('resize', fit)
        clearTimeout(t)
      }
    }
  }, [stage])

  const autoAge = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : null
  const shownAge = top.age !== '' ? top.age : (autoAge ?? '')

  const onTopEdit = (field, value) => setTop((t) => ({ ...t, [field]: value }))

  const addFavorite = (f) =>
    setMeds((ms) => [...ms, { name: f.name, dosage: f.dosage || '', duration: f.duration || '', instructions: f.instructions || '' }])
  const removeMed = (i) => setMeds((ms) => ms.filter((_, j) => j !== i))
  const setMed = (i, k) => (e) => setMeds((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: e.target.value } : m)))
  const realMeds = meds.filter((m) => m.name.trim())

  /* ---------------- حفظ وطباعة ---------------- */
  const saveAndPrint = async (withPrint) => {
    if (!patient) return
    if (!top.diagnosis.trim()) return toast('error', 'اكتب التشخيص على الورقة أولاً')
    setSaving(true)
    try {
      // تعبئة تاريخ الميلاد التقريبي إن كان المريض بلا عمر (يستفيد منه العمر في المرات القادمة)
      if (!patient.date_of_birth && top.age !== '') {
        const a = Number(top.age)
        if (Number.isFinite(a) && a >= 0 && a < 120) {
          const now = new Date()
          const dob = new Date(now.getFullYear() - a, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
          await supabase.from('patients').update({ date_of_birth: dob }).eq('id', patient.id)
        }
      }
      // تحديث الاسم إن عدّله الطبيب على الورقة
      if (top.name.trim() && top.name.trim() !== patient.full_name) {
        await supabase.from('patients').update({ full_name: top.name.trim() }).eq('id', patient.id)
      }
      const { data: visit, error: vErr } = await supabase
        .from('visits')
        .insert({
          clinic_id: profile.clinic_id,
          patient_id: patient.id,
          appointment_id: appointment?.id || null,
          doctor_id: profile.id,
          visit_date: todayStr(),
          diagnosis: top.diagnosis.trim(),
        })
        .select()
        .single()
      if (vErr) throw vErr
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
      if (appointment) {
        const { error: aErr } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', appointment.id)
        if (aErr) throw aErr
      }
      audit(profile.clinic_id, 'complete_visit', 'visits', visit.id)
      setSaved(true)
      if (withPrint) {
        setTimeout(() => window.print(), 150)
        setTimeout(() => setStage('done'), 400)
      } else {
        setStage('done')
      }
    } catch (e) {
      toast('error', friendlyDbError(e) || e.message)
    } finally {
      setSaving(false)
    }
  }

  /* ---------------- المراحل ---------------- */
  if (stage === 'pick') {
    return <PatientPicker onPicked={(p, appt) => { setPatient(p); setAppointment(appt || null); setTop((t) => ({ ...t, name: p.full_name || '' })); setStage('work') }} />
  }

  if (stage === 'done') {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={30} />
          </span>
          <h1 className="text-lg font-bold text-slate-800">تم حفظ الوصفة في أرشيف {top.name || 'المريض'}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {saved ? 'حُفظت الزيارة وأدويتها — تجدها في «أرشيف المرضى» مع إمكانية طباعتها لاحقاً' : 'حُفظت الزيارة بنجاح'}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button size="lg" onClick={() => { setStage('pick'); setPatient(null); setAppointment(null); setMeds([]); setTop({ name: '', age: '', diagnosis: '' }); setSaved(false) }}>
            مريض جديد
          </Button>
          <Button size="lg" variant="secondary" onClick={() => nav('/doctor')}>
            العودة إلى قائمة الانتظار
          </Button>
        </div>
      </div>
    )
  }

  /* ---------------- مرحلة الورقة الحية ---------------- */
  return (
    <div className="mx-auto max-w-3xl pb-24">
      <button onClick={() => { setStage('pick'); setPatient(null); setAppointment(null); setMeds([]); setTop({ name: '', age: '', diagnosis: '' }); setSaved(false) }} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
        <ArrowRight size={14} />
        مريض آخر
      </button>

      {/* شريط المريض */}
      <Card className="mb-4" bodyClass="!p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-800">{patient.full_name}</span>
            {patient.phone && patient.phone !== '—' && <span className="text-slate-400" dir="ltr">{patient.phone}</span>}
            {appointment && <span className="text-slate-400">· موعد {appointment.start_time?.slice(0, 5)}</span>}
          </div>
          <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/patients/${patient.id}`)}>
            <FolderOpen size={13} />
            الملف الكامل
          </Button>
        </div>
      </Card>

      {/* أدويتي الشائعة — بضغطة تُضاف على الورقة */}
      <Card className="mb-4 print:hidden" bodyClass="!p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
          <Pill size={13} />
          أدويتك الشائعة — اضغط الدواء ليُضاف فوراً على الورقة
        </p>
        <div className="flex flex-wrap gap-1.5">
          {favorites.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => addFavorite(f)}
              className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-100"
              title={[f.dosage, f.duration, f.instructions].filter(Boolean).join(' · ')}
            >
              <Plus size={12} />
              {f.name}
              {f.dosage ? ` · ${f.dosage}` : ''}
            </button>
          ))}
          {favorites.length === 0 && (
            <p className="text-[11px] text-slate-400">لا توجد أدوية شائعة بعد — أضفها من صفحة «أدويتي الشائعة»، أو أضف دواءً يدوياً بالأسفل</p>
          )}
        </div>
      </Card>

      {/* الورقة الحية */}
      <Card title="الوصفة الطبية — اكتب التشخيص مباشرة على الورقة" bodyClass="!p-3">
        <div className="print-area">
          <div ref={frameRef} className="prescription-paper" style={{ zoom }}>
            <PrescriptionSheet
              clinic={profile?.clinic}
              settings={settings}
              patient={patient}
              visit={{ diagnosis: top.diagnosis }}
              meds={realMeds}
              doctorName={profile?.full_name}
              topValues={{ name: top.name, age: shownAge === null ? '' : String(shownAge), diagnosis: top.diagnosis }}
              onTopEdit={onTopEdit}
            />
          </div>
        </div>

        {/* تفاصيل الأدوية المضافة (تحرير سريع تحت الورقة) */}
        {meds.length > 0 && (
          <div className="mt-3 space-y-2 print:hidden">
            {meds.map((m, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-5">
                <div className="col-span-2 sm:col-span-1">
                  <Field label="الدواء">
                    <Input className="!h-8 text-xs" value={m.name} onChange={setMed(i, 'name')} placeholder="اسم الدواء" />
                  </Field>
                </div>
                <Field label="الجرعة">
                  <Input className="!h-8 text-xs" value={m.dosage} onChange={setMed(i, 'dosage')} placeholder="500 ملغ" />
                </Field>
                <Field label="المدة">
                  <Input className="!h-8 text-xs" value={m.duration} onChange={setMed(i, 'duration')} placeholder="5 أيام" />
                </Field>
                <div className="col-span-2 sm:col-span-1">
                  <Field label="التعليمات">
                    <Input className="!h-8 text-xs" value={m.instructions} onChange={setMed(i, 'instructions')} placeholder="قرص كل 8 ساعات" />
                  </Field>
                </div>
                <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                  <Button size="sm" variant="ghost" onClick={() => removeMed(i)} title="حذف">
                    <Trash2 size={14} className="text-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex justify-start print:hidden">
          <Button size="sm" variant="ghost" onClick={() => setMeds((ms) => [...ms, { ...EMPTY_MED }])}>
            <Plus size={14} />
            إضافة دواء آخر يدوياً
          </Button>
        </div>
      </Card>

      {/* شريط الحفظ والطباعة */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:ms-60 print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            {top.diagnosis.trim() ? 'جاهز — سيُحفظ في أرشيف المريض ثم يُطبع' : 'اكتب التشخيص على الورقة أولاً'}
          </p>
          <Button size="lg" onClick={() => saveAndPrint(true)} loading={saving} disabled={!top.diagnosis.trim()}>
            {saved ? <Check size={17} /> : <Printer size={17} />}
            حفظ وطباعة
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- اختيار المريض: بحث + إضافة سريعة (اسم + عمر) ---------------- */
function PatientPicker({ onPicked }) {
  const { profile, toast } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newP, setNewP] = useState({ name: '', age: '', phone: '' })
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (!profile?.clinic_id) return
    const term = q.trim()
    if (!term) { setResults(null); return }
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
    if (!newP.name.trim()) return toast('error', 'اسم المريض مطلوب')
    setCreating(true)
    let dob = null
    const age = Number(newP.age)
    if (Number.isFinite(age) && age >= 0 && age < 120) {
      const now = new Date()
      dob = new Date(now.getFullYear() - age, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    }
    const { data, error } = await supabase
      .from('patients')
      .insert({ clinic_id: profile.clinic_id, full_name: newP.name.trim(), phone: newP.phone.trim() || '—', date_of_birth: dob, created_by: profile.id })
      .select()
      .single()
    setCreating(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'create_patient', 'patients', data.id)
    onPicked(data)
  }

  return (
    <div className="mx-auto max-w-2xl pt-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <Search size={26} />
        </span>
        <h1 className="text-lg font-bold text-slate-800">وصفة طبية جديدة</h1>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
          اختر المريض وستفتح الورقة فوراً — اكتب التشخيص عليها مباشرة وأضف الأدوية بضغطة
        </p>
      </div>

      <Card>
        <Field label="بحث عن مريض موجود">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اكتب الاسم أو رقم الهاتف..." autoFocus />
        </Field>
        {results !== null && (
          results.length === 0 ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-400">
              {q.trim() ? 'لا توجد نتائج مطابقة — أضفه كمريض جديد' : 'اكتب للبحث...'}
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
          مريض جديد (اسم + عمر)
        </Button>
      </Card>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={() => nav('/doctor')}>رجوع لقائمة الانتظار</Button>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="مريض جديد"
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={createPatient} loading={creating}>إضافة وفتح الورقة</Button>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>إلغاء</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="الاسم" required>
            <Input value={newP.name} onChange={(e) => setNewP((p) => ({ ...p, name: e.target.value }))} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="العمر (سنة)">
              <Input type="number" dir="ltr" min={0} max={120} value={newP.age} onChange={(e) => setNewP((p) => ({ ...p, age: e.target.value }))} />
            </Field>
            <Field label="الهاتف (اختياري)">
              <Input dir="ltr" value={newP.phone} onChange={(e) => setNewP((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
