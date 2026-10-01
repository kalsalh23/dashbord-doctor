import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Send, BellRing, Ban, UserX, FolderOpen, ArrowLeftCircle } from 'lucide-react'
import { Button, ConfirmDialog } from './ui'
import CheckInModal from './CheckInModal'
import ReminderModal from './ReminderModal'
import { useApp, audit, notify } from '../lib/store'
import { supabase } from '../lib/supabase'
import { friendlyDbError } from '../lib/hooks'
import { isToday, isTomorrow } from '../lib/format'

/**
 * Status-aware action buttons for one appointment row.
 * Owns its own modals (check-in, reminder, cancel confirm).
 * props: appt (with patient join), onChanged(), size, showOpen
 */
export default function AppointmentActions({ appt, onChanged, size = 'sm', showOpen = true }) {
  const { profile, toast } = useApp()
  const [checkIn, setCheckIn] = useState(false)
  const [reminder, setReminder] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  const openProfile = () => nav(`/reception/patients/${appt.patient_id}`)

  const transfer = async () => {
    setBusy(true)
    const { error } = await supabase.from('appointments').update({ status: 'waiting' }).eq('id', appt.id)
    setBusy(false)
    if (error) return toast('error', friendlyDbError(error))
    notify(
      profile.clinic_id,
      'doctor',
      'مريض جديد بانتظار الكشف',
      `${appt.patient?.full_name || ''} — موعد ${appt.start_time?.slice(0, 5)}`,
      'transfer',
      '/doctor',
      profile.id
    )
    audit(profile.clinic_id, 'transfer_to_doctor', 'appointments', appt.id)
    toast('success', 'تم نقل المريض إلى قائمة انتظار الطبيب')
    onChanged?.()
  }

  const markNoShow = async () => {
    setBusy(true)
    const { error } = await supabase.from('appointments').update({ status: 'no_show' }).eq('id', appt.id)
    setBusy(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'mark_no_show', 'appointments', appt.id)
    toast('info', 'تم تسجيل عدم الحضور')
    onChanged?.()
  }

  const cancel = async () => {
    setBusy(true)
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
    setBusy(false)
    setConfirmCancel(false)
    if (error) return toast('error', friendlyDbError(error))
    notify(
      profile.clinic_id,
      'doctor',
      'إلغاء موعد',
      `${appt.patient?.full_name || ''} ألغى موعد ${appt.appointment_date} الساعة ${appt.start_time?.slice(0, 5)}`,
      'cancellation',
      null,
      profile.id
    )
    audit(profile.clinic_id, 'cancel_appointment', 'appointments', appt.id)
    toast('success', 'تم إلغاء الموعد')
    onChanged?.()
  }

  const remindable = isToday(appt.appointment_date) || isTomorrow(appt.appointment_date)
  const s = size

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {appt.status === 'confirmed' && (
        <>
          <Button size={s} onClick={() => setCheckIn(true)}>
            <LogIn size={14} />
            تسجيل الوصول
          </Button>
          {!appt.reminder_sent_at && remindable && (
            <Button size={s} variant="secondary" onClick={() => setReminder(true)}>
              <BellRing size={14} />
              تذكير
            </Button>
          )}
          {appt.reminder_sent_at && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700">
              <BellRing size={12} />
              ذُكّر
            </span>
          )}
          <Button size={s} variant="ghost" onClick={markNoShow} disabled={busy} title="لم يحضر">
            <UserX size={14} />
          </Button>
        </>
      )}

      {(appt.status === 'arrived' || appt.status === 'waiting') && (
        <>
          {appt.status === 'arrived' && (
            <Button size={s} onClick={transfer} loading={busy}>
              <Send size={14} />
              نقل إلى الطبيب
            </Button>
          )}
        </>
      )}

      {(appt.status === 'confirmed' || appt.status === 'new' || appt.status === 'arrived' || appt.status === 'waiting') && (
        <Button size={s} variant="ghost" onClick={() => setConfirmCancel(true)} title="إلغاء الموعد">
          <Ban size={14} className="text-rose-500" />
        </Button>
      )}

      {showOpen && (
        <Button size={s} variant="ghost" onClick={openProfile} title="فتح ملف المريض">
          <FolderOpen size={14} />
        </Button>
      )}

      <CheckInModal
        open={checkIn}
        onClose={() => setCheckIn(false)}
        appointment={appt}
        onDone={onChanged}
      />
      <ReminderModal open={reminder} onClose={() => setReminder(false)} appointment={appt} onSent={onChanged} />
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="إلغاء الموعد"
        message={`هل تريد إلغاء موعد ${appt.patient?.full_name || ''} الساعة ${appt.start_time?.slice(0, 5)}؟`}
        confirmLabel="نعم، إلغاء الموعد"
        danger
        loading={busy}
        onConfirm={cancel}
      />
    </div>
  )
}
