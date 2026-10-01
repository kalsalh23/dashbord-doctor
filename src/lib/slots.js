import { timeToMin, minToTime, getWeekday } from './format'

// Build the list of slots for a working session.
// cfg: { start, end, slotMinutes, slotsBeforeBreak, breakMinutes }
// Returns [{start:'17:00', end:'17:10'}, ...] with automatic breaks.
export function buildSlots(cfg) {
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
    if (before > 0 && count === before && brk > 0) {
      cur += brk
      count = 0
    }
  }
  return slots
}

export function activeSchedule(schedules, dateStr) {
  if (!dateStr) return null
  const wd = getWeekday(dateStr)
  return (schedules || []).find((s) => s.weekday === wd && s.is_active) || null
}

// slots for a date given clinic config; closed=true when the clinic is off that day
export function slotsForDay({ schedules, settings, dateStr }) {
  const sched = activeSchedule(schedules, dateStr)
  if (!sched) return { closed: true, schedule: null, slots: [] }
  const slots = buildSlots({
    start: sched.start_time,
    end: sched.end_time,
    slotMinutes: settings?.slot_minutes ?? 10,
    slotsBeforeBreak: settings?.slots_before_break ?? 8,
    breakMinutes: settings?.break_minutes ?? 10,
  })
  return { closed: false, schedule: sched, slots }
}

// break ranges between slots (for rendering BREAK separators)
export function breakRanges(schedule, settings) {
  if (!schedule) return []
  const slotMinutes = Number(settings?.slot_minutes) || 10
  const before = Number(settings?.slots_before_break) || 8
  const brk = Number(settings?.break_minutes) || 0
  if (!brk || !before) return []
  const start = timeToMin(schedule.start_time)
  const end = timeToMin(schedule.end_time)
  const ranges = []
  let cur = start
  let count = 0
  while (cur + slotMinutes <= end) {
    cur += slotMinutes
    count++
    if (before > 0 && count === before && brk > 0) {
      ranges.push({ start: minToTime(cur), end: minToTime(cur + brk) })
      cur += brk
      count = 0
    }
  }
  return ranges
}
