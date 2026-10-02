import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Hourglass, Stethoscope, FolderOpen, History, SmilePlus,
  Activity, Repeat,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, SkeletonRows, Avatar, PageHeader, StatCard } from '../../components/ui'
import { todayStr, timeToMin, ageFrom, nowMinutes, minToTime, addDays } from '../../lib/format'

/**
 * لوحة طبيب الأسنان — نموذج لوحة تحكم خاص باختصاص طب الأسنان.
 * Built for the dentistry specialty: dental stats, dental activity feed,
 * and the same fast waiting-queue workflow.
 */
export default function DentalDashboard() {
  const { profile } = useApp()
  const [appts, setAppts] = useState(null)
  const [dentalFeed, setDentalFeed] = useState(null)
  const [weekCount, setWeekCount] = useState(null)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const [apptsRes, feedRes, weekRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, patient_id, appointment_date, start_time, end_time, status, patient:patients(id, full_name, phone, date_of_birth)')
        .eq('clinic_id', profile.clinic_id)
        .eq('appointment_date', todayStr())
        .in('status', ['arrived', 'waiting', 'in_consultation', 'confirmed'])
        .order('start_time'),
      supabase
        .from('dental_chart_entries')
        .select('id, tooth_no, procedure, notes, created_at, patient:patients(id, full_name)')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('dental_chart_entries')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', weekAgo),
    ])
    setAppts(apptsRes.data || [])
    setDentalFeed(feedRes.data || [])
    setWeekCount(weekRes.count ?? 0)
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
  const todayCount = (appts || []).filter((a) => !['cancelled', 'no_show'].includes(a.status)).length

  return (
    <div>
      <PageHeader
        title={`لوحة طبيب الأسنان`}
        subtitle={`${profile?.full_name} — ${profile?.clinic?.name || ''}`}
      />

      {/* dental stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="مواعيد اليوم" value={todayCount} icon={CalendarDays} tone="blue" to="/doctor/schedule" />
        <StatCard label="في الانتظار" value={queue.length} icon={Hourglass} tone="amber" />
        <StatCard label="قيد الكشف" value={current.length} icon={Stethoscope} tone="teal" />
        <StatCard label="إجراءات آخر 7 أيام" value={weekCount ?? '—'} icon={SmilePlus} tone="violet" />
      </div>

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
                    <History size={14} />
                    آخر زيارة
                  </Button>
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

      {/* dental activity feed */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="آخر إجراءات الأسنان" subtitle="أحدث ما سُجل على مخطط الأسنان في العيادة" bodyClass="!p-0">
          {dentalFeed === null ? (
            <div className="p-4"><SkeletonRows rows={3} /></div>
          ) : dentalFeed.length === 0 ? (
            <EmptyState
              icon={SmilePlus}
              title="لا توجد إجراءات مسجلة بعد"
              message="افتح الكشف واستخدم مخطط الأسنان لتسجيل الإجراءات — ستظهر هنا"
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dentalFeed.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-800">
                    {e.tooth_no}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-700">
                      {e.patient?.full_name} — {e.procedure}
                      {e.notes ? <span className="font-medium text-slate-400"> · {e.notes}</span> : null}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(e.created_at).toLocaleString('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {e.patient?.id && (
                    <Button size="sm" variant="ghost" onClick={() => nav(`/doctor/patients/${e.patient.id}`)} title="الملف">
                      <FolderOpen size={14} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="أدوات طبيب الأسنان" subtitle="وصول سريع">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => nav('/doctor/favorites')} className="rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><SmilePlus size={16} className="text-primary-600" /> أدويتي الشائعة</p>
              <p className="mt-1 text-[11px] text-slate-400">مواد وتخديرات تستخدمها كثيراً — إدراج بضغطة داخل الكشف</p>
            </button>
            <button onClick={() => nav('/doctor/schedule')} className="rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><CalendarDays size={16} className="text-primary-600" /> جدول مواعيدي</p>
              <p className="mt-1 text-[11px] text-slate-400">تنقل بين الأيام ومتابعة حجز المراجعات</p>
            </button>
            <button onClick={() => nav('/doctor/follow-ups')} className="rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Repeat size={16} className="text-primary-600" /> متابعاتي</p>
              <p className="mt-1 text-[11px] text-slate-400">مرضى الجلسات القادمة (علاج جذور، تركيبات...)</p>
            </button>
            <button onClick={() => nav('/doctor/visits')} className="rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Activity size={16} className="text-primary-600" /> سجل الكشوفات</p>
              <p className="mt-1 text-[11px] text-slate-400">راجع أي كشف سابق بتفاصيله الكاملة</p>
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
