import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hourglass, Stethoscope, CalendarDays, FolderOpen } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, SkeletonRows, Avatar, Badge, APPT_STATUS, PageHeader } from '../../components/ui'
import { todayStr, timeToMin, ageFrom, nowMinutes, minToTime } from '../../lib/format'

const SELECT = 'id, patient_id, appointment_date, start_time, end_time, status, updated_at, patient:patients(id, full_name, phone, date_of_birth, gender)'

export default function DoctorDashboard() {
  const { profile } = useApp()
  const [appts, setAppts] = useState(null)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('appointments')
      .select(SELECT)
      .eq('clinic_id', profile.clinic_id)
      .eq('appointment_date', todayStr())
      .in('status', ['arrived', 'waiting', 'in_consultation', 'confirmed'])
      .order('start_time')
    setAppts(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
    const t = setInterval(load, 45000)
    window.addEventListener('focus', load)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', load)
    }
  }, [load])

  const queue = (appts || [])
    .filter((a) => ['arrived', 'waiting'].includes(a.status))
    .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  const current = (appts || []).filter((a) => a.status === 'in_consultation')
  const upcoming = (appts || [])
    .filter((a) => (a.status === 'confirmed' || a.status === 'new') && timeToMin(a.start_time) >= nowMinutes())
    .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="عيادة اليوم"
        subtitle={`${profile?.full_name} — ${queue.length + current.length} مريض نشط الآن`}
      />

      {/* in consultation */}
      {current.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Stethoscope size={16} className="text-primary-600" />
            قيد الكشف الآن
          </h2>
          <div className="space-y-3">
            {current.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={a.patient?.full_name} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                    <p className="text-[11px] text-slate-500">موعد {a.start_time?.slice(0, 5)}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => nav(`/doctor/consultation/${a.id}`)}>
                  متابعة الكشف
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* waiting queue */}
      <div className="mb-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
          <Hourglass size={16} className="text-amber-500" />
          بانتظار الكشف
        </h2>
        {!appts ? (
          <SkeletonRows rows={3} />
        ) : queue.length === 0 ? (
          <Card>
            <EmptyState
              icon={Hourglass}
              title="لا يوجد مرضى في الانتظار"
              message="سيظهر هنا المرضى بعد أن تنقلهم الاستقبال إلى قائمة الانتظار"
            />
          </Card>
        ) : (
          <ul className="space-y-3">
            {queue.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-card">
                <div className="flex items-center gap-3">
                  <Avatar name={a.patient?.full_name} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{a.patient?.full_name}</p>
                    <p className="text-[11px] text-slate-500">
                      موعد {a.start_time?.slice(0, 5)}
                      {a.patient?.date_of_birth ? ` · ${ageFrom(a.patient.date_of_birth)} سنة` : ''}
                      {` · وصل ${minToTime(nowMinutes())}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/patients/${a.patient_id}`)}>
                    <FolderOpen size={14} />
                    الملف
                  </Button>
                  <Button size="sm" onClick={() => nav(`/doctor/consultation/${a.id}`)}>
                    <Stethoscope size={14} />
                    بدء الكشف
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* today's upcoming */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
          <CalendarDays size={16} className="text-slate-400" />
          مواعيد اليوم القادمة
        </h2>
        <Card bodyClass="!p-0">
          {upcoming.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-slate-400">لا توجد مواعيد قادمة اليوم</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="w-12 text-center text-sm font-bold text-slate-700" dir="ltr">{a.start_time?.slice(0, 5)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{a.patient?.full_name}</span>
                  <Badge map={APPT_STATUS} value={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
