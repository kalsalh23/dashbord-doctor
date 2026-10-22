import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Baby, CalendarDays, CalendarHeart, ClipboardList, Flame,
  HeartPulse, Siren, Stethoscope, Users, Activity,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, SkeletonRows, Avatar, Badge, APPT_STATUS, Modal, Field, Textarea, Toggle, ConfirmDialog } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import EmergencyWhatsapp from '../../components/EmergencyWhatsapp'
import { todayStr, timeToMin, nowMinutes, formatDateLong, formatDateShort } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'
import { glucoseLabel, hba1cLabel, bmiOf, bmiLabel, bpLabel, endocrineAlerts, endocrineRiskLevel, ENDOCRINE_DEFAULT_CATALOG } from '../../lib/endocrine'

const SELECT = 'id, patient_id, appointment_date, start_time, end_time, status, updated_at, patient:patients(id, full_name, phone, date_of_birth, gender)'

/**
 * لوحة يوم عيادة الغدد والسكري — تصميم مستقل عن بقية العيادات:
 *   - ترويسة متدرّجة (حمر/برتقالي دافئ)
 *   - بطاقات مقياس السكر: آخر قراءة سكر + HbA1c + ضغط + BMI
 *   - قائمة الانتظار مع شارة سكر (طبيعي / مقدمات / مرتفع)
 *   - متابعات اليوم + تنبيهات مخاطر السكري
 */
