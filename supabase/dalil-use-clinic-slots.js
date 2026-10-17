// ============================================================
// ملف جاهز للصق في مشروع منصة «دليلك الطبي» (dalil-altaybeh)
// المسار: lib/clinicSlots.js  (+  hooks/useClinicSlots.js)
//
// يحل مشكلة تباعد المواعيد: كانت المنصة تولّد الفتحات بفواصل 15 دقيقة ثابتة.
// الآن تُجلب الفواصل من نظام العيادة (slot_minutes = 10 لد. عارف ود. ريام)
// فتظهر المواعيد بنفس تباعد لوحة الطبيب تماماً: 17:00 · 17:10 · 17:20 …
// ============================================================

const BRIDGE_BASE = 'https://dashbord-doctor.vercel.app'
const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'

// الافتراضي إن لم تُعدّ العيادة إعداداتها — 10 دقائق مثل لوحة الطبيب
const DEFAULT_SLOT_MINUTES = 10
const DEFAULT_SLOTS_BEFORE_BREAK = 8
const DEFAULT_BREAK_MINUTES = 10

/** توليد فتحات اليوم بنفس منطق لوحة الطبيب (فواصل + استراحة تلقائية) */
export function buildClinicSlots({ workStart, workEnd, slotMinutes, slotsBeforeBreak, breakMinutes }) {
  const sm = Number(slotMinutes) > 0 ? Number(slotMinutes) : DEFAULT_SLOT_MINUTES
  const before = Number(slotsBeforeBreak) > 0 ? Number(slotsBeforeBreak) : DEFAULT_SLOTS_BEFORE_BREAK
  const brk = Number(breakMinutes) >= 0 ? Number(breakMinutes) : DEFAULT_BREAK_MINUTES
  const toMin = (t) => {
    const [h, m] = String(t || '0:0').split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  const start = toMin(workStart)
  const end = toMin(workEnd)
  const out = []
  let cur = start
  let count = 0
  while (cur + sm <= end) {
    out.push({ time: toTime(cur), start: cur })
    cur += sm
    count++
    if (before > 0 && brk > 0 && count === before) {
      cur += brk // استراحة تلقائية بين كل 8 مواعيد
      count = 0
    }
  }
  return out
}

/**
 * جلب إعدادات العيادة + أوقات الدوام (لتوليد الفتحات محلياً إن أردت)
 * ← تُرجع slot_minutes الحقيقي للعيادة (10 دقائق)
 */
export async function fetchClinicConfig(clinicId) {
  const url = `${BRIDGE_BASE}/api/bridge-hours?secret=${encodeURIComponent(BRIDGE_SECRET)}&clinic_id=${encodeURIComponent(clinicId)}`
  const r = await fetch(url)
  const j = await r.json()
  if (!j || j.error) return null
  return {
    slotMinutes: Number(j.slot_minutes) || DEFAULT_SLOT_MINUTES,
    slotsBeforeBreak: Number(j.slots_before_break) || DEFAULT_SLOTS_BEFORE_BREAK,
    breakMinutes: Number(j.break_minutes) ?? DEFAULT_BREAK_MINUTES,
    days: j.days || [],
    workHours: j.work_hours || {},
    closedDays: (j.days || []).filter((d) => !d.active).map((d) => d.weekday),
  }
}

/**
 * ✅ الطريقة المفضّلة: الفتحات الجاهزة من نظام العيادة
 * الفواصل والحالات (متاح/محجوز/منقضي) كلها محسوبة هناك — بنفس منطق لوحة الطبيب
 */
export async function fetchClinicSlots(clinicId, date) {
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const url =
    `${BRIDGE_BASE}/api/bridge-slots` +
    `?secret=${encodeURIComponent(BRIDGE_SECRET)}` +
    `&clinic_id=${encodeURIComponent(clinicId)}` +
    `&date=${encodeURIComponent(date)}` +
    `&now_minutes=${nowMinutes}`
  const r = await fetch(url)
  const j = await r.json()
  if (!j || j.error) return { ok: false, error: j?.error || 'تعذّر تحميل الأوقات', slots: [] }
  return { ok: true, closed: !!j.closed, slots: j.slots || [], reason: j.reason || null, summary: j.summary || null }
}

/**
 * طريقة بديلة: ابنِ الفتحات محلياً من الأوقات المحجوزة (لو أبقيت نظامك القديم)
 * ← تستخدم slot_minutes القادم من العيادة (10) لا 15 ثابتة
 */
export async function buildSlotsFromTakenTimes(clinicId, date) {
  const cfg = await fetchClinicConfig(clinicId)
  if (!cfg) return { ok: false, slots: [] }
  const wd = new Date(date + 'T00:00:00').getDay()
  const day = cfg.days.find((d) => Number(d.weekday) === wd)
  if (!day || !day.active) return { ok: true, closed: true, slots: [] }

  const takenRes = await fetch(
    `${BRIDGE_BASE}/api/bridge-taken-slots?secret=${encodeURIComponent(BRIDGE_SECRET)}` +
      `&clinic_id=${encodeURIComponent(clinicId)}&date=${encodeURIComponent(date)}`
  )
  const takenJson = await takenRes.json()
  const taken = new Set(takenJson.times || [])
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const isToday = date === new Date().toISOString().slice(0, 10)

  const slots = buildClinicSlots({
    workStart: day.start,
    workEnd: day.end,
    slotMinutes: cfg.slotMinutes,        // ← 10 من إعدادات العيادة
    slotsBeforeBreak: cfg.slotsBeforeBreak,
    breakMinutes: cfg.breakMinutes,
  }).map((s) => {
    let status = taken.has(s.time) ? 'taken' : 'available'
    if (status === 'available' && isToday && s.start <= nowMin) status = 'past'
    return { time: s.time, status }
  })

  return { ok: true, closed: false, slots }
}

// ============================================================
// الاستعمال في صفحة الحجز (React):
//
//   const [date, setDate] = useState(todayISO())
//   const [slots, setSlots] = useState([])
//   const [closed, setClosed] = useState(false)
//
//   useEffect(() => {
//     fetchClinicSlots(clinicId, date).then((r) => {
//       setClosed(r.closed)
//       setSlots(r.slots)      // [{ time: '17:00', status: 'available' }, ...] بفواصل 10 دقائق
//     })
//   }, [clinicId, date])
//
//   {closed && <p>العيادة مغلقة في هذا اليوم</p>}
//   <div className="grid grid-cols-4 gap-2">
//     {slots.map((s) => (
//       <button key={s.time} disabled={s.status !== 'available'} onClick={() => setTime(s.time)}
//         className={s.status === 'past' ? 'slot-past' : s.status === 'taken' ? 'slot-taken' : 'slot-free'}>
//         {s.time}{s.status === 'past' && <small>منقضٍ</small>}{s.status === 'taken' && <small>محجوز</small>}
//       </button>
//     ))}
//   </div>
// ============================================================
