import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Stethoscope, FolderOpen, History, SmilePlus,
  Activity, Siren, Wallet, NotebookPen, Banknote, UserPlus, CalendarPlus, Pill, Receipt, Clock,
} from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { hidesPatientsPage, hidesFavorites, usesLoudAlerts } from '../../lib/clinicStyle'
import { playAlert } from '../../lib/alert'
import { Button, Avatar, PageHeader, StatCard, Modal, Field, Textarea, Toggle, ConfirmDialog, Input } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import EmergencyApology from '../../components/EmergencyApology'
import { todayStr, addDays } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'

/**
 * لوحة طبيب الأسنان — نموذج لوحة تحكم خاص باختصاص طب الأسنان.
 * Built for the dentistry specialty: dental stats, dental activity feed,
 * and the same fast waiting-queue workflow.
 */
export default function DentalDashboard() {
  const { profile, settings, toast } = useApp()
  const [appts, setAppts] = useState(null)
  const [weekCount, setWeekCount] = useState(null)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [emergencyNote, setEmergencyNote] = useState('')
  const [emergencyCancel, setEmergencyCancel] = useState(true)
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [emergencyDone, setEmergencyDone] = useState(null)
  const [emergencyTargets, setEmergencyTargets] = useState(null) // { list, note, cancelled } — شاشة إرسال الاعتذار الجماعي
  const [addOpen, setAddOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [newP, setNewP] = useState({ name: '', age: '', phone: '' })
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const [apptsRes, weekRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, patient_id, appointment_date, start_time, end_time, status, patient:patients(id, full_name, phone, date_of_birth)')
        .eq('clinic_id', profile.clinic_id)
        .eq('appointment_date', todayStr())
        .in('status', ['arrived', 'waiting', 'in_consultation', 'confirmed'])
        .order('start_time'),
      supabase
        .from('dental_chart_entries')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', weekAgo),
    ])
    setAppts(apptsRes.data || [])
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

  const runEmergency = async () => {
    setEmergencyBusy(true)
    const { data, error } = await supabase.rpc('emergency_broadcast', {
      p_note: emergencyNote.trim(),
      p_cancel: emergencyCancel,
    })
    setEmergencyBusy(false)
    if (error) return toast('error', friendlyDbError(error))
    const count = typeof data === 'number' ? data : (data?.count ?? 0)

    // تحرير أوقات اليوم بالكامل: الدالة تُلغي (confirmed/new/arrived/waiting/in_consultation) —
    // والمكتملة (completed) تُلغي هنا لتعود كل أوقات الدوام قابلة للحجز فوراً بعد الحالة الإسعافية
    if (emergencyCancel) {
      const { data: doneToday } = await supabase
        .from('appointments')
        .select('id, notes')
        .eq('clinic_id', profile.clinic_id)
        .eq('appointment_date', todayStr())
        .eq('status', 'completed')
      for (const a of doneToday || []) {
        await supabase
          .from('appointments')
          .update({
            status: 'cancelled',
            notes: [a.notes, 'أُلغي بسبب حالة إسعافية'].filter(Boolean).join(' — '),
          })
          .eq('id', a.id)
      }
    }
    audit(profile.clinic_id, 'emergency_broadcast', 'appointments', null, { notified: count })
    setEmergencyOpen(false)
    setEmergencyNote('')
    // تنبيه صوتي داخل العيادة + إشعار خارجي للمرضى (صوت النظام عبر الدفع)
    playAlert('emergency', { loud: usesLoudAlerts(profile) })
    // قائمة مرضى اليوم جاهزة → شاشة إرسال الاعتذاز الجماعي (واتساب لكل مريض)
    if (data?.list) setEmergencyTargets({ list: data.list, note: emergencyNote.trim(), cancelled: emergencyCancel })
    else setEmergencyDone(count ?? 0)
    load()
  }

  const current = (appts || []).filter((a) => a.status === 'in_consultation')
  const todayCount = (appts || []).filter((a) => !['cancelled', 'no_show'].includes(a.status)).length

  return (
    // عمود مركزي محدود — لا يمتدّ إلى حافة الشاشة على الشاشات الكبيرة
    <div className="mx-auto max-w-4xl">

      <PageHeader
        title={`لوحة طبيب الأسنان`}
        subtitle={`${profile?.full_name} — ${profile?.clinic?.name || ''}`}
        actions={
          /* الأزرار: على الجوال تتساوى في العرض مع نصوص مختصرة — على الحاسوب بأحجامها الطبيعية */
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="dangerGhost"
              onClick={() => setEmergencyOpen(true)}
              disabled={todayCount === 0}
              title={todayCount === 0 ? 'لا توجد مواعيد اليوم' : 'إشعار جماعي لمرضى اليوم'}
              className="min-w-0 flex-1 justify-center !px-2 sm:flex-none sm:!px-4"
            >
              <Siren size={15} className="shrink-0" />
              <span className="truncate sm:hidden">إسعافية</span>
              <span className="hidden truncate sm:inline">حالة إسعافية</span>
            </Button>
            {/* الطبيب الشامل: يحجز بنفسه — لا يوجد موظف استقبال في عيادته */}
            {profile?.self_service && (
              <Button
                variant="secondary"
                onClick={() => setBookingOpen(true)}
                className="min-w-0 flex-1 justify-center !px-2 sm:flex-none sm:!px-4"
              >
                <CalendarPlus size={15} className="shrink-0" />
                <span className="truncate">حجز موعد</span>
              </Button>
            )}
            <Button
              onClick={() => nav('/doctor/consultation')}
              className="min-w-0 flex-1 justify-center !px-2 sm:flex-none sm:!px-4"
            >
              <Stethoscope size={15} className="shrink-0" />
              <span className="truncate sm:hidden">كشف جديد</span>
              <span className="hidden truncate sm:inline">كشف أسنان جديد</span>
            </Button>
          </div>
        }
      />

      {/* بطاقات الوصول السريع — الواجهة الرئيسية للعيادات السنية */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { to: '/doctor/consultation', label: 'جلسة جديدة', sub: 'كشف ومخطط أسنان للمريض', icon: SmilePlus, primary: true },
          // واجهة «المرضى» غير مطلوبة في هذه العيادة — يظهر الأرشيف فقط
          ...(hidesPatientsPage(profile) ? [] : [{ to: '/doctor/patients', label: 'المرضى', sub: 'ملفات المرضى، الأسنان، الفلقات', icon: FolderOpen, badge: null }]),
          { to: '/doctor/schedule', label: 'مواعيد اليوم', sub: 'جدول اليوم والمواعيد القادمة', icon: CalendarDays },
          { to: '/doctor/today-log', label: 'سجلي اليوم', sub: 'ما تم إنجازه اليوم', icon: NotebookPen },
          { to: '/doctor/payments', label: 'الدفعات', sub: 'قبايل الوصولات والأدوية المفترة', icon: Banknote },
          { to: '/doctor/prices', label: 'أسعاري', sub: 'أسعار عيادتك على المخطط', icon: Wallet },
          // عيادة د. عارف: «أوقات دوامي» بدل «أدويتي الشائعة»
          ...(hidesFavorites(profile)
            ? [{ to: '/doctor/hours', label: 'أوقات دوامي', sub: 'دوام أيام الأسبوع والعطل', icon: Clock }]
            : [{ to: '/doctor/favorites', label: 'أدويتي الشائعة', sub: 'أدوية توصف بضغطة', icon: Pill }]),
          { to: '/doctor/archive', label: 'أرشيف المرضى', sub: 'سجل الزيارات والكشوف', icon: History },
          { to: '/doctor/expenses', label: 'المصاريف', sub: 'مصاريف العيادة', icon: Receipt },
          { to: '/doctor/settings', label: 'إعداداتي', sub: 'الهوية والأسعار والقوالب', icon: Activity },
        ].map((c) =>
          c.primary ? (
            <button
              key={c.to}
              type="button"
              onClick={() => nav(c.to)}
              className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl bg-primary-700 px-3 py-4 text-white shadow-card transition-transform hover:scale-[1.02]"
            >
              <c.icon size={26} />
              <span className="text-sm font-bold">{c.label}</span>
              <span className="text-[10px] text-primary-100">{c.sub}</span>
            </button>
          ) : (
            <button
              key={c.to}
              type="button"
              onClick={() => nav(c.to)}
              className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50/40"
            >
              <c.icon size={24} className="text-primary-700" />
              <span className="text-sm font-bold text-slate-800">{c.label}</span>
              <span className="text-center text-[10px] leading-snug text-slate-400">{c.sub}</span>
            </button>
          )
        )}
      </div>

      {/* dental stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="مواعيد اليوم" value={todayCount} icon={CalendarDays} tone="blue" to="/doctor/schedule" />
        <StatCard label="قيد الكشف" value={current.length} icon={Stethoscope} tone="teal" />
        <StatCard label="إجراءات آخر 7 أيام" value={weekCount ?? '—'} icon={SmilePlus} tone="violet" />
      </div>

      {/* إضافة مريض سريعة — في جسم الواجهة بمكان ظاهر */}
      {!hidesPatientsPage(profile) && (
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
      )}

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

      {/* dental activity feed */}
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
          باعتمادك تظهر قائمة مرضى اليوم المتأثرين، وترسل لهم رسالة اعتذار واحدة (SMS مجاني أو واتساب)، مع طلب إعادة الحجز.
        </p>
        <p className="mb-3 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2.5 text-xs leading-relaxed text-primary-900">
          <b>مواعيد اليوم ستُلغى تلقائياً</b> — فتعود كل الأوقات إلى وضعها الأصلي <b>القابل للحجز</b> فوراً.
        </p>
        <Field label="نص إضافي (اختياري)" hint="مثال: الحالة إسعافية في المستشفى — سنرد عليكم لترتيب موعد بديل">
          <Textarea value={emergencyNote} onChange={(e) => setEmergencyNote(e.target.value)} rows={2} />
        </Field>
      </Modal>

      {/* شاشة إرسال الاعتذار الجماعي عبر واتساب لكل مريض متأثر */}
      <EmergencyApology
        open={!!emergencyTargets}
        onClose={() => setEmergencyTargets(null)}
        targets={emergencyTargets}
      />

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
      {!hidesPatientsPage(profile) && (
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
      )}
    </div>
  )
}
