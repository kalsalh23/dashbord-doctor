// date / time / number formatting helpers (Arabic labels, latin digits)

export function toLocalISO(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

export const todayStr = () => toLocalISO(new Date())

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(str, n) {
  const d = parseDate(str)
  d.setDate(d.getDate() + n)
  return toLocalISO(d)
}

export function getWeekday(dateStr) {
  return parseDate(dateStr).getDay()
}

const longFmt = new Intl.DateTimeFormat('ar-u-nu-latn', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
export function formatDateLong(dateStr) {
  return longFmt.format(parseDate(dateStr))
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return d + '/' + m + '/' + y
}

const BASE_SUNDAY = new Date(2024, 0, 7) // a Sunday
export function weekdayName(idx) {
  const d = new Date(BASE_SUNDAY)
  d.setDate(d.getDate() + idx)
  return new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long' }).format(d)
}

export function isToday(dateStr) {
  return dateStr === todayStr()
}

export function isTomorrow(dateStr) {
  return dateStr === addDays(todayStr(), 1)
}

export function dayLabel(dateStr) {
  if (isToday(dateStr)) return 'اليوم'
  if (isTomorrow(dateStr)) return 'غدًا'
  return formatDateLong(dateStr)
}

// ---- time helpers (naive "HH:MM" strings, clinic local time) ----
export function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minToTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

export function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const time = minToTime(d.getHours() * 60 + d.getMinutes())
  return formatDateShort(toLocalISO(d)) + ' · ' + time
}

export function ageFrom(dob) {
  if (!dob) return null
  const d = parseDate(String(dob).slice(0, 10))
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export function money(n, currency) {
  const v = Number(n || 0).toLocaleString('en-US')
  return currency ? v + ' ' + currency : v
}

// normalize local phone to international digits for wa.me links
export function normalizePhone(phone, countryCode) {
  let p = String(phone || '').replace(/\D/g, '')
  const cc = String(countryCode || '').replace(/\D/g, '')
  if (p.startsWith('00')) p = p.slice(2)
  if (cc && p.startsWith('0')) p = cc + p.slice(1)
  return p
}

export function patientInitial(name) {
  return (name || '؟').trim().charAt(0)
}

export function genderLabel(g) {
  if (g === 'male') return 'ذكر'
  if (g === 'female') return 'أنثى'
  return '—'
}
