import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Baby, CalendarDays, CalendarPlus, CalendarHeart, ClipboardList, Flame,
  HeartPulse, Siren, Stethoscope, Users,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, SkeletonRows, Avatar, Badge, APPT_STATUS, Modal, Field, Textarea, Toggle, ConfirmDialog } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import EmergencyWhatsapp from '../../components/EmergencyWhatsapp'
import { todayStr, timeToMin, nowMinutes, formatDateLong, formatDateShort } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'
import { gaLabel, gestationalAge, obgynAlerts, pregnancyStatus, riskLevel } from '../../lib/obgyn'

const SELECT = 'id, patient_id, appointment_date, start_time, end_time, status, updated_at, patient:patients(id, full_name, phone, date_of_birth, gender)'

/**
 * لوحة يوم عيادة النساء والتوليد — تصميم مستقل عن بقية العيادات:
 *   - ترويسة متدرّجة
 *   - شريط الحالة: بطاقات الحوامل (أسبوع الحمل + الموعد المتوقع)
 *   - قائمة الانتظار مع شارة نوع الحالة (حامل / متابعة / كشف عادي)
 *   - متابعات الأسبوع + تنبيهات المخاطر
 */
export default function ObgynDashboard() {
  const { profile, settings, toast } = useApp()
  const [appts, setAppts] = useState(null)
  const [obData, setObData] = useState({}) // patientId -> obgyn data
  const [followUps, setFollowUps] = useState([])
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [emergencyNote, setEmergencyNote] = useState('')
  const [emergencyCancel, setEmergencyCancel] = useState(true)
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [emergencyDone, setEmergencyDone] = useState(null)
  const [emergencyTargets, setEmergencyTargets] = useState(null)
  const [bookingOpen, setBookingOpen] = useState(false)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const [a, v, f] = await Promise.all([
      supabase
        .from('appointments')
        .select(SELECT)
        .eq('clinic_id', profile.clinic_id)
        .eq('appointment_date', todayStr())
        .in('status', ['arrived', 'waiting', 'in_consultation', 'confirmed'])
        .order('start_time'),
      supabase
        .from('visits')
        .select('patient_id, visit_date, specialty_data')
        .eq('clinic_id', profile.clinic_id)
        .order('visit_date', { ascending: false })
        .limit(150),
      supabase
        .from('follow_up_requests')
        .select('*, patient:patients(id, full_name, phone)')
        .eq('clinic_id', profile.clinic_id)
        .in('status', ['pending', 'scheduled'])
        .order('suggested_date')
        .limit(40),
    ])
    setAppts(a.data || [])
    const map = {}
    for (const row of v.data || []) {
      const ob = row.specialty_data?.obgyn
      if (ob && !map[row.patient_id]) map[row.patient_id] = ob
    }
    setObData(map)
    setFollowUps(f.data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    window.addEventListener('focus', load)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', load)
    }
  }, [load])

  const runEmergency = async () => {
    setEmergencyBusy(true)
    const { data, error } = await supabase.rpc('emergency_broadcast', {
      p_note: emergencyNote.trim(),
      p_cancel: emergencyCancel,
    })
    setEmergencyBusy(false)
    if (error) return toast('error', friendlyDbError(error))
    const count = typeof data === 'number' ? data : data?.count ?? 0
    audit(profile.clinic_id, 'emergency_broadcast', 'appointments', null, { notified: count })
    setEmergencyOpen(false)
    setEmergencyNote('')
    if (Array.isArray(data?.list) && data.list.length > 0) {
      setEmergencyTargets({ list: data.list, note: emergencyNote.trim(), cancelled: emergencyCancel })
    } else {
      setEmergencyDone(count ?? 0)
    }
    load()
  }

  const queue = (appts || [])
    .filter((a) => ['arrived', 'waiting'].includes(a.status))
    .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  const current = (appts || []).filter((a) => a.status === 'in_consultation')
  const todayCount = (appts || []).filter((a) => !['cancelled', 'no_show'].includes(a.status)).length
  const upcoming = (appts || [])
    .filter((a) => (a.status === 'confirmed' || a.status === 'new') && timeToMin(a.start_time) >= nowMinutes())
    .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))

  /** بطاقات الحوامل — من مواعيد اليوم ومن بيانات آخر كشف */
  const pregnantChips = useMemo(() => {
    const list = []
    const seen = new Set()
    for (const a of appts || []) {
      const pid = a.patient_id
      if (!pid || seen.has(pid)) continue
      const ob = obData[pid]
      if (!ob?.lmp) continue
      const st = pregnancyStatus(ob)
      if (!st.pregnant) continue
      seen.add(pid)
      list.push({
        id: pid,
        name: a.patient?.full_name,
        ga: st.ga,
        edd: st.edd,
        risk: riskLevel({ ...ob, gestational_age: st.ga }),
      })
    }
    return list
  }, [appts, obData])

  /** المتابعات المستحقة خلال أسبوع */
  const dueFollowUps = useMemo(() => {
    const now = todayStr()
    return followUps
      .filter((f) => !f.suggested_date || f.suggested_date <= addDaysLocal(7))
      .slice(0, 8)
  }, [followUps])

  /** تنبيهات الخطر — من بيانات الحوامل المعروفات */
  const alerts = useMemo(() => {
    const out = []
    for (const [pid, ob] of Object.entries(obData)) {
      const list = obgynAlerts({ ...ob, gestational_age: gestationalAge(ob.lmp) })
      for (const a of list) {
        if (a.tone === 'rose' || a.tone === 'amber') out.push({ ...a, patientId: pid })
      }
    }
    return out.slice(0, 6)
  }, [obData])

  return (
    <div className="mx-auto max-w-5xl">
      {/* ============ الترويسة ============ */}
      <section className="ob-hero mb-4 px-4 py-5 sm:px-6">
        <div className="relative z-10">
          <p className="text-[11px] font-bold text-white/70">{formatDateLong(todayStr())}</p>
          <h1 className="mt-0.5 truncate text-lg font-black text-white sm:text-xl">
            أهلاً د. {profile?.full_name?.replace(/^د\.\s*/, '')}
          </h1>
          <p className="mt-1 text-xs text-white/80">
            {queue.length + current.length > 0
              ? `${queue.length + current.length} مريضة نشطة اليوم · ${current.length} قيد الكشف · ${queue.length} في الانتظار`
              : 'لا توجد مريضات نشطات الآن — ابدئي بحجز موعد'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setBookingOpen(true)} className="!bg-white !text-primary-800 hover:!bg-primary-50">
              <CalendarPlus size={15} />
              حجز موعد
            </Button>
            <Button size="sm" variant="secondary" onClick={() => nav('/doctor/consultation')} className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20">
              <Stethoscope size={15} />
              كشف جديد
            </Button>
            <Button size="sm" variant="secondary" onClick={() => nav('/doctor/schedule')} className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20">
              <CalendarDays size={15} />
              جدول المواعيد
            </Button>
            <Button size="sm" variant="dangerGhost" onClick={() => setEmergencyOpen(true)} disabled={todayCount === 0} className="!border-white/40 !bg-rose-500/80 !text-white hover:!bg-rose-500">
              <Siren size={15} />
              حالة إسعافية
            </Button>
          </div>
        </div>
      </section>

      {/* ============ شريط الحالة — الحوامل ============ */}
      {pregnantChips.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-100 text-pink-600">
              <Baby size={15} />
            </span>
            الحوامل اليوم
          </h2>
          <div className="ob-pill-nav !px-0">
            {pregnantChips.map((c) => (
              <button
                key={c.id}
                onClick={() => nav(`/doctor/patients/${c.id}`)}
                className={`ob-pill !border-2 ${
                  c.risk.cls === 'rose'
                    ? '!border-rose-300 !bg-rose-50 !text-rose-700'
                    : c.risk.cls === 'amber'
                      ? '!border-amber-300 !bg-amber-50 !text-amber-700'
                      : '!border-emerald-200 !bg-emerald-50 !text-emerald-700'
                }`}
              >
                <span className="ob-dot" style={{ background: c.risk.cls === 'rose' ? '#e11d48' : c.risk.cls === 'amber' ? '#d97706' : '#059669' }} />
                {c.name} — {gaLabel(c.ga)}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ============ قيد الكشف الآن ============ */}
      {current.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Stethoscope size={15} />
            </span>
            قيد الكشف الآن
          </h2>
          <div className="space-y-2.5">
            {current.map((a) => (
              <PatientCard
                key={a.id}
                appt={a}
                ob={obData[a.patient_id]}
                onOpen={() => nav(`/doctor/consultation/${a.id}`)}
                actionLabel="متابعة الكشف"
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ============ مواعيد اليوم ============ */}
        <section className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <CalendarDays size={15} />
              </span>
              مواعيد اليوم
            </h2>
            {upcoming.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => nav('/doctor/schedule')}>
                عرض الجدول
              </Button>
            )}
          </div>
          {!appts ? (
            <SkeletonRows rows={3} />
          ) : queue.length === 0 && upcoming.length === 0 ? (
            <Card>
              <EmptyState
                icon={CalendarDays}
                title="لا توجد مواعيد قادمة اليوم"
                message="احملي مريضة جديدة أو تفحّصي جدول الأيام القادمة"
                action={
                  <Button size="sm" onClick={() => setBookingOpen(true)}>
                    <CalendarPlus size={14} />
                    حجز موعد
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {[...queue, ...upcoming].map((a) => (
                <PatientCard
                  key={a.id}
                  appt={a}
                  ob={obData[a.patient_id]}
                  onOpen={() => nav(`/doctor/consultation/${a.id}`)}
                  actionLabel="بدء الكشف"
                />
              ))}
            </div>
          )}
        </section>

        {/* ============ الجانب: المتابعات والتنبيهات ============ */}
        <aside className="space-y-4">
          <Card title="متابعات مستحقة" subtitle="متابعات الأسبوع الحالي">
            {dueFollowUps.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">لا توجد متابعات مستحقة</p>
            ) : (
              <ul className="space-y-2">
                {dueFollowUps.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => nav(`/doctor/patients/${f.patient_id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-start hover:bg-primary-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-700">{f.patient?.full_name || 'مريضة'}</span>
                        <span className="block text-[10px] text-slate-400">
                          {f.suggested_date ? formatDateShort(f.suggested_date) : 'بلا تاريخ'}
                        </span>
                      </span>
                      <CalendarHeart size={14} className="shrink-0 text-primary-500" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="تنبيهات تحتاج انتباهاً">
            {alerts.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">لا توجد تنبيهات حالياً</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a, i) => (
                  <li
                    key={a.key + i}
                    className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                      a.tone === 'rose' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    <Flame size={13} className="mt-0.5 shrink-0" />
                    <button onClick={() => nav(`/doctor/patients/${a.patientId}`)} className="text-start hover:underline">
                      {a.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="روابط سريعة">
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => nav('/doctor/patients')}>
                <Users size={14} />
                المريضات
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nav('/doctor/archive')}>
                <ClipboardList size={14} />
                الأرشيف
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nav('/doctor/today-log')}>
                <HeartPulse size={14} />
                سجلي
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nav('/doctor/payments')}>
                <ClipboardList size={14} />
                الدفعات
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onBooked={load} />

      <Modal
        open={emergencyOpen}
        onClose={() => !emergencyBusy && setEmergencyOpen(false)}
        title="حالة إسعافية طارئة"
        subtitle={`سيصل الإشعار لجميع مواعيد اليوم (${todayCount} مريضة)`}
        footer={
          <div className="flex justify-start gap-2">
            <Button variant="danger" onClick={runEmergency} loading={emergencyBusy}>
              <Siren size={16} />
              إرسال الاعتذار عبر واتساب
            </Button>
            <Button variant="secondary" onClick={() => setEmergencyOpen(false)} disabled={emergencyBusy}>
              إلغاء
            </Button>
          </div>
        }
      >
        <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          سيُرسل اعتذار جماعي باسمك لكل مريضات اليوم عبر واتساب، مع طلب إعادة الحجز.
        </p>
        <Field label="نص إضافي (اختياري)">
          <Textarea value={emergencyNote} onChange={(e) => setEmergencyNote(e.target.value)} rows={2} />
        </Field>
      </Modal>

      <EmergencyWhatsapp open={!!emergencyTargets} onClose={() => setEmergencyTargets(null)} targets={emergencyTargets} />

      <ConfirmDialog
        open={emergencyDone !== null}
        onClose={() => setEmergencyDone(null)}
        title="تم الإرسال بنجاح"
        message={`وصل الاعتذار لـ ${emergencyDone} مريضة عبر واتساب. أُرسل إشعار للاستقبال بالاتصال وترتيب إعادة الحجز.`}
        confirmLabel="حسناً"
        onConfirm={() => setEmergencyDone(null)}
      />
    </div>
  )
}

/* ============================================================
 * بطاقة مريضة في القائمة — بشارة حمل/متابعة
 * ============================================================ */
function PatientCard({ appt, ob, onOpen, actionLabel }) {
  const st = pregnancyStatus(ob || {})
  const risk = ob ? riskLevel({ ...ob, gestational_age: st.ga }) : null
  return (
    <div className="ob-card flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={appt.patient?.full_name} className="h-11 w-11 text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">{appt.patient?.full_name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span dir="ltr" className="font-bold">{appt.start_time?.slice(0, 5)}</span>
            {st.pregnant && (
              <span className="ob-chip !border-pink-200 !bg-pink-50 !text-pink-700">
                <Baby size={10} />
                {gaLabel(st.ga)}
              </span>
            )}
            {risk && risk.cls !== 'emerald' && (
              <span className={`ob-chip ${risk.cls === 'rose' ? '!border-rose-200 !bg-rose-50 !text-rose-700' : '!border-amber-200 !bg-amber-50 !text-amber-700'}`}>
                {risk.label}
              </span>
            )}
            {!st.pregnant && <Badge map={APPT_STATUS} value={appt.status} />}
          </p>
        </div>
      </div>
      <Button size="sm" onClick={onOpen} className="mt-2 shrink-0 sm:mt-0">
        {actionLabel}
      </Button>
    </div>
  )
}

/* تاريخ + n أيام */
function addDaysLocal(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
