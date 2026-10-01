// جسر استقبال طلبات المواعيد من منصة دليل طيبة الإمام الطبي
// المنصة ترسل الطلب هنا (بمفتاح مشترك) → يُنشأ مريض + موعد + إشعار داخلي
import { createClient } from '@supabase/supabase-js'

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

  const { platform_ref, patient_name, patient_phone, requested_date, day_label, preferred_time, note } = req.body || {}
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
  })
  if (error) return json(res, 500, { ok: false, error: error.message })
  if (data?.error) return json(res, 400, { ok: false, error: data.error })
  return json(res, 200, { ok: true, ...data })
}
