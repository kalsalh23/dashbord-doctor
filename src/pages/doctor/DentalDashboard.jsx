import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Hourglass, Stethoscope, FolderOpen, History, SmilePlus,
  Activity, Repeat, Siren, Wallet, NotebookPen, Banknote, UserPlus, CalendarPlus,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, SkeletonRows, Avatar, PageHeader, StatCard, Modal, Field, Textarea, Toggle, ConfirmDialog, Input } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import { todayStr, timeToMin, ageFrom, nowMinutes, minToTime, addDays } from '../../lib/format'

/**
 * لوحة طبيب الأسنان — نموذج لوحة تحكم خاص باختصاص طب الأسنان.
 * Built for the dentistry specialty: dental stats, dental activity feed,
 * and the same fast waiting-queue workflow.
 */
export default function DentalDashboard() {
  const { profile, settings, toast } = useApp()
  const [appts, setAppts] = useState(null)
  const [dentalFeed, setDentalFeed] = useState(null)
  const [weekCount, setWeekCount] = useState(null)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [emergencyNote, setEmergencyNote] = useState('')
  const [emergencyCancel, setEmergencyCancel] = useState(true)
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [emergencyDone, setEmergencyDone] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [newP, setNewP] = useState({ name: '', age: '', phone: '' })
  const [creating, setCreating] = useState(false)
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

  // إضافة مريض سريعة من اللوحة: اسم + عمر ثم فتح كشفه مباشرة
  const createAndOpen = async () => {
    if (!newP.name.trim()) return toast('error', 'اسم المريض مطلوب')
    const age = Number(newP.age)
    if (!Number.isFinite(age) || age < 0 || age > 120) return toast('error', 'أدخل عمراً صحيحاً')
    setCreating(true)
    const now = new Date()
    const dob = new Date(now.getFullYear() - age, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('patients')
      .insert({ clinic_id: profile.clinic_id, full_name: newP.name.trim(), phone: newP.phone.trim() || '—', date_of_birth: dob, created_by: profile.id })
      .select()
      .single()
    setCreating(false)
    if (error) return toast('error', 'تعذر الإضافة: ' + error.message)
    audit(profile.clinic_id, 'create_patient', 'patients', data.id)
    setAddOpen(false)
    setNewP({ name: '', age: '', phone: '' })
    nav(`/doctor/consultation/new/${data.id}`)
  }

  const runEmergency = async () => {    setEmergencyBusy(true)
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

  return (
    <div>
      <PageHeader
        title={`لوحة طبيب الأسنان`}
        subtitle={`${profile?.full_name} — ${profile?.clinic?.name || ''}`}
        actions={
          <div className="flex gap-2">
            {/* الطبيب الشامل: يحجز بنفسه — لا يوجد موظف استقبال في عيادته */}
            {profile?.self_service && (
              <Button variant="secondary" onClick={() => setBookingOpen(true)}>
                <CalendarPlus size={16} />
                حجز موعد
              </Button>
            )}
            <Button onClick={() => nav('/doctor/consultation')}>
              <Stethoscope size={16} />
              كشف أسنان جديد
            </Button>
          </div>
        }
      />

      {/* dental stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="مواعيد اليوم" value={todayCount} icon={CalendarDays} tone="blue" to="/doctor/schedule" />
        <StatCard label="في الانتظار" value={queue.length} icon={Hourglass} tone="amber" />
        <StatCard label="قيد الكشف" value={current.length} icon={Stethoscope} tone="teal" />
        <StatCard label="إجراءات آخر 7 أيام" value={weekCount ?? '—'} icon={SmilePlus} tone="violet" />
      </div>

      {/* إضافة مريض سريعة — في جسم الواجهة بمكان ظاهر */}
      <div className="mb-5">
        <button
          onClick={() => setAddOpen(true)}
          className="flex w-full items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50/50 px-5 py-4 text-start transition-colors hover:border-primary-500 hover:bg-primary-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-700 text-white">
              <UserPlus size={22} />
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-800">إضافة مريض جديد</span>
              <span className="block text-[11px] text-slate-500">أدخل الاسم والعمر — ينتقل بعدها مباشرة إلى واجهة كشفه الخاصة</span>
            </span>
          </span>
          <span className="text-xs font-bold text-primary-700">إضافة ←</span>
        </button>
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
            <button onClick={() => nav('/doctor/prices')} className="rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Wallet size={16} className="text-primary-600" /> أسعاري</p>
              <p className="mt-1 text-[11px] text-slate-400">فئات التشخيص وعلاجاتها بأسعارها — تُحسب تلقائياً في الكشف</p>
            </button>
            <button onClick={() => nav('/doctor/today-log')} className="rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><NotebookPen size={16} className="text-primary-600" /> سجلي اليوم</p>
              <p className="mt-1 text-[11px] text-slate-400">ماذا عملت اليوم ومبلغ المدفوع — إضافة وتعديل وحذف</p>
            </button>
            <button onClick={() => nav('/doctor/payments')} className="rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Banknote size={16} className="text-primary-600" /> الدفعات</p>
              <p className="mt-1 text-[11px] text-slate-400">حساب كل مريض: المتبقي بالأحمر والمسدد بالأخضر + الخصومات</p>
            </button>
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
            <button onClick={() => nav('/doctor/archive')} className="rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Activity size={16} className="text-primary-600" /> أرشيف المرضى</p>
              <p className="mt-1 text-[11px] text-slate-400">راجع أي كشف سابق بتفاصيله الكاملة</p>
            </button>
          </div>
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
          سيُرسل اعتذار جماعي باسمك لكل مرضى اليوم عبر قنواتهم (إشعار تطبيق دليل طبي)، مع طلب إعادة الحجز.
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

      {/* نافذة إضافة مريض جديد: اسم + عمر ثم فتح كشفه */}
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onBooked={load} />
      <Modal
        open={addOpen}
        onClose={() => !creating && setAddOpen(false)}
        title="مريض جديد"
        subtitle="الاسم والعمر فقط — شكل الفك سيُبنى على العمر تلقائياً"
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={createAndOpen} loading={creating}>إضافة وفتح كشفه</Button>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={creating}>إلغاء</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="الاسم" required>
            <Input value={newP.name} onChange={(e) => setNewP((p) => ({ ...p, name: e.target.value }))} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="العمر (سنة)" required>
              <Input type="number" dir="ltr" min={0} max={120} value={newP.age} onChange={(e) => setNewP((p) => ({ ...p, age: e.target.value }))} placeholder="مثال: 8" />
            </Field>
            <Field label="الهاتف (اختياري)">
              <Input dir="ltr" value={newP.phone} onChange={(e) => setNewP((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
          </div>
          {newP.age !== '' && Number(newP.age) < 12 && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
              طفل — سيظهر فك {Number(newP.age) < 6 ? 'الأسنان اللبنية (20 سنّاً) صغيراً' : 'التبديل المختلط: أسنان لبنية وأخرى دائمة'}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
