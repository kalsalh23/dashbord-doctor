import { useEffect, useState } from 'react'
import { MessageCircle, Check } from 'lucide-react'
import { Modal, Button, Textarea } from './ui'
import { useApp, audit } from '../lib/store'
import { supabase } from '../lib/supabase'
import { normalizePhone, isToday, isTomorrow, formatDateShort } from '../lib/format'
import { friendlyDbError } from '../lib/hooks'

/**
 * Reminder: builds a WhatsApp message from the clinic template,
 * opens wa.me and records reminder_sent_at.
 */
export default function ReminderModal({ open, onClose, appointment, onSent }) {
  const { profile, settings, toast } = useApp()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open || !appointment || !settings) return
    const tpl = settings.reminder_template || ''
    const when = isToday(appointment.appointment_date) ? 'اليوم' : isTomorrow(appointment.appointment_date) ? 'غدًا' : `يوم ${formatDateShort(appointment.appointment_date)}`
    const msg = tpl
      .replaceAll('{patient}', appointment.patient?.full_name || '')
      .replaceAll('{doctor}', settings.doctor_name || profile?.clinic?.name || '')
      .replaceAll('{when}', when)
      .replaceAll('{time}', appointment.start_time?.slice(0, 5) || '')
    setMessage(msg)
  }, [open, appointment, settings, profile])

  if (!appointment) return null

  const openWhatsApp = () => {
    const phone = normalizePhone(appointment.patient?.phone, settings?.whatsapp_country_code)
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
  }

  const markSent = async () => {
    setSending(true)
    const { error } = await supabase
      .from('appointments')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', appointment.id)
    setSending(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'reminder_sent', 'appointments', appointment.id)
    toast('success', 'تم إرسال التذكير')
    onSent?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تذكير المريض"
      subtitle={appointment.patient?.full_name + ' — ' + appointment.patient?.phone}
      footer={
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={openWhatsApp}>
            <MessageCircle size={16} />
            فتح واتساب
          </Button>
          <Button variant="success" onClick={markSent} loading={sending}>
            <Check size={16} />
            تم الإرسال
          </Button>
        </div>
      }
    >
      <p className="label-base">نص الرسالة (قابل للتعديل)</p>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        يتم فتح واتساب برسالة جاهزة على رقم المريض، ثم اضغط «تم الإرسال» لتسجيل التذكير في النظام.
      </p>
    </Modal>
  )
}
