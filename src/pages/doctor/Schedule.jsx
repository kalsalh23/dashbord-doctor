import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, CalendarDays, Stethoscope, FolderOpen, History, BellRing } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Badge, APPT_STATUS, Button, EmptyState, SkeletonRows, Avatar, Tabs } from '../../components/ui'
import LastVisitModal from '../../components/LastVisitModal'
import { useSchedules } from '../../lib/hooks'
import { usesWideSchedule } from '../../lib/clinicStyle'
import { todayStr, addDays, formatDateLong, dayLabel, timeToMin, getWeekday, weekdayName } from '../../lib/format'
import { slotsForDay } from '../../lib/slots'
import { reminderSmsHref } from '../../lib/reminders'

export default function Schedule() {
  const { profile, toast, settings } = useApp()
  // أسلوب العرض: القائمة كاملة وشبكة الأيام تحتها — عيادة د. ريام و(clinics other) — بقية العيادات نصفان
  const wide = usesWideSchedule(profile, settings)
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
      .select('id, patient_id, appointment_date, start_time, end_time, status, patient:patients(id, full_name)')
      .eq('clinic_id', profile.clinic_id)
      .eq('appointment_date', date)
      .order('start_time')
    setAppts(data || [])
  }, [profile?.clinic_id, date])

  useEffect(() => {
    load()
  }, [load])

  // appointment counts for the upcoming 14 days (day-strip badges)
  // العدد = المواعيد الفعلية القائمة فقط (الملغى/المكتمل/عدم الحضور لا يُحتسب —
  // لا يظهر رقم لحجوزات غير موجودة بعد الحالة الإسعافية أو بعد إتمام الكشف)
  useEffect(() => {
    if (!profile?.clinic_id) return
    supabase
      .from('appointments')
      .select('appointment_date, status')
      .eq('clinic_id', profile.clinic_id)
      .gte('appointment_date', todayStr())
      .lte('appointment_date', addDays(todayStr(), 13))
      .not('status', 'in', '(completed,cancelled,no_show)')
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

  // موعد «قيد الكشف»: خرج من قائمة الانتظار بمجرد أن بدأ الطبيب كشفه
  // (يظهر في لوحة اليوم تحت «قيد الكشف الآن») — فينقص العدّاد فوراً
  const isConsulting = (a) => a.status === 'in_consultation'

  const counts = useMemo(() => {
    const all = appts || []
    return {
      all: all.filter((a) => !['cancelled', 'no_show', 'completed', 'in_consultation'].includes(a.status)).length,
      consulting: all.filter((a) => a.status === 'in_consultation').length,
      done: all.filter((a) => ['completed', 'cancelled', 'no_show'].includes(a.status)).length,
    }
  }, [appts])

  const shown = useMemo(() => {
    let list = appts || []
    if (filter === 'all') list = list.filter((a) => !['cancelled', 'no_show', 'completed', 'in_consultation'].includes(a.status))
    if (filter === 'consulting') list = list.filter((a) => a.status === 'in_consultation')
    if (filter === 'done') list = list.filter((a) => ['completed', 'cancelled', 'no_show'].includes(a.status))
    return [...list].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  }, [appts, filter])

  const startConsult = (a) => nav(`/doctor/consultation/${a.id}`)

  // تذكير المريض بموعده — رسالة ثابتة خاصة به (اسمه وتاريخه ووقته والعيادة)، تُرسل SMS مجاناً
  const reminderFor = (a) => {
    const r = reminderSmsHref({
      patient_name: a.patient?.full_name,
      phone: a.patient?.phone,
      appointment_date: a.appointment_date,
      start_time: a.start_time,
      clinic_name: profile?.clinic?.name,
      doctor_name: profile?.full_name,
    })
    return r.href ? { href: r.href, body: r.body } : null
  }

  // تمرير تلقائي لليوم المختار داخل الشريط الأفقي
  const stripRef = useRef(null)
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-selected="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [date])

  const dayTotal = (appts || []).filter((a) => !['cancelled', 'no_show'].includes(a.status)).length

  return (    <div className="mx-auto max-w-2xl">
      {/* ======= شريط علوي بسيط: العنوان + التنقّل بين الأيام ======= */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-black text-slate-800">مواعيدي</h1>
          <p className="truncate text-xs text-slate-500">{formatDateLong(date)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="secondary" size="icon" onClick={() => setDate((d) => addDays(d, -1))} aria-label="اليوم السابق">
            <ChevronRight size={16} />
          </Button>
          <Button variant={date === todayStr() ? 'primary' : 'secondary'} size="sm" onClick={() => setDate(todayStr())}>
            اليوم
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setDate((d) => addDays(d, 1))} aria-label="اليوم التالي">
            <ChevronLeft size={16} />
          </Button>
        </div>
      </div>

      {wide ? (
        /* ================= تصميم مبسّط — عيادة د. ريام ود. عارف ================= */
        <>
          {/* أيام قابلة للتمرير */}
          <div ref={stripRef} className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {strip.map((d) => {
              const selected = d === date
              const count = dayCounts[d] || 0
              const isToday = d === todayStr()
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  data-selected={selected ? 'true' : 'false'}
                  className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors ${
                    selected
                      ? 'border-primary-700 bg-primary-700 text-white shadow-sm'
                      : isToday
                        ? 'border-primary-300 bg-primary-50 text-primary-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300'
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${selected ? 'text-primary-100' : 'text-slate-400'}`}>
                    {weekdayName(getWeekday(d))}
                  </span>
                  <span className="text-base font-bold leading-5">{Number(d.slice(8, 10))}</span>
                  <span
                    className={`min-w-4 rounded-full px-1 text-[9px] font-bold ${
                      count > 0
                        ? selected ? 'bg-white text-primary-800' : 'bg-primary-100 text-primary-800'
                        : 'bg-transparent text-slate-300'
                    }`}
                  >
                    {count > 0 ? count : '·'}
                  </span>
                </button>
              )
            })}
          </div>

          {/* مواعيد اليوم — بطاقات واضحة */}
          {appts === null ? (
            <SkeletonRows rows={4} />
          ) : shown.length === 0 ? (
            <Card>
              <EmptyState
                icon={CalendarDays}
                title="لا توجد مواعيد"
                message={closed ? 'هذا اليوم ليس من أيام العمل' : 'هذا اليوم فارغ — اختر يوماً آخر من الشريط أعلاه'}
                action={
                  <Button size="sm" onClick={() => setDate(todayStr())}>
                    اذهب لليوم
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="space-y-2.5">
              {shown.map((a) => {
                const isDone = ['completed', 'cancelled', 'no_show'].includes(a.status)
                return (
                  <li key={a.id} className={`rounded-2xl border border-slate-200 bg-white p-3.5 shadow-card ${isDone ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50" dir="ltr">
                        <span className="text-sm font-black leading-4 text-slate-800">{a.start_time?.slice(0, 5)}</span>
                        <span className="text-[9px] text-slate-400">{a.end_time?.slice(0, 5)}</span>
                      </span>
                      <Avatar name={a.patient?.full_name} className="h-9 w-9 text-xs" />
                      <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                      <Badge map={APPT_STATUS} value={a.status} />
                    </div>
                    {!isDone && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Button size="sm" className="flex-1 justify-center" onClick={() => startConsult(a)}>
                          <Stethoscope size={14} />
                          بدء الكشف
                        </Button>
                        <Button size="sm" variant="secondary" className="justify-center" onClick={() => setLastVisitFor(a.patient)}>
                          <History size={14} />
                          آخر زيارة
                        </Button>
                        {/* تذكير بموعد — SMS مجاني برسالة ثابتة خاصة بهذا المريض */}
                        {reminderFor(a) && (
                          <a
                            href={reminderFor(a).href}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100"
                            title="إرسال تذكير للمريض بموعده (SMS مجاني — يفتح تطبيق الرسائل)"
                          >
                            <BellRing size={13} />
                            تذكير
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : (
        /* ================= التصميم الأصلي لبقية العيادات (بلا تغيير) ================= */
        <>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
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
            { value: 'all', label: 'الكل', count: counts.all },
            { value: 'consulting', label: 'قيد الكشف', count: counts.consulting },
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
            {shown.map((a) => {
              const isDone = ['completed', 'cancelled', 'no_show'].includes(a.status)
              return (
              <li key={a.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                <div className="w-14 shrink-0 text-center">
                  <span className="block text-base font-bold leading-6 text-slate-800" dir="ltr">{a.start_time?.slice(0, 5)}</span>
                  <span className="block text-[10px] text-slate-400" dir="ltr">{a.end_time?.slice(0, 5)}</span>
                </div>
                <Avatar name={a.patient?.full_name} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                </div>
                <Badge map={APPT_STATUS} value={a.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setLastVisitFor(a.patient)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200"
                >
                  <History size={13} />
                  آخر زيارة
                </button>
                {!isDone && (
                  <button
                    onClick={() => startConsult(a)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                  >
                    <Stethoscope size={13} />
                    بدء الكشف
                  </button>
                )}
                {/* تذكير بموعد — SMS مجاني برسالة ثابتة خاصة بهذا المريض */}
                {!isDone && reminderFor(a) && (
                  <a
                    href={reminderFor(a).href}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-3 text-xs font-bold text-primary-800 transition-colors hover:bg-primary-100"
                    title="إرسال تذكير للمريض بموعده (SMS مجاني — يفتح تطبيق الرسائل)"
                  >
                    <BellRing size={13} />
                    تذكير
                  </a>
                )}
                </div>
              </li>
              )
            })}
          </ul>
        )}
        </Card>
        </div>

        {/* أيام الأسبوع مربعات — العمود الجانبي */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-36">
            <p className="mb-2 text-xs font-bold text-slate-500">الأيام — اضغط لعرض مواعيده</p>
            <div className="grid grid-cols-3 gap-2">
              {strip.map((d) => {
                const selected = d === date
                const count = dayCounts[d] || 0
                return (
                  <button
                    key={d}
                    onClick={() => setDate(d)}
                    className={`flex h-[68px] w-full flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
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
          </div>
        </div>
      </div>
        </>
      )}

      <LastVisitModal open={!!lastVisitFor} onClose={() => setLastVisitFor(null)} patient={lastVisitFor} />
    </div>
  )
}
