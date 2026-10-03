import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, CalendarDays, Stethoscope, FolderOpen, History } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Badge, APPT_STATUS, Button, EmptyState, SkeletonRows, Avatar, Tabs, PageHeader } from '../../components/ui'
import LastVisitModal from '../../components/LastVisitModal'
import { useSchedules } from '../../lib/hooks'
import { todayStr, addDays, formatDateLong, dayLabel, timeToMin, getWeekday, weekdayName } from '../../lib/format'
import { slotsForDay } from '../../lib/slots'

export default function Schedule() {
  const { profile, toast } = useApp()
  const [schedules] = useSchedules()
  const [date, setDate] = useState(todayStr())
  const [appts, setAppts] = useState(null)
  const [filter, setFilter] = useState('all') // all = active (not examined), done = completed/cancelled
  const [dayCounts, setDayCounts] = useState({})
  const [lastVisitFor, setLastVisitFor] = useState(null)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('appointments')
      .select('id, patient_id, appointment_date, start_time, end_time, status, patient:patients(id, full_name, phone, date_of_birth)')
      .eq('clinic_id', profile.clinic_id)
      .eq('appointment_date', date)
      .order('start_time')
    setAppts(data || [])
  }, [profile?.clinic_id, date])

  useEffect(() => {
    load()
  }, [load])

  // appointment counts for the upcoming 14 days (day-strip badges)
  useEffect(() => {
    if (!profile?.clinic_id) return
    supabase
      .from('appointments')
      .select('appointment_date, status')
      .eq('clinic_id', profile.clinic_id)
      .gte('appointment_date', todayStr())
      .lte('appointment_date', addDays(todayStr(), 13))
      .not('status', 'in', '(cancelled,no_show)')
      .then(({ data }) => {
        const m = {}
        for (const a of data || []) m[a.appointment_date] = (m[a.appointment_date] || 0) + 1
        setDayCounts(m)
      })
  }, [profile?.clinic_id, appts])

  const strip = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(todayStr(), i)), [])

  const closed = useMemo(
    () => slotsForDay({ schedules, settings: null, dateStr: date }).closed && schedules.length > 0,
    [schedules, date]
  )

  const counts = useMemo(() => {
    const all = appts || []
    const active = all.filter((a) => ['confirmed', 'new', 'arrived', 'waiting'].includes(a.status))
    return {
      all: all.filter((a) => !['cancelled', 'no_show'].includes(a.status)).length,
      active: active.length,
      done: all.filter((a) => a.status === 'completed').length,
    }
  }, [appts])

  const shown = useMemo(() => {
    let list = appts || []
    if (filter === 'all') list = list.filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status))
    if (filter === 'done') list = list.filter((a) => ['completed', 'cancelled', 'no_show'].includes(a.status))
    return [...list].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  }, [appts, filter])

  const startConsult = (a) => nav(`/doctor/consultation/${a.id}`)

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="جدول مواعيدي"
        subtitle={formatDateLong(date)}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="icon" onClick={() => setDate((d) => addDays(d, -1))} aria-label="اليوم السابق">
              <ChevronRight size={16} />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => setDate((d) => addDays(d, 1))} aria-label="اليوم التالي">
              <ChevronLeft size={16} />
            </Button>
            <Button variant={date === todayStr() ? 'primary' : 'secondary'} size="sm" onClick={() => setDate(todayStr())}>
              اليوم
            </Button>
          </div>
        }
      />

      {/* day strip — prominent one-tap navigation across 14 days */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1.5">
        {strip.map((d) => {
          const selected = d === date
          const count = dayCounts[d] || 0
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`flex h-[68px] w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
                selected
                  ? 'border-primary-700 bg-primary-700 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300'
              }`}
            >
              <span className={`text-[10px] font-semibold ${selected ? 'text-primary-100' : 'text-slate-400'}`}>
                {weekdayName(getWeekday(d))}
              </span>
              <span className="text-lg font-bold leading-6">{Number(d.slice(8, 10))}</span>
              <span
                className={`min-w-4 rounded-full px-1 text-[9px] font-bold ${
                  count > 0
                    ? selected
                      ? 'bg-white text-primary-800'
                      : 'bg-primary-100 text-primary-800'
                    : 'bg-transparent text-slate-300'
                }`}
              >
                {count > 0 ? count : '·'}
              </span>
            </button>
          )
        })}
      </div>

      {/* precise date jump */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">انتقال لتاريخ محدد:</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="input-base !w-auto" />
      </div>

      <div className="mb-4">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'الكل', count: counts.all - counts.done },
            { value: 'done', label: 'المنتهية', count: counts.done },
          ]}
        />
      </div>

      <Card bodyClass="!p-0">
        {appts === null ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : closed && shown.length === 0 ? (
          <EmptyState icon={CalendarDays} title="العيادة مغلقة في هذا اليوم" message="هذا اليوم ليس من أيام العمل المحددة في إعدادات العيادة" />
        ) : shown.length === 0 ? (
          <EmptyState icon={CalendarDays} title="لا توجد مواعيد" message={`${dayLabel(date)} لا يحتوي مواعيد في هذه القائمة`} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <div className="w-14 shrink-0 text-center">
                  <span className="block text-base font-bold leading-6 text-slate-800" dir="ltr">{a.start_time?.slice(0, 5)}</span>
                  <span className="block text-[10px] text-slate-400" dir="ltr">{a.end_time?.slice(0, 5)}</span>
                </div>
                <Avatar name={a.patient?.full_name} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                  <p className="text-[11px] text-slate-400" dir="ltr">{a.patient?.phone}</p>
                </div>
                <Badge map={APPT_STATUS} value={a.status} />
                <button
                  onClick={() => setLastVisitFor(a.patient)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200"
                >
                  <History size={13} />
                  آخر زيارة
                </button>
                <button
                  onClick={() => startConsult(a)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  <Stethoscope size={13} />
                  بدء الكشف
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <LastVisitModal open={!!lastVisitFor} onClose={() => setLastVisitFor(null)} patient={lastVisitFor} />

      {closed && (
        <p className="mt-3 text-[11px] text-slate-400">
          أيام العمل تُضبط من إعدادات العيادة.
        </p>
      )}
    </div>
  )
}
