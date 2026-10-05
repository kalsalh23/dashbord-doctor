import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hourglass, Stethoscope, CalendarDays, FolderOpen, History, Siren, CalendarPlus } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, SkeletonRows, Avatar, Badge, APPT_STATUS, PageHeader, Modal, Field, Textarea, Toggle, ConfirmDialog } from '../../components/ui'
import LastVisitModal from '../../components/LastVisitModal'
import BookingModal from '../../components/BookingModal'
import { todayStr, timeToMin, ageFrom, nowMinutes, minToTime } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'

const SELECT = 'id, patient_id, appointment_date, start_time, end_time, status, updated_at, patient:patients(id, full_name, phone, date_of_birth, gender)'

export default function DoctorDashboard() {
  const { profile, toast } = useApp()
  const [appts, setAppts] = useState(null)
  const [lastVisitFor, setLastVisitFor] = useState(null) // patient object for the quick-view modal
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [emergencyNote, setEmergencyNote] = useState('')
  const [emergencyCancel, setEmergencyCancel] = useState(true)
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [emergencyDone, setEmergencyDone] = useState(null)
  const [bookingOpen, setBookingOpen] = useState(false)
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

  const runEmergency = async () => {
    setEmergencyBusy(true)
    const { data: count, error } = await supabase.rpc('emergency_broadcast', {
      p_note: emergencyNote.trim(),
      p_cancel: emergencyCancel,
    })
    setEmergencyBusy(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'emergency_broadcast', 'appointments', null, { notified: count })
    setEmergencyOpen(false)
    setEmergencyNote('')
    setEmergencyDone(count ?? 0)
    load()
  }

  const queue = (appts || [])
    .filter((a) => ['arrived', 'waiting'].includes(a.status))
    .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  const current = (appts || []).filter((a) => a.status === 'in_consultation')
  const todayCount = (appts || []).filter((a) => !['cancelled', 'no_show'].includes(a.status)).length
  const upcoming = (appts || [])
    .filter((a) => (a.status === 'confirmed' || a.status === 'new') && timeToMin(a.start_time) >= nowMinutes())
    .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="عيادة اليوم"
        subtitle={`${profile?.full_name} — ${queue.length + current.length} مريض نشط الآن`}
        actions={
          <div className="flex gap-2">
            {/* اختصاص الأنف والأذن والحنجرة: كشف برسومات تشريحية خاصة */}
            {(profile?.specialty_key || '') === 'ent' && (
              <Button variant="secondary" onClick={() => nav('/doctor/consultation')}>
                <Stethoscope size={16} />
                كشف جديد بالرسومات
              </Button>
            )}
            {/* الطبيب الشامل: يحجز بنفسه — لا يوجد موظف استقبال في عيادته */}
            {profile?.self_service && (
              <Button variant="secondary" onClick={() => setBookingOpen(true)}>
                <CalendarPlus size={16} />
                حجز موعد
              </Button>
            )}
            <Button
              variant="dangerGhost"
              onClick={() => setEmergencyOpen(true)}
              disabled={todayCount === 0}
              title={todayCount === 0 ? 'لا توجد مواعيد اليوم' : 'إشعار جماعي لمرضى اليوم'}
            >
              <Siren size={16} />
              حالة إسعافية
            </Button>
          </div>
        }
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
                  <Button size="sm" variant="secondary" onClick={() => setLastVisitFor(a.patient)}>
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

      <LastVisitModal open={!!lastVisitFor} onClose={() => setLastVisitFor(null)} patient={lastVisitFor} />
      {/* الطبيب الشامل: حجز المواعيد بنفسه */}
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onBooked={load} />

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
      {/* emergency broadcast */}
      <Modal
        open={emergencyOpen}
        onClose={() => !emergencyBusy && setEmergencyOpen(false)}
        title="حالة إسعافية طارئة"
        subtitle={`سيصل الإشعار لجميع مواعيد اليوم (${todayCount} مريض)`}
        footer={
          <div className="flex justify-start gap-2">
            <Button variant="danger" onClick={runEmergency} loading={emergencyBusy}>
              <Siren size={16} />
              إرسال الاعتذار الجماعي
            </Button>
            <Button variant="secondary" onClick={() => setEmergencyOpen(false)} disabled={emergencyBusy}>
              إلغاء
            </Button>
          </div>
        }
      >
        <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          سيُرسل اعتذار جماعي باسمك لكل مرضى اليوم عبر قنواتهم، مع طلب إعادة الحجز.
        </p>
        <Field label="نص إضافي (اختياري)" hint="مثال: الحالة إسعافية في المستشفى — سنرد عليكم لترتيب موعد بديل">
          <Textarea value={emergencyNote} onChange={(e) => setEmergencyNote(e.target.value)} rows={2} />
        </Field>
        <div className="mt-3">
          <Toggle checked={emergencyCancel} onChange={setEmergencyCancel} label="إلغاء مواعيد اليوم أيضاً (لتحرير الأوقات لإعادة الحجز)" />
        </div>
      </Modal>

      <ConfirmDialog
        open={emergencyDone !== null}
        onClose={() => setEmergencyDone(null)}
        title="تم الإرسال بنجاح"
        message={`وصل الاعتذار لـ ${emergencyDone} مريض عبر قنواتهم${emergencyCancel ? '، وأُلغيت مواعيدهم اليوم لتحرير الأوقات' : ''}. أُرسل إشعار للاستقبال بالاتصال وترتيب إعادة الحجز.`}
        confirmLabel="حسناً"
        onConfirm={() => setEmergencyDone(null)}
      />
    </div>
  )
}
