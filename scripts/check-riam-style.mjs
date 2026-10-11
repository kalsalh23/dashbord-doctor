// تحقّق سريع من منطق الأسلوب + توليد المواعيد (10 دقائق بين كل موعد والذي يليه)
import { isNizarStyle } from '../src/lib/clinicStyle.js'

const timeToMin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// نفس منطق buildSlots في src/lib/slots.js
function buildSlots(cfg) {
  const slotMinutes = Number(cfg.slotMinutes) || 10
  const before = Number(cfg.slotsBeforeBreak) || 8
  const brk = Number(cfg.breakMinutes) || 0
  const start = timeToMin(cfg.start)
  const end = timeToMin(cfg.end)
  const slots = []
  let cur = start
  let count = 0
  while (cur + slotMinutes <= end) {
    slots.push({ start: minToTime(cur), end: minToTime(cur + slotMinutes) })
    cur += slotMinutes
    count++
    if (before > 0 && count === before && brk > 0) { cur += brk; count = 0 }
  }
  return slots
}

const RIAM = '9d7fd606-4635-4533-b59c-6a67b3d722ee'
const NIZAR = '7f521b29-25f7-45c0-a3db-1f5146698062'
const OTHER = '6ecf74fa-ed8c-4bb3-8505-cb096ef00a71'

let fail = 0
const check = (name, got, want) => {
  const ok = got === want
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name} => ${got}${ok ? '' : ` (متوقع ${want})`}`)
}

check('قالب نزار (settings)', isNizarStyle({ clinic_id: OTHER }, { prescription_template: 'nizar' }), true)
check('عيادة ريام (id)', isNizarStyle({ clinic_id: RIAM }, null), true)
check('عيادة أخرى', isNizarStyle({ clinic_id: OTHER }, null), false)
check('بلا عيادة', isNizarStyle(null, null), false)
check('ملف ريام + قالب rose', isNizarStyle({ clinic_id: RIAM }, { prescription_template: 'rose' }), true)

const slots = buildSlots({ start: '17:00', end: '21:00', slotMinutes: 10, slotsBeforeBreak: 8, breakMinutes: 0 })
check('عدد المواعيد اليومية', slots.length, 24)
const gaps = slots.slice(1).map((s, i) => timeToMin(s.start) - timeToMin(slots[i].start))
check('أقصى فاصل بين موعدين', Math.max(...gaps), 10)
check('أول موعد', slots[0].start, '17:00')
check('آخر موعد', slots[slots.length - 1].end, '21:00')

// استراحة كل 8 مواعيد (إعداد نزار) تبقى تعمل كما كانت
const withBreak = buildSlots({ start: '17:00', end: '21:00', slotMinutes: 10, slotsBeforeBreak: 8, breakMinutes: 10 })
check('مواعيد يوم دوام نزار (باستراحة)', withBreak.length, 22)
console.log(fail === 0 ? '\nنجح كل التحقق' : `\n${fail} فشل`)
process.exit(fail === 0 ? 0 : 1)
