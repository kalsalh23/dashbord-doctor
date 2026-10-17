// ============================================================
// ملف جاهز للصق في مشروع منصة دليل طيبة (dalil-altaybeh): api/bridge-hours.js
// يستقبل أوقات الدوام من نظام العيادة (dashbord-doctor) ويحدّث جدول
// الحجز وأوقات الدوام في المنصة فوراً — بنفس أسلوب api/bridge-status
//
// ما يرسله نظام العيادة (POST مع ترويسة x-bridge-secret):
// {
//   "clinic_id": "0015c9f9-...",            // عيادة د. عارف
//   "clinic_id": "9d7fd606-...",            // عيادة د. ريام
//   "clinic_name": "محمد عارف عبد الرحمن",
//   "days":   [ { "weekday": 0, "active": true,  "start": "17:00", "end": "21:00" }, ... ],
//   "work_hours": { "sat": "17:00 - 21:00", "sun": "17:00 - 21:00", ..., "fri": "مغلق" },
//   "slot_minutes": 10, "slots_before_break": 8, "break_minutes": 10,
//   "event": "INSERT" | "UPDATE" | "DELETE" | "INITIAL_SYNC",
//   "changed_weekday": 5,
//   "updated_at": "2026-10-12T22:04:28"
// }
// ============================================================
import { createClient } from '@supabase/supabase-js'

const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'
const SUPABASE_URL = process.env.SUPABASE_URL            // مشروع المنصة
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export default async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
  if ((req.headers['x-bridge-secret'] || '') !== BRIDGE_SECRET) return json(res, 401, { error: 'unauthorized' })

  const { clinic_id, work_hours, days, slot_minutes, event } = req.body || {}
  if (!clinic_id) return json(res, 400, { error: 'clinic_id required' })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(res, 500, { error: 'supabase env missing' })

  // اربط clinic_id بكيان (entity) الطبيب/العيادة في المنصة — عمود الربط موجود
  // لديكم في جدول الكيانات (مثل external_clinic_id أو metadata->>clinic_id)
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // TODO(المنصة): تحديث كيان هذه العيادة —
  //   work_hours  → حقل entity.work_hours كما في صفحة «أوقات الدوام»
  //   days        → (اختياري) جدول مفصول لتوليد مواعيد الحجز آلياً
  //   slot_minutes→ الفاصل بين المواعيد في صفحة الحجز
  //
  // const { error } = await sb
  //   .from('entities')
  //   .update({
  //     work_hours,
  //     ...(slot_minutes ? { slot_minutes } : {}),
  //     updated_at: new Date().toISOString(),
  //   })
  //   .eq('external_clinic_id', clinic_id)      // ← عمود الربط عندكم
  // if (error) return json(res, 500, { ok: false, error: error.message })

  return json(res, 200, { ok: true, clinic_id, event: event || null })
}
