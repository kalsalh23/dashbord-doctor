import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, Users, Hourglass, Stethoscope, Repeat, Wallet, Hourglass as DueIcon,
  Plus, UserPlus, ArrowLeft,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, StatCard, Badge, APPT_STATUS, Button, EmptyState, SkeletonRows, Avatar } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import PatientFormModal from '../../components/PatientFormModal'
import AppointmentActions from '../../components/AppointmentActions'
import { todayStr, timeToMin, money } from '../../lib/format'
import { FU_STATUS } from '../../components/ui'

const SELECT_PATIENT = 'id, patient_id, appointment_date, start_time, end_time, status, price, reminder_sent_at, patient:patients(id, full_name, phone)'

export default function ReceptionDashboard() {
  const { profile, settings, toast } = useApp()
  const [appts, setAppts] = useState(null)
  const [fups, setFups] = useState(null)
  const [payStats, setPayStats] = useState({ collected: 0, due: 0 })
  const [booking, setBooking] = useState(false)
  const [newPatient, setNewPatient] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const t = todayStr()
    const [apptsRes, fupsRes, paidRes, dueRes] = await Promise.all([
      supabase.from('appointments').select(SELECT_PATIENT).eq('clinic_id', profile.clinic_id).eq('appointment_date', t).order('start_time'),
      supabase
        .from('follow_up_requests')
        .select('id, interval_days, suggested_date, status, patient:patients(full_name), doctor:profiles(full_name)')
        .eq('clinic_id', profile.clinic_id)
        .eq('status', 'pending')
        .order('suggested_date')
        .limit(5),
      supabase
        .from('payments')
        .select('amount')
        .eq('clinic_id', profile.clinic_id)
        .eq('status', 'paid')
        .gte('paid_at', new Date(new Date(t).getTime()).toISOString())
        .lt('paid_at', new Date(new Date(t).getTime() + 86400000).toISOString()),
      supabase.from('payments').select('remaining').eq('clinic_id', profile.clinic_id).eq('status', 'due_later'),
    ])
    setAppts(apptsRes.data || [])
    setFups(fupsRes.data || [])
    setPayStats({
      collected: (paidRes.data || []).reduce((s, p) => s + Number(p.amount || 0), 0),
      due: (dueRes.data || []).reduce((s, p) => s + Number(p.remaining || 0), 0),
    })
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const active = (appts || []).filter((a) => !['cancelled', 'no_show'].includes(a.status))
  const waiting = active.filter((a) => ['arrived', 'waiting'].includes(a.status))
  const inConsult = active.filter((a) => a.status === 'in_consultation')
  const upcomingCount = active.filter((a) => a.status === 'confirmed' || a.status === 'new').length

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 sm:text-xl">لوحة الاستقبال</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            مرحبًا {profile?.full_name} — إليك وضع العيادة اليوم
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setNewPatient(true)} variant="secondary">
            <UserPlus size={16} />
            <span className="hidden sm:inline">مريض جديد</span>
          </Button>
          <Button onClick={() => setBooking(true)}>
            <Plus size={16} />
            حجز موعد
          </Button>
        </div>
      </div>

      {/* stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard to="/reception/appointments" label="مواعيد اليوم" value={active.length} icon={CalendarDays} tone="blue" />
        <StatCard label="في الانتظار" value={waiting.filter((w) => w.status !== 'in_consultation').length} icon={Hourglass} tone="amber" />
        <StatCard label="قيد الكشف" value={inConsult.length} icon={Stethoscope} tone="teal" />
        <StatCard to="/reception/follow-ups" label="طلبات متابعة" value={fups ? fups.length : '—'} icon={Repeat} tone="violet" />
        <StatCard to="/reception/payments" label="محصّل اليوم" value={money(payStats.collected, settings?.currency)} icon={Wallet} tone="emerald" />
        <StatCard to="/reception/payments" label="مستحقات لاحقًا" value={money(payStats.due, settings?.currency)} icon={DueIcon} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* waiting list */}
        <Card title="قائمة الانتظار" subtitle="المرضى الحاضرون في العيادة الآن" bodyClass="!p-0">
          {!appts ? (
            <div className="p-4"><SkeletonRows /></div>
          ) : waiting.length === 0 ? (
            <EmptyState
              icon={Users}
              title="لا يوجد مرضى في الانتظار"
              message="عند وصول المريض اضغط «تسجيل الوصول» في موعده ليظهر هنا"
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {waiting.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.patient?.full_name} className="h-9 w-9 text-xs" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                      <p className="text-[11px] text-slate-500">
                        موعد {a.start_time?.slice(0, 5)} · <Badge map={APPT_STATUS} value={a.status} />
                      </p>
                    </div>
                  </div>
                  <AppointmentActions appt={a} onChanged={load} showOpen />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* today's appointments */}
        <Card
          title="مواعيد اليوم"
          subtitle={`${upcomingCount} موعد قادم`}
          bodyClass="!p-0"
          actions={
            <Link to="/reception/appointments" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
              الكل
              <ArrowLeft size={13} />
            </Link>
          }
        >
          {!appts ? (
            <div className="p-4"><SkeletonRows /></div>
          ) : active.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="لا توجد مواعيد اليوم"
              message="ابدأ بحجز موعد جديد للمرضى"
              action={<Button size="sm" onClick={() => setBooking(true)}>حجز موعد</Button>}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {active.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="w-12 shrink-0 text-center">
                    <span className="block text-sm font-bold text-slate-800" dir="ltr">{a.start_time?.slice(0, 5)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/reception/patients/${a.patient_id}`} className="block truncate text-sm font-bold text-slate-800 hover:text-primary-700">
                      {a.patient?.full_name}
                    </Link>
                    <span className="text-[11px] text-slate-400" dir="ltr">{a.patient?.phone}</span>
                  </div>
                  <Badge map={APPT_STATUS} value={a.status} />
                  <div className="hidden sm:block">
                    <AppointmentActions appt={a} onChanged={load} showOpen={false} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* follow-up requests */}
        <Card
          title="طلبات متابعة من الطبيب"
          subtitle="مرضى يطلب الطبيب مراجعتهم"
          bodyClass="!p-0"
          className="xl:col-span-2"
          actions={
            <Link to="/reception/follow-ups" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
              الكل
              <ArrowLeft size={13} />
            </Link>
          }
        >
          {!fups ? (
            <div className="p-4"><SkeletonRows /></div>
          ) : fups.length === 0 ? (
            <EmptyState icon={Repeat} title="لا توجد طلبات متابعة" message="ستظهر هنا طلبات المتابعة التي يرسلها الطبيب" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {fups.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{f.patient?.full_name}</p>
                    <p className="text-[11px] text-slate-500">
                      مراجعة بعد {f.interval_days} يوم · التاريخ المقترح {f.suggested_date} · {f.doctor?.full_name || ''}
                    </p>
                  </div>
                  <Link to="/reception/follow-ups">
                    <Button size="sm" variant="secondary">حجز الموعد</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <BookingModal open={booking} onClose={() => setBooking(false)} onBooked={load} />
      <PatientFormModal open={newPatient} onClose={() => setNewPatient(false)} onSaved={load} />
    </div>
  )
}
