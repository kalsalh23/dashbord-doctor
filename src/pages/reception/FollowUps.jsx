import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Repeat, CalendarPlus, XCircle } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Badge, FU_STATUS, Button, Card, EmptyState, SkeletonRows, Tabs, PageHeader } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import { formatDateShort } from '../../lib/format'
import { useSchedules, friendlyDbError } from '../../lib/hooks'
import { slotsForDay } from '../../lib/slots'
import { addDays, getWeekday } from '../../lib/format'

export default function FollowUps() {
  const { profile, settings, toast } = useApp()
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('pending')
  const [bookingFor, setBookingFor] = useState(null)
  const [schedules] = useSchedules()
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('follow_up_requests')
      .select('id, interval_days, suggested_date, status, created_at, appointment_id, appointment:appointments(appointment_date, start_time), patient:patients(id, full_name, phone), doctor:profiles(full_name)')
      .eq('clinic_id', profile.clinic_id)
      .order('created_at', { ascending: false })
      .limit(100)
    setRows(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => (rows || []).filter((r) => r.status === tab), [rows, tab])

  const cancelRequest = async (r) => {
    const { error } = await supabase.from('follow_up_requests').update({ status: 'cancelled' }).eq('id', r.id)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'cancel_follow_up', 'follow_up_requests', r.id)
    toast('success', 'تم إلغاء طلب المتابعة')
    load()
  }

  // default booking date: suggested date if it's a working day, else the next working day
  const defaultDate = (r) => {
    let d = r.suggested_date || addDays(new Date().toISOString().slice(0, 10), r.interval_days)
    for (let i = 0; i < 14; i++) {
      const probe = addDays(d, i)
      if (slotsForDay({ schedules, settings, dateStr: probe }).closed === false) return probe
    }
    return d
  }

  return (
    <div>
      <PageHeader title="طلبات المتابعة" subtitle="طلبات المراجعة التي أرسلها الطبيب" />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'pending', label: 'قيد الانتظار' },
            { value: 'scheduled', label: 'تم الحجز' },
            { value: 'completed', label: 'مكتملة' },
            { value: 'cancelled', label: 'ملغاة' },
          ]}
        />
      </div>

      <Card bodyClass="!p-0">
        {rows === null ? (
          <div className="p-4"><SkeletonRows rows={4} /></div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="لا توجد طلبات في هذه القائمة"
            message="يظهر هنا ما يرسله الطبيب بعد انتهاء الكشف: مرضى يحتاجون مراجعة"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{r.patient?.full_name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    مراجعة بعد <b className="text-slate-700">{r.interval_days}</b> يوم · التاريخ المقترح{' '}
                    <b className="text-slate-700">{formatDateShort(r.suggested_date)}</b>
                    {r.doctor?.full_name ? ` · ${r.doctor.full_name}` : ''}
                    {r.status === 'scheduled' && r.appointment && (
                      <> · محجوز {formatDateShort(r.appointment.appointment_date)} الساعة {r.appointment.start_time?.slice(0, 5)}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge map={FU_STATUS} value={r.status} />
                  {r.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => setBookingFor(r)}>
                        <CalendarPlus size={14} />
                        حجز موعد
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelRequest(r)} title="إلغاء الطلب">
                        <XCircle size={14} className="text-rose-500" />
                      </Button>
                    </>
                  )}
                  {r.status === 'scheduled' && r.patient && (
                    <Button size="sm" variant="secondary" onClick={() => nav(`/reception/patients/${r.patient.id}`)}>
                      الملف
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <BookingModal
        open={!!bookingFor}
        onClose={() => setBookingFor(null)}
        presetPatient={bookingFor?.patient}
        presetDate={bookingFor ? defaultDate(bookingFor) : undefined}
        onBooked={async (appt) => {
          if (!bookingFor) return
          // link the newly booked appointment (latest for this patient) to the request
          const { data: last } = await supabase
            .from('appointments')
            .select('id')
            .eq('clinic_id', profile.clinic_id)
            .eq('patient_id', bookingFor.patient.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (last) {
            await supabase
              .from('follow_up_requests')
              .update({ status: 'scheduled', appointment_id: last.id })
              .eq('id', bookingFor.id)
            audit(profile.clinic_id, 'schedule_follow_up', 'follow_up_requests', bookingFor.id)
            toast('success', 'تم حجز موعد المراجعة')
          }
          setBookingFor(null)
          load()
        }}
      />
    </div>
  )
}
