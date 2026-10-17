// أوقات دوام عيادة — يستدعيها جسر منصة دليل طيبة (مفتاح مشترك)
// يعيد جدول الأسبوع الكامل + نفس شكل حقل work_hours في المنصة
// + إعدادات الفاصل بين المواعيد — لتُستخدم في جدول الحجز هناك
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
  const secret = (req.query && req.query.secret) || req.headers['x-bridge-secret'] || ''
  const clinicId = (req.query && req.query.clinic_id) || ''
  if (secret !== BRIDGE_SECRET) return json(res, 401, { error: 'unauthorized' })
  if (!clinicId) return json(res, 400, { error: 'clinic_id required' })
  if (!SUPABASE_URL || !SUPABASE_ANON) return json(res, 500, { error: 'supabase env missing' })

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await sb.rpc('bridge_clinic_hours', {
    p_secret: BRIDGE_SECRET,
    p_clinic_id: clinicId,
  })
  if (error) return json(res, 500, { error: error.message })
  if (data?.error) return json(res, 404, data)
  return json(res, 200, data)
}
