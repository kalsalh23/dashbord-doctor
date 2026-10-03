// تأكيد الحجز الفوري: يستدعيه جسر المنصة عند حجز مواطن لوقت متاح
// يُنشئ المريض + الموعد المؤكد ذرياً (RPC) + إشعار خارجي للاستقبال
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export default async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
  const key = req.headers['x-bridge-secret'] || ''
  if (key !== BRIDGE_SECRET) return json(res, 401, { error: 'unauthorized' })
  if (!SUPABASE_URL || !SUPABASE_ANON) return json(res, 500, { error: 'supabase env missing' })

  const { platform_ref, clinic_id, doctor_name, patient_name, patient_phone, requested_date, time, note } = req.body || {}
  if (!patient_name || !patient_phone || !time) return json(res, 400, { error: 'missing fields' })

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await sb.rpc('bridge_confirm_appointment', {
    p_secret: BRIDGE_SECRET,
    p_platform_ref: platform_ref || null,
    p_clinic_id: clinic_id || null,
    p_doctor_name: doctor_name || null,
    p_patient_name: patient_name,
    p_patient_phone: patient_phone,
    p_requested_date: requested_date || null,
    p_time: time,
    p_note: note || null,
  })
  if (error) return json(res, 500, { ok: false, error: error.message })
  if (data?.error) return json(res, 409, { ok: false, error: data.error })

  // إشعار خارجي للاستقبال (موظفو العيادة المشتركون)
  let notified = 0
  const clinicId = data?.clinic_id
  if (clinicId) {
    const t = await sb.rpc('bridge_staff_targets', { p_secret: BRIDGE_SECRET, p_clinic_id: clinicId })
    const targets = t.data?.targets || []
    if (targets.length && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const payload = JSON.stringify({
        title: 'حجز موعد جديد من دليل طيبة الإمام',
        body: `${patient_name} — ${requested_date || ''} ${time}`.trim(),
        url: '/reception/appointments',
      })
      const dead = []
      for (const tg of targets) {
        try {
          await webpush.sendNotification(
            { endpoint: tg.endpoint, keys: tg.keys },
            payload,
            { vapidDetails: { subject: 'mailto:support@dalil-altaybeh.com', publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY } },
          )
          notified++
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410 || e.statusCode === 400) dead.push(tg.endpoint)
        }
      }
      for (const ep of dead) await sb.rpc('staff_push_unregister', { p_endpoint: ep })
    }
  }

  return json(res, 200, { ok: true, appointment_id: data?.appointment_id, notified })
}
