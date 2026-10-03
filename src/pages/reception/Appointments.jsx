import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, CalendarDays, Plus, PencilLine, Clock } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Badge, APPT_STATUS, Button, EmptyState, SkeletonRows, Avatar, Tabs } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import AppointmentActions from '../../components/AppointmentActions'
import { useSchedules } from '../../lib/hooks'
import { todayStr, addDays, formatDateLong, dayLabel, getWeekday, timeToMin } from '../../lib/format'
import { slotsForDay, breakRanges } from '../../lib/slots'

export default function Appointments() {
  const { profile, settings } = useApp()
  const [schedules] = useSchedules()
  const [date, setDate] = useState(todayStr())
  const [appts, setAppts] = useState(null)
  const [filter, setFilter] = useState('all')
  const [booking, setBooking] = useState(false)
  const [moving, setMoving] = useState(null)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('appointments')
      .select('id, patient_id, appointment_date, start_time, end_time, status, price, reminder_sent_at, patient:patients(id, full_name, phone)')
      .eq('clinic_id', profile.clinic_id)
      .eq('appointment_date', date)
      .order('start_time')
    setAppts(data || [])
  }, [profile?.clinic_id, date])

  useEffect(() => {
    load()
  }, [load])

  const day = useMemo(() => slotsForDay({ schedules, settings, dateStr: date }), [schedules, settings, date])

  const counts = useMemo(() => {
    const all = appts || []
    return {
      all: all.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show').length,
      waiting: all.filter((a) => ['arrived', 'waiting'].includes(a.status)).length,
      in_consultation: all.filter((a) => a.status === 'in_consultation').length,
      completed: all.filter((a) => a.status === 'completed').length,
      cancelled: all.filter((a) => ['cancelled', 'no_show'].includes(a.status)).length,
    }
  }, [appts])

  const filtered = useMemo(() => {
    let list = appts || []
    if (filter === 'active') list = list.filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status))
    if (filter === 'done') list = list.filter((a) => ['completed', 'cancelled', 'no_show'].includes(a.status))
    return [...list].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  }, [appts, filter])

  const breaks = breakRanges(day.schedule, settings)
  const bookedMap = useMemo(() => {
    const m = {}
    for (const a of appts || []) {
      if (!['cancelled', 'no_show'].includes(a.status)) m[a.start_time?.slice(0, 5)] = a
    }
    return m
  }, [appts])

  const isClosedDay = !day.closed && (day.slots || []).length === 0 && Object.keys(bookedMap).length === 0

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 sm:text-xl">المواعيد</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{formatDateLong(date)}</p>
        </div>
        <Button onClick={() => setBooking(true)}>
          <Plus size={16} />
          حجز موعد
        </Button>
      </div>

      {/* date navigator */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="icon" onClick={() => setDate((d) => addDays(d, -1))} aria-label="اليوم السابق">
          <ChevronRight size={16} />
        </Button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="input-base !w-auto" />
        <Button variant="secondary" size="icon" onClick={() => setDate((d) => addDays(d, 1))} aria-label="اليوم التالي">
          <ChevronLeft size={16} />
        </Button>
        <Button variant={date === todayStr() ? 'primary' : 'secondary'} size="sm" onClick={() => setDate(todayStr())}>
          اليوم
        </Button>
        <span className="ms-auto text-xs font-semibold text-slate-500">{dayLabel(date)}</span>
      </div>

      <div className="mb-4">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'الكل', count: counts.all },
            { value: 'active', label: 'النشطة', count: counts.all - counts.completed },
            { value: 'done', label: 'المنتهية', count: counts.completed + counts.cancelled },
          ]}
        />
      </div>

      <Card bodyClass="!p-0">
        {appts === null ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : isClosedDay && filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="العيادة مغلقة في هذا اليوم"
            message="لا توجد فترات عمل مجدولة — يمكن تعديلها من الإعدادات"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="لا توجد مواعيد"
            message="اختر يومًا آخر أو احجز موعدًا جديدًا"
            action={<Button size="sm" onClick={() => setBooking(true)}>حجز موعد</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((a) => {
              const showBreak = breaks.some((b) => b.start === a.start_time?.slice(0, 5))
              return (
                <li key={a.id}>
                  {showBreak && (
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-1.5">
                      <span className="h-px flex-1 bg-slate-200" />
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <Clock size={11} />
                        استراحة
                      </span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="w-14 shrink-0 text-center">
                      <span className="block text-base font-bold leading-6 text-slate-800" dir="ltr">{a.start_time?.slice(0, 5)}</span>
                      <span className="block text-[10px] text-slate-400" dir="ltr">{a.end_time?.slice(0, 5)}</span>
                    </div>
                    <Avatar name={a.patient?.full_name} className="h-9 w-9 text-xs" />
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => nav(`/reception/patients/${a.patient_id}`)}
                        className="block truncate text-sm font-bold text-slate-800 hover:text-primary-700"
                      >
                        {a.patient?.full_name}
                      </button>
                      <span className="text-[11px] text-slate-400" dir="ltr">{a.patient?.phone}</span>
                    </div>
                    <Badge map={APPT_STATUS} value={a.status} />
                    {['confirmed', 'new'].includes(a.status) && (
                      <Button size="sm" variant="ghost" onClick={() => setMoving(a)} title="تعديل / نقل الموعد">
                        <PencilLine size={14} />
                      </Button>
                    )}
                    <AppointmentActions appt={a} onChanged={load} showOpen={false} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {day.closed && schedules.length > 0 && (
        <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          تنبيه: هذا اليوم ليس من أيام العمل المحددة في الإعدادات.
        </p>
      )}

      <BookingModal open={booking} onClose={() => setBooking(false)} onBooked={load} />
      <BookingModal
        open={!!moving}
        onClose={() => setMoving(null)}
        moveAppointment={moving}
        onBooked={load}
      />
    </div>
  )
}
