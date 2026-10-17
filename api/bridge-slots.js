// فتحات الحجز الجاهزة للمنصة — بنفس منطق لوحة الطبيب تماماً
// تُرجع كل فتحات اليوم مع حالتها: available | taken | past | closed
// بها يُظهر تطبيق دليلك الوقت المنقضي (تجاوزه الوقت الفعلي) رمادياً غير قابل للحجز
import { createClient } from '@supabase/supabase-js'

const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-bridge-secret')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true })
  if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
  if (!SUPABASE_URL || !SUPABASE_ANON) return json(res, 500, { error: 'supabase env missing' })

  const secret = (req.query && req.query.secret) || req.headers['x-bridge-secret'] || ''
  const clinicId = (req.query && req.query.clinic_id) || ''
  const date = (req.query && req.query.date) || ''
  // الوقت الحالي عند المستخدم بالدقائق (يُرسله التطبيق لضبط دقّة «المنقضي»)
  const nowMin = Number((req.query && req.query.now_minutes) || 0)

  if (secret !== BRIDGE_SECRET) return json(res, 401, { error: 'unauthorized' })
  if (!clinicId) return json(res, 400, { error: 'clinic_id required' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res, 400, { error: 'date required (YYYY-MM-DD)' })

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON)
  const { data, error } = await sb.rpc('bridge_available_slots', {
    p_secret: BRIDGE_SECRET,
    p_clinic_id: clinicId,
    p_date: date,
  })
  if (error) return json(res, 500, { error: error.message })
  if (data?.error) return json(res, 400, data)

  // الوقت الفعلي: الأولوية لوقت المستخدم المُرسل، ثم توقيت دمشق، ثم UTC
  let nowMinutes = nowMin
  if (!nowMinutes) {
    const t = new Date().toLocaleString('en-US', { timeZone: 'Asia/Damascus', hour12: false, hour: '2-digit', minute: '2-digit' })
    const [hh, mm] = t.split(':').map(Number)
    nowMinutes = (hh || 0) * 60 + (mm || 0)
  }
  const isToday = date === new Date().toLocaleString('en-CA', { timeZone: 'Asia/Damascus' }).slice(0, 10)

  const slots = (data.slots || []).map((s) => {
    let status = s.status
    if (status === 'available' && isToday) {
      const [hh, mm] = String(s.time).split(':').map(Number)
      if ((hh * 60 + mm) <= nowMinutes) status = 'past'
    }
    return { ...s, status }
  })

  const summary = {
    available: slots.filter((s) => s.status === 'available').length,
    taken: slots.filter((s) => s.status === 'taken').length,
    past: slots.filter((s) => s.status === 'past').length,
  }

  return json(res, 200, {
    clinic_id: clinicId,
    date,
    closed: !!data.closed,
    reason: data.reason || null,
    work_start: data.work_start || null,
    work_end: data.work_end || null,
    slot_minutes: data.slot_minutes || 10,
    slots,
    summary,
    server_now: { minutes: nowMinutes, is_today: isToday },
  })
}
