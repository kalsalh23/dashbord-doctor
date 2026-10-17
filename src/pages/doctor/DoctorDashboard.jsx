import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stethoscope, CalendarDays, CalendarPlus, Siren } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, SkeletonRows, Avatar, Badge, APPT_STATUS, Modal, Field, Textarea, Toggle, ConfirmDialog } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import EmergencyApology from '../../components/EmergencyApology'
import { todayStr, timeToMin, nowMinutes, formatDateLong } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'

const SELECT = 'id, patient_id, appointment_date, start_time, end_time, status, updated_at, patient:patients(id, full_name, phone, date_of_birth, gender)'

export default function DoctorDashboard() {
  const { profile, settings, toast } = useApp()
  const isNizar = settings?.prescription_template === 'nizar'
  const [appts, setAppts] = useState(null)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [emergencyNote, setEmergencyNote] = useState('')
  const [emergencyCancel, setEmergencyCancel] = useState(true)
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [emergencyDone, setEmergencyDone] = useState(null)
  const [emergencyTargets, setEmergencyTargets] = useState(null) // { list, note, cancelled } — شاشة إرسال الاعتذار (نزار)
  const [bookingOpen, setBookingOpen] = useState(false)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('appointments')
      .select(SELECT)
      .eq('clinic_id', profile.clinic_id)
      .eq('appointment_date', todayStr())
      .in('status', ['arrived', 'waiting', 'in_consultation', 'confirmed'])
      .order('start_time')
    setAppts(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
    const t = setInterval(load, 45000)
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
    const count = typeof data === 'number' ? data : (data?.count ?? 0)
    audit(profile.clinic_id, 'emergency_broadcast', 'appointments', null, { notified: count })
    setEmergencyOpen(false)
    setEmergencyNote('')
    // شاشة إرسال الاعتذار الفعلي (SMS مجاني / واتساب) لكل العيادات حين يوجد مرضى متأثرون
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

  return (
    <div className="mx-auto max-w-4xl">
      {/* ============ ترويسة اليوم — ملخّص + إجراءات سريعة ============ */}
      <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="bg-gradient-to-l from-primary-50 via-primary-50/40 to-white px-4 py-4 sm:px-5">
          <p className="text-[11px] font-bold text-primary-700">{formatDateLong(todayStr())}</p>
          <h1 className="mt-0.5 truncate text-lg font-black text-slate-800 sm:text-xl">أهلاً د. {profile?.full_name}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {queue.length + current.length > 0
              ? `${queue.length + current.length} مريض نشط اليوم · ${current.length} قيد الكشف الآن · ${queue.length} في الانتظار`
              : 'لا يوجد مرضى نشطون الآن — ابدأ بحجز موعد'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3 sm:flex sm:items-center sm:p-4">
          {/* حجز موعد — متاح للطبيبة مباشرة من لوحتها */}
          <Button onClick={() => setBookingOpen(true)} className="justify-center sm:!w-auto">
            <CalendarPlus size={16} />
            حجز موعد
          </Button>
          {/* اختصاص الأنف والأذن والحنجرة: كشف برسومات تشريحية خاصة */}
          {(profile?.specialty_key || '') === 'ent' && (
            <Button variant="secondary" className="justify-center sm:!w-auto" onClick={() => nav('/doctor/consultation')}>
              <Stethoscope size={16} />
              كشف جديد
            </Button>
          )}
          <Button variant="secondary" className="justify-center sm:!w-auto" onClick={() => nav('/doctor/schedule')}>
            <CalendarDays size={16} />
            جدول المواعيد
          </Button>
          <Button
            variant="dangerGhost"
            className="justify-center sm:!w-auto"
            onClick={() => setEmergencyOpen(true)}
            disabled={todayCount === 0}
            title={todayCount === 0 ? 'لا توجد مواعيد اليوم' : 'إشعار جماعي لمرضى اليوم'}
          >
            <Siren size={16} />
            حالة إسعافية
          </Button>
        </div>
      </section>

      {/* ============ قيد الكشف الآن — الأهم، يظهر أولاً ============ */}
      {current.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Stethoscope size={15} />
            </span>
            قيد الكشف الآن
          </h2>
          <div className="space-y-2.5">
            {current.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-primary-200 bg-primary-50/70 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={a.patient?.full_name} className="h-11 w-11 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                    <p className="text-[11px] text-slate-500">موعد {a.start_time?.slice(0, 5)}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => nav(`/doctor/consultation/${a.id}`)}>
                  متابعة الكشف
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ مواعيد اليوم القادمة — قائمة العمل الواضحة ============ */}
      <section>
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
        ) : upcoming.length === 0 ? (
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
          <Card bodyClass="!p-0">
            <ul className="divide-y divide-slate-100">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="w-12 shrink-0 text-center text-sm font-bold text-slate-700" dir="ltr">{a.start_time?.slice(0, 5)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{a.patient?.full_name}</span>
                  <Badge map={APPT_STATUS} value={a.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* نافذة حجز موعد — تُفتح من زرّ «حجز موعد» في ترويسة اللوحة */}
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onBooked={load} />

      {/* emergency broadcast */}
      <Modal
        open={emergencyOpen}
        onClose={() => !emergencyBusy && setEmergencyOpen(false)}
        title="حالة إسعافية طارئة"
        subtitle={`سيصل الإشعار لجميع مواعيد اليوم (${todayCount} مريض)`}
        footer={
          <div className="flex justify-start gap-2">
            <Button variant="danger" onClick={runEmergency} loading={emergencyBusy}>
              <Siren size={16} />
              إرسال الاعتذار الجماعي
            </Button>
            <Button variant="secondary" onClick={() => setEmergencyOpen(false)} disabled={emergencyBusy}>
              إلغاء
            </Button>
          </div>
        }
      >
        <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          سيُرسل اعتذار جماعي باسمك لكل مرضى اليوم عبر قنواتهم، مع طلب إعادة الحجز.
        </p>
        <p className="mb-3 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2.5 text-xs leading-relaxed text-primary-900">
          <b>مواعيد اليوم ستُلغى تلقائياً</b> — ولأنك لا تستقبل أحداً اليوم، تعود كل الأوقات إلى وضعها الأصلي
          <b> قابلة للحجز</b> فوراً لأي مريض آخر.
        </p>
        <Field label="نص إضافي (اختياري)" hint="مثال: الحالة إسعافية في المستشفى — سنرد عليكم لترتيب موعد بديل">
          <Textarea value={emergencyNote} onChange={(e) => setEmergencyNote(e.target.value)} rows={2} />
        </Field>
      </Modal>

      {/* شاشة إرسال الاعتذار — SMS مجاني / واتساب (تظهر فقط عند وجود مرضى متأثرين) */}
      <EmergencyApology
        open={!!emergencyTargets}
        onClose={() => setEmergencyTargets(null)}
        targets={emergencyTargets}
      />

      {/* احتياط: إشعار داخلي فقط أو لا يوجد مرضى */}
      <ConfirmDialog
        open={emergencyDone !== null}
        onClose={() => setEmergencyDone(null)}
        title="تم الإرسال بنجاح"
        message={`وصل الاعتذار لـ ${emergencyDone} مريض عبر قنواتهم${emergencyCancel ? '، وأُلغيت مواعيدهم اليوم لتحرير الأوقات' : ''}. أُرسل إشعار للاستقبال بالاتصال وترتيب إعادة الحجز.`}
        confirmLabel="حسناً"
        onConfirm={() => setEmergencyDone(null)}
      />
    </div>
  )
}