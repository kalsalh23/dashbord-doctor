// ============================================================
// جسر أوقات الدوام — يُستقبل في مشروع منصة «دليلك الطبي»
// (dalil-altaybeh)  ⟵  المسار: api/bridge-hours.js
//
// يعمل الآلي: أي تغيير في «أوقات دوامي» داخل نظام العيادة
// (dashbord-doctor) يُرسل الجدول إلى هذا الملف فوراً
// فيُحدَّث جدول الحجز وأوقات الدوام في المنصة.
//
// اليدوي: زر «مزامنة مع الدليل» داخل صفحة «أوقات دوامي»
// يرسل نفس الطلب (event: SYNC) — يعمل حتى لو تأخر الآلي.
//
// ما يُرسله نظام العيادة (POST + الترويسة x-bridge-secret):
// {
//   "clinic_id": "0015c9f9-c90e-496e-a65b-2ad04a85be8e",
//   "clinic_name": "محمد عارف عبد الرحمن",
//   "days": [ { "weekday": 0, "active": true, "start": "17:00", "end": "21:00" }, ... ],
//   "work_hours": { "sun": "17:00 - 21:00", ..., "fri": "مغلق" },
//   "slot_minutes": 10, "slots_before_break": 8, "break_minutes": 10,
//   "event": "INSERT" | "UPDATE" | "DELETE" | "SYNC",
//   "updated_at": "2026-10-15T02:26:24"
// }
// ============================================================

const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'

// أسماء الأيام في حقل work_hours (0=الأحد ... 6=السبت)
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

// ---------- تخزين الجدول في المنصة ----------
// ✏️ عدّل هذا الجزء ليطابق جدول المنصة (الجدول/الحقول أدناه مقترحة)
//    أو اربطه بـ KV/Redis/قاعدة بيانات المنصة.
// مقترح: جدول clinic_hours (clinic_id text primary key, work_hours jsonb,
//        days jsonb, slot_minutes int, slots_before_break int, break_minutes int,
//        updated_at timestamptz default now())
const store = globalThis.__clinicHoursStore || (globalThis.__clinicHoursStore = new Map())

export default async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
  if ((req.headers['x-bridge-secret'] || '') !== BRIDGE_SECRET) return json(res, 401, { error: 'unauthorized' })

  const body = req.body || {}
  const { clinic_id, clinic_name, days, work_hours, slot_minutes, slots_before_break, break_minutes, event } = body
  if (!clinic_id) return json(res, 400, { error: 'clinic_id required' })
  if (!days || !Array.isArray(days) || days.length === 0) return json(res, 400, { error: 'days required' })

  // تطبيع الجدول: 7 أيام دائماً — الناقص يُعتبر مغلقاً
  const normalized = DAY_KEYS.map((key, weekday) => {
    const d = days.find((x) => Number(x.weekday) === weekday)
    const active = !!d && (d.active === true || d.active === 'true')
    const start = active && d.start ? String(d.start).slice(0, 5) : null
    const end = active && d.end ? String(d.end).slice(0, 5) : null
    return { weekday, active, start, end }
  })

  const record = {
    clinic_id: String(clinic_id),
    clinic_name: clinic_name ? String(clinic_name) : null,
    days: normalized,
    work_hours: work_hours && typeof work_hours === 'object' ? work_hours : {},
    slot_minutes: Number(slot_minutes) || 10,
    slots_before_break: Number(slots_before_break) || 8,
    break_minutes: Number(break_minutes) || 0,
    event: event ? String(event) : 'SYNC',
    updated_at: body.updated_at ? String(body.updated_at) : new Date().toISOString(),
  }

  try {
    store.set(record.clinic_id, record)
    return json(res, 200, { ok: true, stored: !!record.clinic_id, weekdays: normalized.length })
  } catch (e) {
    return json(res, 500, { error: 'store failed: ' + (e && e.message ? e.message : String(e)) })
  }
}

// ---------- قراءة الجدول (لتستخدمه صفحات المنصة) ----------
export async function getClinicHours(clinicId) {
  return store.get(String(clinicId)) || null
}
