import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Baby, CalendarPlus, Droplets, Filter, Search, Stethoscope, UserPlus, Users,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Modal, Spinner } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import { ageFrom, formatDateShort } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'
import { gaLabel, gpaLabel, pregnancyStatus, riskLevel } from '../../lib/obgyn'

/**
 * عرض المريضات في عيادة النساء والتوليد — بطاقات بدل الجدول العام:
 *   شريط بحث + تصنيف (الكل / حوامل / غير حوامل / عاليات الخطورة)
 *   كل بطاقة: الحالة (حمل + أسبوعه)، G-P-A، الفصيلة، الخطورة، آخر زيارة
 * prop receptionMode: عرض الاستقبال — بلا زر الكشف (يظهر حجز الموعد فقط)
 */
export default function ObgynPatients({ receptionMode = false }) {
  const { profile, toast, effectiveRole } = useApp()
  const nav = useNavigate()
  const isDoctor = effectiveRole === 'doctor'
  const listPath = isDoctor ? '/doctor/patients' : '/reception/patients'
  const [patients, setPatients] = useState(null)
  const [obData, setObData] = useState({})
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
    const ob = {}
    const lv = {}
    for (const v of vRes.data || []) {
      if (!lv[v.patient_id]) lv[v.patient_id] = v.visit_date
      const d = v.specialty_data?.obgyn
      if (d && !ob[v.patient_id]) ob[v.patient_id] = d
    }
    setObData(ob)
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
    const decorated = rows.map((p) => {
      const ob = obData[p.id]
      const st = pregnancyStatus(ob || {})
      const risk = ob ? riskLevel({ ...ob, gestational_age: st.ga }) : { cls: 'slate', label: '—' }
      return { ...p, ob, st, risk }
    })
    if (filter === 'pregnant') return decorated.filter((p) => p.st.pregnant)
    if (filter === 'notPregnant') return decorated.filter((p) => !p.st.pregnant)
    if (filter === 'risk') return decorated.filter((p) => p.risk.cls === 'rose')
    return decorated
  }, [patients, q, filter, obData])

  const counts = useMemo(() => {
    const all = (patients || []).map((p) => {
      const ob = obData[p.id]
      const st = pregnancyStatus(ob || {})
      return { p, st, risk: ob ? riskLevel({ ...ob, gestational_age: st.ga }) : null }
    })
    return {
      all: all.length,
      pregnant: all.filter((x) => x.st.pregnant).length,
      risk: all.filter((x) => x.risk?.cls === 'rose').length,
    }
  }, [patients, obData])

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
    toast('success', `أُضيفت ${data.full_name}`)
    setAddOpen(false)
    setNewP({ name: '', age: '', phone: '' })
    load()
  }

  if (patients === null) return <Spinner />

  const FILTERS = [
    { key: 'all', label: `الكل (${counts.all})` },
    { key: 'pregnant', label: `حوامل (${counts.pregnant})` },
    { key: 'notPregnant', label: 'غير حوامل' },
    { key: 'risk', label: `خطورة عالية (${counts.risk})` },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      {/* ===== الترويسة ===== */}
      <div className="ob-hero mb-4 px-4 py-5 sm:px-6">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-black text-white sm:text-xl">
              <Users size={20} />
              المريضات
            </h1>
            <p className="mt-1 text-xs text-white/80">
              {counts.all} مريضة · {counts.pregnant} حاملة · {counts.risk} تحتاج متابعة عاجلة
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="!bg-white !text-primary-800 hover:!bg-primary-50">
            <UserPlus size={15} />
            مريضة جديدة
          </Button>
        </div>
      </div>

      {/* ===== البحث والتصفية ===== */}
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="بحث">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم المريضة أو رقم الهاتف..." className="!ps-9" />
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

      {/* ===== بطاقات المريضات ===== */}
      {list.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-sm font-bold text-slate-600">لا توجد مريضات مطابقة</p>
            <p className="mt-1 text-xs text-slate-400">غيّري البحث أو أضيفي مريضة جديدة</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <article key={p.id} className="ob-card overflow-hidden">
              {/* شريط الحالة */}
              <div
                className={`h-1.5 ${
                  p.risk.cls === 'rose'
                    ? 'bg-rose-400'
                    : p.risk.cls === 'amber'
                      ? 'bg-amber-400'
                      : p.st.pregnant
                        ? 'bg-pink-300'
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
                  {p.st.pregnant && (
                    <span className="ob-chip !border-pink-200 !bg-pink-50 !text-pink-700">
                      <Baby size={11} />
                      {gaLabel(p.st.ga)}
                    </span>
                  )}
                </div>

                {/* تفاصيل宛若ية */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.ob && (
                    <>
                      <span className="ob-chip">
                        <Droplets size={10} />
                        {p.ob.blood_group ? `فصيلة ${p.ob.blood_group}${p.ob.rh ? ` (${p.ob.rh === 'NEGATIVE' ? '−' : '+'})` : ''}` : 'فصيلة غير محددة'}
                      </span>
                      <span className="ob-chip">{gpaLabel(p.ob.gravida, p.ob.para, p.ob.abortions)} (G-P-A)</span>
                    </>
                  )}
                  {p.risk.cls !== 'slate' && (
                    <span
                      className={`ob-chip ${
                        p.risk.cls === 'rose'
                          ? '!border-rose-200 !bg-rose-50 !text-rose-700'
                          : p.risk.cls === 'amber'
                            ? '!border-amber-200 !bg-amber-50 !text-amber-700'
                            : '!border-emerald-200 !bg-emerald-50 !text-emerald-700'
                      }`}
                    >
                      {p.risk.label}
                    </span>
                  )}
                  {p.st.edd && <span className="ob-chip">الولادة المتوقعة {formatDateShort(p.st.edd)}</span>}
                </div>

                {/* آخر زيارة والمتابعة */}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                  <span>آخر زيارة: {lastVisit[p.id] ? formatDateShort(lastVisit[p.id]) : '—'}</span>
                  {nextFollowUp[p.id] && <span>المتابعة: {formatDateShort(nextFollowUp[p.id])}</span>}
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

      {/* ===== نافذة إضافة مريضة ===== */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="مريضة جديدة"
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
