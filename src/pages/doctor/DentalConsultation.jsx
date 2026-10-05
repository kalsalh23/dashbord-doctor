import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Search, UserPlus, CheckCircle2, AlertTriangle, FolderOpen, Wallet,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Modal, EmptyState } from '../../components/ui'
import DentalChart from '../../components/DentalChart'
import { ageFrom, todayStr, formatDateShort } from '../../lib/format'
import { fmtPrice, DEFAULT_CATALOG } from '../../lib/dental'
import { friendlyDbError } from '../../lib/hooks'

const FOLLOW_UP_OPTIONS = [2, 4, 7, 14, 30]

/**
 * واجهة كشف عيادات الأسنان — مختلفة تماماً عن بقية التخصصات:
 * إضافة مريض (اسم + عمر) أو بحث عن موجود → فك أفقي حسب العمر →
 * اختيار الفئة والعلاج لكل سن (بلون وسعر) → كل علاج يُحسب على حساب المريض.
 */
export default function DentalConsultation({ appointmentId, patientId }) {
  const { profile, toast } = useApp()
  const nav = useNavigate()

  const [stage, setStage] = useState('pick') // pick | work | done
  const [patient, setPatient] = useState(null)
  const [appointment, setAppointment] = useState(null)
  const [allergies, setAllergies] = useState(null)
  const [pricebook, setPricebook] = useState(null)
  const [entries, setEntries] = useState([])
  const [paidNow, setPaidNow] = useState('')
  const [saving, setSaving] = useState(false)

  // جدول الأسعار من أسعاري — وإن كان فارغاً نعرض الافتراضي مؤقتاً
  useEffect(() => {
    if (!profile?.clinic_id) return
    supabase
      .from('dental_pricebook')
      .select('category, treatment, price, color')
      .eq('clinic_id', profile.clinic_id)
      .then(({ data }) => {
        if (data && data.length) setPricebook(data)
        else setPricebook([])
      })
  }, [profile?.clinic_id])

  // مريض قادم من رابط مباشر (موعد أو ملف)
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
        setStage('work')
        if (appt && ['arrived', 'waiting', 'in_consultation'].includes(appt.status)) {
          supabase.from('appointments').update({ status: 'in_consultation' }).eq('id', appt.id).then(({ error }) => {
            if (!error) setAppointment({ ...appt, status: 'in_consultation' })
          })
        }
      }
    })()
  }, [appointmentId, patientId])

  const age = useMemo(() => (patient?.date_of_birth ? ageFrom(patient.date_of_birth) : null), [patient])

  const effectivePricebook = useMemo(() => {
    if (pricebook && pricebook.length) return pricebook
    return null // سنعرض تنبيهاً باستخدام الافتراضي داخل المخطط عبر DEFAULT في الرسم
  }, [pricebook])

  const chartPricebook = useMemo(() => {
    if (effectivePricebook) return effectivePricebook
    // الكتالوج الافتراضي حتى يثبت الطبيب أسعاره من «أسعاري»
    return DEFAULT_CATALOG.flatMap((g) => g.items.map((i) => ({ category: g.category, ...i })))
  }, [effectivePricebook])

  const total = useMemo(() => entries.reduce((s, e) => s + (Number(e.price) || 0), 0), [entries])

  /* ---------------- إنهاء الكشف وحفظ كل شيء ---------------- */
  const finish = async () => {
    if (!patient) return
    if (entries.length === 0) return toast('error', 'اختر علاجاً واحداً على الأقل من الفك قبل الحفظ')
    setSaving(true)
    const summary = entries.map((e) => `سن ${e.tooth_no}: ${e.treatment}`).join(' · ')
    try {
      const { data: visit, error: vErr } = await supabase
        .from('visits')
        .insert({
          clinic_id: profile.clinic_id,
          patient_id: patient.id,
          appointment_id: appointment?.id || null,
          doctor_id: profile.id,
          visit_date: todayStr(),
          chief_complaint: 'كشف أسنان',
          diagnosis: summary,
          // نحفظ العلاجات بأسعارها داخل الزيارة لطباعة كشف حساب المريض لاحقاً
          specialty_data: {
            treatments: entries.map((e) =>
              e.bridge
                ? { bridge: true, teeth: e.teeth, span: e.span, treatment: 'جسر', price: e.price, category: e.category }
                : { tooth_no: e.tooth_no, treatment: e.treatment, price: e.price, category: e.category }
            ),
          },
        })
        .select()
        .single()
      if (vErr) throw vErr

      const { error: dErr } = await supabase.from('dental_chart_entries').insert(
        entries.flatMap((e) =>
          e.bridge
            ? // الجسر: صف لكل سن في النطاق مع ربطها بملاحظة موحدة
              e.span.map((t) => ({
                clinic_id: profile.clinic_id,
                patient_id: patient.id,
                visit_id: visit.id,
                tooth_no: t,
                procedure: 'جسر',
                notes: `جسر متصل ${e.teeth[0]}-${e.teeth[1]}`,
                created_by: profile.id,
              }))
            : [
                {
                  clinic_id: profile.clinic_id,
                  patient_id: patient.id,
                  visit_id: visit.id,
                  tooth_no: e.tooth_no,
                  procedure: e.treatment,
                  notes: [e.category, e.notes].filter(Boolean).join(' — ') || null,
                  created_by: profile.id,
                },
              ]
        )
      )
      if (dErr) throw dErr

      // حساب العلاجات على حساب المريض
      if (total > 0) {
        const paid = Math.min(Number(paidNow) || 0, total)
        const remaining = total - paid
        const { error: pErr } = await supabase.from('payments').insert({
          clinic_id: profile.clinic_id,
          patient_id: patient.id,
          appointment_id: appointment?.id || null,
          total_amount: total,
          amount: paid,
          remaining,
          method: 'cash',
          status: remaining <= 0 ? 'paid' : 'due_later',
          paid_at: paid > 0 ? new Date().toISOString() : null,
        })
        if (pErr) throw pErr
      }

      if (appointment) {
        const { error: aErr } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', appointment.id)
        if (aErr) throw aErr
      }
      audit(profile.clinic_id, 'complete_dental_visit', 'visits', visit.id)
      setStage('done')
    } catch (e) {
      toast('error', friendlyDbError(e) || e.message)
    } finally {
      setSaving(false)
    }
  }

  /* ---------------- المراحل ---------------- */
  if (stage === 'pick') {
    return <PatientPicker onPicked={(p, appt) => { setPatient(p); setAppointment(appt || null); setStage('work') }} />
  }

  if (stage === 'done') {
    return (
      <div className="mx-auto max-w-xl pt-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={30} />
          </span>
          <h1 className="text-lg font-bold text-slate-800">تم إنهاء كشف {patient.full_name}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {entries.length} علاجًا بإجمالي {fmtPrice(total)} — حُفظت على حساب المريض
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button size="lg" onClick={() => nav('/doctor')}>العودة إلى قائمة الانتظار</Button>
          <Button size="lg" variant="secondary" onClick={() => nav(`/doctor/patients/${patient.id}`)}>
            <FolderOpen size={15} />
            فتح الملف
          </Button>
        </div>
      </div>
    )
  }

  /* ---------------- مرحلة العمل على الفك ---------------- */
  return (
    <div className="mx-auto max-w-4xl pb-28">
      <button onClick={() => { setStage('pick'); setPatient(null); setAppointment(null); setEntries([]); setPaidNow('') }} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
        <ArrowRight size={14} />
        مريض آخر
      </button>

      {/* ترويسة المريض */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{patient.full_name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              العمر: <b>{age ?? '—'}</b>
              {patient.phone ? <> · <span dir="ltr">{patient.phone}</span></> : null}
              {appointment ? ` · موعد ${appointment.start_time?.slice(0, 5)}` : ''}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/patients/${patient.id}`)}>
            <FolderOpen size={14} />
            الملف الكامل
          </Button>
        </div>
        {allergies?.trim() && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" />
            <p className="text-xs leading-relaxed text-rose-800"><b>تنبيه حساسية:</b> {allergies}</p>
          </div>
        )}
      </Card>

      {/* الفك + التشخيص */}
      <Card>
        <DentalChart
          patientId={patient.id}
          age={age}
          entries={entries}
          pricebook={chartPricebook}
          onEntriesChange={setEntries}
        />
        {pricebook !== null && pricebook.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            تُعرض الآن الأسعار الافتراضية — ثبّت أسعار عيادتك الحقيقية من صفحة «أسعاري»
          </p>
        )}
      </Card>

      {/* شريط الحساب الثابت */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:ms-60">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400">إجمالي علاجات اليوم</p>
              <p className="text-base font-bold text-slate-800" dir="ltr">{fmtPrice(total)}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400">المدفوع الآن (اختياري)</p>
              <input
                type="number"
                dir="ltr"
                value={paidNow}
                onChange={(e) => setPaidNow(e.target.value)}
                placeholder="0"
                className="h-8 w-28 rounded-lg border border-slate-300 px-2 text-sm"
              />
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400">المتبقي على الحساب</p>
              <p className={`text-sm font-bold ${(total - (Number(paidNow) || 0)) > 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">
                {fmtPrice(Math.max(0, total - (Number(paidNow) || 0)))}
              </p>
            </div>
          </div>
          <Button size="lg" onClick={finish} loading={saving} disabled={entries.length === 0}>
            <CheckCircle2 size={17} />
            إنهاء الكشف وحفظ الحساب
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- اختيار المريض: بحث + إضافة جديد (اسم + عمر) ---------------- */
function PatientPicker({ onPicked }) {
  const { profile, toast } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newP, setNewP] = useState({ name: '', age: '', phone: '' })
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()

  // بحث فوري في مرضى العيادة
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
    const age = Number(newP.age)
    if (!Number.isFinite(age) || age < 0 || age > 120) return toast('error', 'أدخل عمراً صحيحاً')
    setCreating(true)
    // تاريخ ميلاد تقريبي من العمر — ليعمل الفك حسب العمر وسنوات العمر
    const now = new Date()
    const dob = new Date(now.getFullYear() - age, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('patients')
      .insert({ clinic_id: profile.clinic_id, full_name: newP.name.trim(), phone: newP.phone.trim() || '—', date_of_birth: dob, created_by: profile.id })
      .select()
      .single()
    setCreating(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'create_patient', 'patients', data.id)
    toast('success', `أُضيف ${data.full_name} — عمره ${age} سنة، افتح فكه بالضغط على الأسنان`)
    onPicked(data)
  }

  return (
    <div className="mx-auto max-w-2xl pt-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <Search size={26} />
        </span>
        <h1 className="text-lg font-bold text-slate-800">كشف الأسنان</h1>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
          ابحث عن مريض موجود لإكمال فكّه، أو أضف مريضاً جديداً بالاسم والعمر ليظهر فكه على شكل سنه
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
          إضافة مريض جديد (اسم + عمر)
        </Button>
      </Card>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={() => nav('/doctor')}>رجوع لقائمة الانتظار</Button>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="مريض جديد"
        subtitle="الاسم والعمر فقط — شكل الفك سيُبنى على العمر تلقائياً"
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={createPatient} loading={creating}>إضافة وفتح الفك</Button>
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
              <Input type="number" dir="ltr" min={0} max={120} value={newP.age} onChange={(e) => setNewP((p) => ({ ...p, age: e.target.value }))} placeholder="مثال: 8" />
            </Field>
            <Field label="الهاتف (اختياري)">
              <Input dir="ltr" value={newP.phone} onChange={(e) => setNewP((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
          </div>
          {newP.age !== '' && Number(newP.age) < 12 && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
              طفل — سيظهر فك {Number(newP.age) < 6 ? 'الأسنان اللبنية (20 سنّاً) صغيراً' : 'التبديل المختلط: أسنان لبنية وأخرى دائمة'}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