export default function RandaDashboard() {
  const { profile, settings, toast } = useApp()
  const [appts, setAppts] = useState(null)
  const [endData, setEndData] = useState({}) // patientId -> endocrine data
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
      const en = row.specialty_data?.endocrine
      if (en && !map[row.patient_id]) map[row.patient_id] = en
    }
    setEndData(map)
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

  /** بطاقات مقياس السكر — من مواعيد اليوم ومن بيانات آخر كشف */
  const glucoseCards = useMemo(() => {
    const list = []
    const seen = new Set()
    for (const a of appts || []) {
      const pid = a.patient_id
      if (!pid || seen.has(pid)) continue
      const en = endData[pid]
      if (!en) continue
      seen.add(pid)
      const glucose = Number(en.blood_glucose)
      const gLabel = glucoseLabel(glucose)
      const hLabel = hba1cLabel(en.hba1c)
      const bmi = bmiOf(en.weight, en.height)
      const bLabel = bmiLabel(bmi)
      list.push({
        id: pid,
        name: a.patient?.full_name,
        time: a.start_time?.slice(0, 5),
        glucose,
        gLabel,
        hba1c: en.hba1c,
        hLabel,
        bmi,
        bLabel,
        risk: en ? endocrineRiskLevel(en) : { cls: 'slate', label: '—' },
      })
    }
    return list
  }, [appts, endData])

  /** المتابعات المستحقة خلال أسبوع */
  const dueFollowUps = useMemo(() => {
    const now = todayStr()
    return followUps
      .filter((f) => !f.suggested_date || f.suggested_date <= addDaysLocal(7))
      .slice(0, 8)
  }, [followUps])

  /** تنبيهات الخطر — من بيانات مرضى السكري المعروفين */
  const alerts = useMemo(() => {
    const out = []
    for (const [pid, en] of Object.entries(endData)) {
      const list = endocrineAlerts(en)
      for (const a of list) {
        if (a.tone === 'rose' || a.tone === 'amber') out.push({ ...a, patientId: pid })
      }
    }
    return out.slice(0, 6)
  }, [endData])

  return (
    <div className="mx-auto max-w-5xl">
      {/* ============ الترويسة ============ */}
      <section className="mb-4 px-4 py-5 sm:px-6">
        <div className="relative z-10">
          <p className="text-[11px] font-bold text-white/70">{formatDateLong(todayStr())}</p>
          <h1 className="mt-0.5 truncate text-lg font-black text-white sm:text-xl">
            أهلاً د. {profile?.full_name?.replace(/^د\.\s*/, '')}
          </h1>
          <p className="mt-1 text-xs text-white/80">
            {queue.length + current.length > 0
              ? `${queue.length + current.length} مريض نشط اليوم · ${current.length} قيد الكشف · ${queue.length} في الانتظار`
              : 'لا يوجد مرضى نشطون الآن — ابدئي بحجز موعد'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setBookingOpen(true)} className="!bg-white !text-primary-800 hover:!bg-primary-50">
              <CalendarDays size={15} />
              حجز موعد
            </Button>
            <Button size="sm" variant="secondary" onClick={() => nav('/doctor/consultation')} className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20">
              <Stethoscope size={15} />
              كشف جديد
            </Button>
            <Button size="sm" variant="secondary" onClick={() => nav('/doctor/schedule')} className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20">
              <Calendar size={15} />
              جدول المواعيد
            </Button>
            <Button size="sm" variant="dangerGhost" onClick={() => setEmergencyOpen(true)} disabled={todayCount === 0} className="!border-white/40 !bg-rose-500/80 !text-white hover:!bg-rose-500">
              <Siren size={15} />
              حالة إسعافية
            </Button>
          </div>
        </div>
      </section>

      {/* ============ بطاقات مقياس السكر ============ */}
      {glucoseCards.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Activity size={15} />
            </span>
            مرضى السكري — آخر قراءة
          </h2>
          <div className="ob-pill-nav !px-0">
            {glucoseCards.map((c) => (
              <button
                key={c.id}
                onClick={() => nav(`/doctor/patients/${c.id}`)}
                className={`randa-pill !border-2 ${
                  c.gLabel?.cls === 'rose'
                    ? '!border-rose-300 !bg-rose-50 !text-rose-700'
                    : c.gLabel?.cls === 'amber'
                      ? '!border-amber-300 !bg-amber-50 !text-amber-700'
                      : '!border-emerald-200 !bg-emerald-50 !text-emerald-700'
                }`}
              >
                <span className="ob-dot" style={{ background: c.gLabel?.cls === 'rose' ? '#e11d48' : c.gLabel?.cls === 'amber' ? '#d97706' : '#059669' }} />
                {c.name}
                <span className="block text-[11px] font-bold text-slate-600 mt-0.5">
                  سكر {c.glucose ?? '—'} · HbA1c {c.hba1c ?? '—'}
                </span>
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
              <div key={a.id} className="ob-card flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={a.patient?.full_name} className="h-11 w-11 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span dir="ltr" className="font-bold">{a.start_time?.slice(0, 5)}</span>
                      <Badge map={APPT_STATUS} value={a.status} />
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => nav(`/doctor/consultation/${a.id}`)} className="mt-2 shrink-0 sm:mt-0">
                  متابعة الكشف
                </Button>
              </div>
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
                message="أضيفي مريض جديد أو تفحّصي جدول الأيام القادمة"
                action={
                  <Button size="sm" onClick={() => setBookingOpen(true)}>
                    <Activity size={14} />
                    حجز موعد
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {[...queue, ...upcoming].map((a) => (
                <div key={a.id} className="ob-card flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={a.patient?.full_name} className="h-10 w-10 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span dir="ltr" className="font-bold">{a.start_time?.slice(0, 5)}</span>
                        <Badge map={APPT_STATUS} value={a.status} />
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => nav(`/doctor/consultation/${a.id}`)} className="mt-2 shrink-0 sm:mt-0">
                    시작한 الكشف
                  </Button>
                </div>
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
                        <span className="block truncate text-xs font-bold text-slate-700">{f.patient?.full_name || 'مريض'}</span>
                        <span className="block text-[10px] text-slate-400">
                          {f.suggested_date ? formatDateShort(f.suggested_date) : 'بلا تاريخ'}
                        </span>
                      </span>
                      <Calendar size={14} className="shrink-0 text-primary-500" />
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
                    <Flame size={13} className="mt-0.5 shrink-0 text-amber-600" />
                    <button onClick={() => nav(`/doctor/patients/${a.patientId}`)} className="text-start hover:underline">
                      {a.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onBooked={load} />

      <Modal
        open={emergencyOpen}
        onClose={() => !emergencyBusy && setEmergencyOpen(false)}
        title="حالة إسعافية طارئة"
        subtitle={`سيصل الإشعار لجميع مواعيد اليوم (${todayCount} مريض)`}
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
          سيُرسل اعتذار جماعي باسمك لكل مرضى اليوم عبر واتساب، مع طلب إعادة الحجز.
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
        message={`وصل الاعتذار لـ ${emergencyDone} مريض عبر واتساب. أُرسل إشعار للاستقبال بالاتصال وترتيب إعادة الحجز.`}
        confirmLabel="حسناً"
        onConfirm={() => setEmergencyDone(null)}
      />
    </div>
  )
}

/* تاريخ + n أيام */
function addDaysLocal(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
