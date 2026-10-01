import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Repeat, FolderOpen, XCircle, CalendarDays } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Badge, FU_STATUS, Button, Card, EmptyState, SkeletonRows, Tabs, PageHeader } from '../../components/ui'
import { formatDateShort, todayStr, addDays } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'

export default function DoctorFollowUps() {
  const { profile, toast } = useApp()
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('pending')
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('follow_up_requests')
      .select('id, interval_days, suggested_date, status, created_at, patient:patients(id, full_name, phone), doctor:profiles(full_name), appointment:appointments(appointment_date, start_time)')
      .eq('clinic_id', profile.clinic_id)
      .order('suggested_date')
      .limit(100)
    setRows(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => (rows || []).filter((r) => r.status === tab), [rows, tab])
  const dueSoon = useMemo(
    () => (rows || []).filter((r) => r.status === 'scheduled' && r.appointment?.appointment_date && r.appointment.appointment_date <= addDays(todayStr(), 3)),
    [rows]
  )

  const cancelRequest = async (r) => {
    const { error } = await supabase.from('follow_up_requests').update({ status: 'cancelled' }).eq('id', r.id)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'cancel_follow_up', 'follow_up_requests', r.id)
    toast('success', 'تم إلغاء طلب المتابعة')
    load()
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="متابعاتي" subtitle="مرضى طلب المتابعة لهم — وحالة حجز مواعيدهم" />

      {dueSoon.length > 0 && tab === 'pending' && (
        <div className="mb-4 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary-800">
            <CalendarDays size={14} />
            مرضى مراجعتهم خلال الأيام الثلاثة القادمة: {dueSoon.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {dueSoon.map((r) => r.patient?.full_name).join(' · ')}
          </p>
        </div>
      )}

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'pending', label: 'بانتظار الحجز' },
            { value: 'scheduled', label: 'محجوزة' },
            { value: 'completed', label: 'مكتملة' },
            { value: 'cancelled', label: 'ملغاة' },
          ]}
        />
      </div>

      <Card bodyClass="!p-0">
        {rows === null ? (
          <div className="p-4"><SkeletonRows rows={4} /></div>
        ) : shown.length === 0 ? (
          <EmptyState icon={Repeat} title="لا توجد طلبات في هذه القائمة" message="تُرسل طلبات المتابعة تلقائياً من شاشة الكشف عند اختيار «يحتاج متابعة»" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{r.patient?.full_name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    مراجعة بعد <b className="text-slate-700">{r.interval_days}</b> يوم · المقترح{' '}
                    <b className="text-slate-700">{formatDateShort(r.suggested_date)}</b>
                    {r.status === 'scheduled' && r.appointment && (
                      <> · محجوز {formatDateShort(r.appointment.appointment_date)} الساعة {r.appointment.start_time?.slice(0, 5)}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge map={FU_STATUS} value={r.status} />
                  <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/patients/${r.patient?.id}`)}>
                    <FolderOpen size={14} />
                    الملف
                  </Button>
                  {r.status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => cancelRequest(r)} title="إلغاء الطلب">
                      <XCircle size={14} className="text-rose-500" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
