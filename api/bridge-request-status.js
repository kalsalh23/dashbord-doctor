// حالة طلب الحجز للمواطن — يستدعيها جسر منصة دليل طيبة (مفتاح مشترك)
// استقصاء مجاني داخل المتصفح: ترسل المنصة/المواطن هذا الطلب كل ثوانٍ
// وحين تتغيّر الحالة (new → confirmed/rejected) يُظهر التطبيق إشعاراً مجانياً
// عبر Web Notifications (إشعار خارجي) + إشعار داخلي في قائمة إشعارات المواطن.
import { createClient } from '@supabase/supabase-js'

const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // السماح للمنصة بقراءة النتيجة (CORS) — لا توجد بيانات حسّاسة في الاستجابة
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.end(JSON.stringify(body))
}

export default async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true })
  if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })

  const secret = (req.query && req.query.secret) || ''
  const platformRef = (req.query && req.query.platform_ref) || ''
  if (secret !== BRIDGE_SECRET) return json(res, 401, { error: 'unauthorized' })
  if (!platformRef) return json(res, 400, { error: 'platform_ref required' })
  if (!SUPABASE_URL || !SUPABASE_ANON) return json(res, 500, { error: 'supabase env missing' })

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await sb.rpc('bridge_request_status', {
    p_secret: BRIDGE_SECRET,
    p_platform_ref: platformRef,
  })

  if (error) return json(res, 500, { ok: false, error: error.message })
  if (data?.error) return json(res, 404, { ok: false, error: data.error })

  return json(res, 200, data)
}
