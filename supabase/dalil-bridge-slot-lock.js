// ============================================================
// جسر قفل الأوقات — يُستقبل في مشروع منصة «دليلك الطبي»
// (dalil-altaybeh)  ⟵  المسار: api/bridge-slot-lock.js
//
// يصل تلقائياً لكل حجز يدوي يُنشئه الطبيب/موظّف الاستقبال في لوحته
// فيُخفى الوقت فوراً من جدول حجز المنصة (قبل أن يسأل المرضى التاليون).
//
// ما يُرسله نظام العيادة (POST + الترويسة x-bridge-secret):
// {
//   "event": "APPOINTMENT_BOOKED" | "APPOINTMENT_CANCELLED",
//   "clinic_id": "0015c9f9-...",
//   "appointment_id": "…",
//   "appointment_date": "2026-10-21",
//   "start_time": "17:30",
//   "end_time": "17:40",
//   "status": "confirmed" | "cancelled" | …,
//   "updated_at": "2026-10-15T02:26:24"
// }
// ============================================================

const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'

// ذاكرة مؤقتة للأوقات المقفولة — استبدلها بجدول/KV في قاعدة المنصة
const locks = globalThis.__slotLocks || (globalThis.__slotLocks = new Map())

function key(clinicId, date, time) {
  return `${clinicId}|${date}|${time}`
}

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export default async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
  if ((req.headers['x-bridge-secret'] || '') !== BRIDGE_SECRET) return json(res, 401, { error: 'unauthorized' })

  const b = req.body || {}
  const { clinic_id, appointment_date, start_time, status, event } = b
  if (!clinic_id || !appointment_date || !start_time) return json(res, 400, { error: 'missing fields' })

  const cancelled =
    event === 'APPOINTMENT_CANCELLED' || status === 'cancelled' || status === 'no_show' || status === 'completed'
  const k = key(clinic_id, appointment_date, String(start_time).slice(0, 5))

  if (cancelled) {
    locks.delete(k)
    return json(res, 200, { ok: true, locked: false, time: String(start_time).slice(0, 5) })
  }

  locks.set(k, { clinic_id, appointment_date, time: String(start_time).slice(0, 5), status: status || 'confirmed', at: b.updated_at || new Date().toISOString() })
  return json(res, 200, { ok: true, locked: true, time: String(start_time).slice(0, 5) })
}

// استعلام مساعد لصفحات المنصة: هل الوقت مقفول؟
export function isSlotLocked(clinicId, date, time) {
  return locks.has(key(clinicId, date, String(time).slice(0, 5)))
}
