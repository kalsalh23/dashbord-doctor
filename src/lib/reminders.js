// ============================================================
// بناء رسائل المريض الثابتة (تذكير / اعتذار) — SMS مجاني بلا اشتراك
// كل رسالة مبنيّة على بيانات هذا المريض بالتحديد.
// ============================================================
import { formatDateLong } from './format'
import { smsHref, smsSegments } from './sms'

/** رقم هاتف صالح للإرسال (محلي أو دولي) */
export const validPhone = (phone) => String(phone || '').replace(/\D/g, '').length >= 9

/**
 * تذكير بموعد — رسالة ثابتة خاصة بكل مريض (اسمه وتاريخه ووقته والعيادة)
 */
export function reminderMessage({ patientName, date, time, clinicName, doctorName }) {
  const when = `${formatDateLong(date)} الساعة ${String(time || '').slice(0, 5)}`
  const place = clinicName || 'العيادة'
  const sign = doctorName ? ` — ${doctorName}` : ''
  return `عزيزي ${patientName || 'المريض'}، تذكير بموعدكم في ${place} يوم ${when}. نرجو الحضور قبل الموعد بعشر دقائق${sign}. شكراً.`
}

/** رابطSMS مجاني للتذكير (يفتح تطبيق الرسائل بالرسالة جاهزة) */
export function reminderSmsHref(p) {
  const body = reminderMessage({
    patientName: p.patient_name,
    date: p.appointment_date,
    time: p.start_time,
    clinicName: p.clinic_name,
    doctorName: p.doctor_name,
  })
  return { href: smsHref(p.phone, body), body }
}

/** عدد شرائح رسالة التذكير */
export function reminderSegments(p) {
  return smsSegments(
    reminderMessage({
      patientName: p.patient_name,
      date: p.appointment_date,
      time: p.start_time,
      clinicName: p.clinic_name,
      doctorName: p.doctor_name,
    }),
  )
}
