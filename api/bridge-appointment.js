// جسر استقبال طلبات المواعيد من منصة دليل طيبة الإمام الطبي
// الطلب يصل صندوق «الطلبات الواردة» (لا يدخل المواعيد قبل قبول الاستقبال)
// + إشعار خارجي (web-push) فوري لكل موظف فعّل الإشعارات في العيادة
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

  const { platform_ref, patient_name, patient_phone, requested_date, day_label, preferred_time, note, clinic_id, doctor_name } = req.body || {}
  if (!platform_ref || !patient_name || !patient_phone) {
    return json(res, 400, { error: 'missing fields' })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await sb.rpc('bridge_create_appointment', {
    p_secret: BRIDGE_SECRET,
    p_platform_ref: platform_ref,
    p_patient_name: patient_name,
    p_patient_phone: patient_phone,
    p_requested_date: requested_date || null,
    p_day_label: day_label || null,
    p_preferred_time: preferred_time || null,
    p_note: note || null,
    p_clinic_id: clinic_id || null,
    p_doctor_name: doctor_name || null,
  })
  if (error) return json(res, 500, { ok: false, error: error.message })
  if (data?.error) return json(res, 400, { ok: false, error: data.error })
  if (data?.duplicate) return json(res, 200, { ok: true, duplicate: true })

  // الإشعار الخارجي: لكل موظف فعّل الإشعارات في هذه العيادة
  let notified = 0
  const clinicId = data?.clinic_id
  if (clinicId) {
    const t = await sb.rpc('bridge_staff_targets', { p_secret: BRIDGE_SECRET, p_clinic_id: clinicId })
    const targets = t.data?.targets || []
    if (targets.length && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const payload = JSON.stringify({
        title: 'طلب موعد جديد من دليل طيبة الإمام',
        body: `${patient_name} — ${day_label || ''} ${preferred_time || ''}`.trim(),
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
      // تنظيف اشتراكات الموظفين الميتة
      for (const ep of dead) {
        await sb.rpc('staff_push_unregister', { p_endpoint: ep })
      }
    }
  }

  return json(res, 200, { ok: true, inbox: true, notified })
}
