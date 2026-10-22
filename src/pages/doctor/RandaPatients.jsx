import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, CalendarPlus, Filter, Activity, Search, Stethoscope, UserPlus, Users,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Modal, Spinner } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import { ageFrom, daysBetween, formatDateShort, todayStr } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'
import { glucoseLabel, hba1cLabel, bmiOf, bmiLabel, endocrineAlerts, endocrineRiskLevel, ENDOCRINE_DEFAULT_CATALOG } from '../../lib/endocrine'

/**
 * عرض مرضى الغدد والسكري — بطاقات بدل الجدول العام:
 *   شريط بحث + تصنيف (الكل / سكري / مقدمات سكري / سمنة / خطورة عالية)
 *   كل بطاقة: السكر + HbA1c + BMI + الخطورة + آخر زيارة
 * prop receptionMode: عرض الاستقبال — بلا زر الكشف (يظهر حجز الموعد فقط)
 */
export default function RandaPatients({ receptionMode = false }) {
  const { profile, toast, effectiveRole } = useApp()
  const nav = useNavigate()
  const isDoctor = effectiveRole === 'doctor'
  const listPath = isDoctor ? '/doctor/patients' : '/reception/patients'
  const [patients, setPatients] = useState(null)
  const [endData, setEndData] = useState({})
  const [lastVisit, setLastVisit] = useState({})
  const [nextFollowUp, setNextFollowUp] = useState({})
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [bookPatient, setBookPatient] = useState(null)
  const [newP, setNewP] = useState({ name: '', age: '', phone: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const [pRes, vRes, fRes] = await Promise.all([
      supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('visits')
        .select('patient_id, visit_date, specialty_data')
        .eq('clinic_id', profile.clinic_id)
        .order('visit_date', { ascending: false })
        .limit(400),
      supabase
        .from('follow_up_requests')
        .select('patient_id, suggested_date, status')
        .eq('clinic_id', profile.clinic_id)
        .in('status', ['pending', 'scheduled'])
        .order('suggested_date'),
    ])
    setPatients(pRes.data || [])
    const en = {}
    const lv = {}
    for (const v of vRes.data || []) {
      if (!lv[v.patient_id]) lv[v.patient_id] = v.visit_date
      const d = v.specialty_data?.endocrine
      if (d && !en[v.patient_id]) en[v.patient_id] = d
    }
    setEndData(en)
    setLastVisit(lv)
    const nf = {}
    for (const f of fRes.data || []) {
      if (!nf[f.patient_id]) nf[f.patient_id] = f.suggested_date
    }
    setNextFollowUp(nf)
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const list = useMemo(() => {
    let rows = patients || []
    const term = q.trim()
    if (term) {
      rows = rows.filter((p) => (p.full_name || '').includes(term) || (p.phone || '').includes(term))
    }
    const today = todayStr()
    const decorated = rows.map((p) => {
      const en = endData[p.id]
      const glucose = Number(en?.blood_glucose)
      const gLabel = glucoseLabel(glucose)
      const hba1c = Number(en?.hba1c)
      const hLabel = hba1cLabel(hba1c)
      const bmi = bmiOf(en?.weight, en?.height)
      const bLabel = bmiLabel(bmi)
      const risk = en ? endocrineRiskLevel(en) : { cls: 'slate', label: '—' }
      const fu = nextFollowUp[p.id] || ''
      const daysToReview = fu ? daysBetween(today, fu) : null
      const last = lastVisit[p.id]
      let fill = 0
      if (fu && last) {
        const span = Math.max(1, daysBetween(last, fu))
        fill = Math.min(100, Math.max(6, Math.round((daysBetween(last, today) / span) * 100)))
      } else if (fu) {
        fill = 40
      }
      const alerts = en ? endocrineAlerts(en) : []
      const highRisk = alerts.some((a) => a.tone === 'rose')
      return { ...p, en, gLabel, hLabel, hba1c, bmi, bLabel, risk, nextFollowUp: fu, daysToReview, reviewFill: fill, highRisk }
    })
    if (filter === 'diabetic') return decorated.filter((p) => (p.gLabel?.cls === 'rose'))
    if (filter === 'prediabetic') return decorated.filter((p) => (p.gLabel?.cls === 'amber'))
    if (filter === 'obese') return decorated.filter((p) => (p.bLabel?.cls === 'rose'))
    if (filter === 'risk') return decorated.filter((p) => (p.risk.cls === 'rose'))
    return decorated
  }, [patients, q, filter, endData, nextFollowUp, lastVisit])

  const counts = useMemo(() => {
    const all = (patients || []).map((p) => {
      const en = endData[p.id]
      const glucose = Number(en?.blood_glucose)
      const bmi = bmiOf(en?.weight, en?.height)
      const risk = en ? endocrineRiskLevel(en) : null
      return { p, glucose, bmi, risk }
    })
    return {
      all: all.length,
      diabetic: all.filter((x) => x.glucose && x.glucose >= 126).length,
      prediabetic: all.filter((x) => x.glucose && x.glucose >= 100 && x.glucose < 126).length,
      obese: all.filter((x) => x.bmi && x.bmi >= 30).length,
      risk: all.filter((x) => x.risk?.cls === 'rose').length,
    }
  }, [patients, endData])

  const createPatient = async () => {
    if (!newP.name.trim()) return toast('error', 'اسم المريض مطلوب')
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
        created_by: profile.id,
      })
      .select()
      .single()
    setCreating(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'create_patient', 'patients', data.id)
    toast('success', `أُضيف ${data.full_name}`)
    setAddOpen(false)
    setNewP({ name: '', age: '', phone: '' })
    load()
  }

  if (patients === null) return <Spinner />

  const FILTERS = [
    { key: 'all', label: `الكل (${counts.all})` },
    { key: 'diabetic', label: `سكري (${counts.diabetic})` },
    { key: 'prediabetic', label: `مقدمات سكري (${counts.prediabetic})` },
    { key: 'obese', label: `سمنة (${counts.obese})` },
    { key: 'risk', label: `خطورة عالية (${counts.risk})` },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      {/* ===== الترويسة ===== */}
      <div className="mb-4 px-4 py-5 sm:px-6">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-black text-white sm:text-xl">
              <Users size={20} />
              المرضى
            </h1>
            <p className="mt-1 text-xs text-white/80">
              {counts.all} مريض · {counts.diabetic} سكري · {counts.risk} يحتاج متابعة عاجلة
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="!bg-white !text-primary-800 hover:!bg-primary-50">
            <UserPlus size={15} />
            مريض جديد
          </Button>
        </div>
      </div>

      {/* ===== البحث والتصفية ===== */}
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="بحث">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم المريض أو رقم الهاتف..." className="!ps-9" />
            </div>
          </Field>
          <div>
            <p className="label-base">تصفية</p>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                    filter === f.key
                      ? 'border-primary-700 bg-primary-700 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300'
                  }`}
                >
                  {f.key === 'all' && <Filter size={11} />}
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ===== بطاقات المرضى ===== */}
      {list.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-sm font-bold text-slate-600">لا توجد مرضى مطابقة</p>
            <p className="mt-1 text-xs text-slate-400">غيّري البحث أو أضيفي مريضاً جديداً</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <article key={p.id} className="ob-card overflow-hidden">
              <div
                className={`h-1.5 ${
                  p.risk.cls === 'rose'
                    ? 'bg-rose-400'
                    : p.risk.cls === 'amber'
                      ? 'bg-amber-400'
                      : p.gLabel?.cls === 'rose'
                        ? 'bg-rose-400'
                        : p.gLabel?.cls === 'amber'
                          ? 'bg-amber-400'
                          : 'bg-primary-200'
                }`}
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-800">{p.full_name}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {p.date_of_birth ? `${ageFrom(p.date_of_birth)} سنة` : '—'} ·{' '}
                      <span dir="ltr">{p.phone}</span>
                    </p>
                  </div>
                  {p.gLabel && (
                    <span className={`ob-chip ${
                      p.gLabel.cls === 'rose'
                        ? '!border-rose-200 !bg-rose-50 !text-rose-700'
                        : p.gLabel.cls === 'amber'
                          ? '!border-amber-200 !bg-amber-50 !text-amber-700'
                          : '!border-emerald-200 !bg-emerald-50 !text-emerald-700'
                    }`}>
                      <Activity size={11} />
                      {p.gLabel.label}
                    </span>
                  )}
                  {p.risk.cls === 'rose' && (
                    <span className="ob-chip !border-rose-200 !bg-rose-50 !text-rose-700">{p.risk.label}</span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-400">سكر</p>
                      <p className="text-xs font-bold text-slate-800" dir="ltr">{p.gLabel ? p.glucose : '—'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-400">HbA1c</p>
                      <p className="text-xs font-bold text-slate-800" dir="ltr">{p.hba1c ? p.hba1c : '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-400">BMI</p>
                      <p className="text-xs font-bold text-slate-800" dir="ltr">{p.bmi ? p.bmi : '—'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-400">الخطورة</p>
                      <p className="text-xs font-bold text-slate-700">{p.risk.label}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1 font-bold text-slate-500">
                      <Calendar size={14} className="shrink-0 text-primary-500" />
                      المراجعة القادمة
                    </span>
                    <span className={`font-black ${p.nextFollowUp ? 'text-primary-800' : 'text-slate-400'}`}>
                      {p.nextFollowUp ? formatDateShort(p.nextFollowUp) : 'لم تُحدَّد'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${p.nextFollowUp ? 'bg-primary-500' : 'bg-slate-200'}`} style={{ width: `${p.reviewFill}%` }} />
                  </div>
                  {p.nextFollowUp && p.daysToReview != null && (
                    <p className="mt-1 text-[10px] text-slate-400">
                      {p.daysToReview >= 0 ? `بعد ${p.daysToReview} يوم` : `متأخرة ${Math.abs(p.daysToReview)} يوم`}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  {isDoctor && (
                    <Button size="sm" className="flex-1" onClick={() => nav(`/doctor/consultation/new/${p.id}`)}>
                      <Stethoscope size={13} />
                      كشف
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => nav(`${listPath}/${p.id}`)}>
                    الملف
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setBookPatient({ id: p.id, full_name: p.full_name, phone: p.phone })}
                    title="حجز موعد"
                  >
                    <CalendarPlus size={13} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ===== نافذة حجز الموعد ===== */}
      <BookingModal
        open={!!bookPatient}
        onClose={() => setBookPatient(null)}
        presetPatient={bookPatient || undefined}
        onBooked={() => load()}
      />

      {/* ===== نافذة إضافة مريض ===== */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="مريض جديد"
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={createPatient} loading={creating}>إضافة</Button>
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
            <Field label="الهاتف">
              <Input dir="ltr" value={newP.phone} onChange={(e) => setNewP((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
