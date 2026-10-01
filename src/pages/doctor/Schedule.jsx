import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, CalendarDays, Stethoscope, FolderOpen, Clock } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Badge, APPT_STATUS, Button, EmptyState, SkeletonRows, Avatar, Tabs, PageHeader } from '../../components/ui'
import { useSchedules } from '../../lib/hooks'
import { todayStr, addDays, formatDateLong, dayLabel, timeToMin } from '../../lib/format'
import { slotsForDay } from '../../lib/slots'

export default function Schedule() {
  const { profile, toast } = useApp()
  const [schedules] = useSchedules()
  const [date, setDate] = useState(todayStr())
  const [appts, setAppts] = useState(null)
  const [filter, setFilter] = useState('patient') // patient = active queue, all, done
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
    if (filter === 'patient') list = list.filter((a) => !['cancelled', 'no_show', 'completed'].includes(a.status))
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
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="input-base !w-auto" />
            <Button variant="secondary" size="icon" onClick={() => setDate((d) => addDays(d, 1))} aria-label="اليوم التالي">
              <ChevronLeft size={16} />
            </Button>
            <Button variant={date === todayStr() ? 'primary' : 'secondary'} size="sm" onClick={() => setDate(todayStr())}>
              اليوم
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'patient', label: 'قيد العمل', count: counts.active },
            { value: 'all', label: 'الكل', count: counts.all },
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
                {['arrived', 'waiting'].includes(a.status) && (
                  <Button size="sm" onClick={() => startConsult(a)}>
                    <Stethoscope size={14} />
                    بدء الكشف
                  </Button>
                )}
                {a.status === 'in_consultation' && (
                  <Button size="sm" onClick={() => startConsult(a)}>
                    <Stethoscope size={14} />
                    متابعة
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => nav(`/doctor/patients/${a.patient_id}`)} title="فتح الملف">
                  <FolderOpen size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {closed && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Clock size={12} />
          أيام العمل تُضبط من إعدادات العيادة.
        </p>
      )}
    </div>
  )
}
