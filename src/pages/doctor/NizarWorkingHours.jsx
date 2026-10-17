import { useEffect, useState } from 'react'
import { CalendarOff, Clock, Save, Cloud, CloudOff, Check } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, PageHeader, Toggle, Spinner } from '../../components/ui'
import { useSchedules } from '../../lib/hooks'
import { timeToMin } from '../../lib/format'
import { buildSlots } from '../../lib/slots'
import { BRIDGE_SECRET, BRIDGE_BASE } from '../../lib/bridge'

/**
 * أوقات دوامي — عيادة د. نزار عبد الستار الشيخ (قالب nizar)
 * تحديد دوام كل يوم من أيام الأسبوع، مع جعل اليوم عطلة فيختفي
 * من الحجز تماماً. الفاصل بين كل حجز والآخر 10 دقائق.
 */

const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] // السبت أولاً — الجمعة أخيراً
const WEEKDAY_NAMES = { 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت' }
const hhmm = (t) => (t || '').slice(0, 5)

export default function NizarWorkingHours() {
  const { profile, toast, settings } = useApp()
  const [schedules, reload] = useSchedules()
  const [loaded, setLoaded] = useState(false)
  const [edits, setEdits] = useState({}) // { [weekday]: { active?, start?, end? } } — فوق القيم المحفوظة
  const [saving, setSaving] = useState(false)
  const [syncState, setSyncState] = useState('idle') // idle | ok | failed — حالة المزامنة مع «دليلك الطبي»

  // قواعد توليد المواعيد الفعلية للعيادة — كما يستخدمها الحجز نفسه (نفس افتراضات slotsForDay)
  const slotMinutes = Number(settings?.slot_minutes) || 10
  const slotsBeforeBreak = Number(settings?.slots_before_break) || 8
  const breakMinutes = Number(settings?.break_minutes ?? 10)

  // الصف الفعلي = القيم المحفوظة + التعديلات المحلية (حتى لا تسبق حالة التحميل البيانات)
  const rowFor = (wd) => {
    const s = schedules.find((x) => x.weekday === wd)
    const e = edits[wd] || {}
    return {
      id: s?.id,
      active: e.active ?? !!s?.is_active,
      start: e.start ?? (hhmm(s?.start_time) || '17:00'),
      end: e.end ?? (hhmm(s?.end_time) || '21:00'),
    }
  }

  const setRow = (wd, patch) => setEdits((m) => ({ ...m, [wd]: { ...m[wd], ...patch } }))

  // مزامنة أوقات الدوام مع منصة «دليلك الطبي» يدوياً — يضمن وصول الجدول حتى لو تعذّر الإرسال الآلي
  const syncToDirectory = async () => {
    if (!profile?.clinic_id || schedules.length === 0) return
    setSyncState('idle')
    try {
      const workHours = {}
      for (const s of schedules) {
        const r = rowFor(s.weekday)
        const key = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][s.weekday]
        workHours[key] = r.active ? `${r.start} - ${r.end}` : 'مغلق'
      }
      const res = await fetch(`${BRIDGE_BASE}/api/bridge-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bridge-secret': BRIDGE_SECRET },
        body: JSON.stringify({
          clinic_id: profile.clinic_id,
          clinic_name: profile.clinic?.name || '',
          days: schedules.map((s) => {
            const r = rowFor(s.weekday)
            return { weekday: s.weekday, active: r.active, start: r.start, end: r.end }
          }),
          work_hours: workHours,
          slot_minutes: slotMinutes,
          slots_before_break: slotsBeforeBreak,
          break_minutes: breakMinutes,
          event: 'SYNC',
          updated_at: new Date().toISOString(),
        }),
      })
      setSyncState(res.ok ? 'ok' : 'failed')
      return res.ok
    } catch {
      setSyncState('failed')
      return false
    }
  }

  const save = async () => {
    if (!schedules.length) return
    for (const s of schedules) {
      const r = rowFor(s.weekday)
      if (r.active && timeToMin(r.end) <= timeToMin(r.start)) {
        return toast('error', `يوم ${WEEKDAY_NAMES[s.weekday]}: نهاية الدوام يجب أن تكون بعد بدايته`)
      }
    }
    setSaving(true)
    setSyncState('idle')
    try {
      for (const s of schedules) {
        const r = rowFor(s.weekday)
        const { error } = await supabase
          .from('doctor_schedules')
          .update({ is_active: r.active, start_time: r.start, end_time: r.end })
          .eq('id', s.id)
        if (error) throw error
      }
      setEdits({})
      await reload()
      // تحقّق فعلي من الحفظ: سياسة الأمان قد تُسقط التعديل بصمت بلا خطأ
      const { data: fresh } = await supabase
        .from('doctor_schedules')
        .select('id, weekday, is_active, start_time, end_time')
        .eq('clinic_id', profile.clinic_id)
      const mismatch = (fresh || []).find((row) => {
        const r = rowFor(row.weekday)
        return (
          !!row.is_active !== !!r.active ||
          String(row.start_time).slice(0, 5) !== r.start ||
          String(row.end_time).slice(0, 5) !== r.end
        )
      })
      if (mismatch) {
        throw new Error(
          `تعذّر حفظ يوم ${WEEKDAY_NAMES[mismatch.weekday]} — لا تملك صلاحية التعديل. ` +
            'تأكد أن حسابك طبيب أو مشرف في هذه العيادة.'
        )
      }
      // مزامنة «دليلك الطبي» — تُعرض نتيجتها للطبيب بوضوح
      const synced = await syncToDirectory()
      if (synced) {
        toast('success', 'تم حفظ أوقات الدوام وتحديثها في دليلك الطبي')
      } else {
        toast('info', 'تم حفظ أوقات الدوام — تعذّر تحديث «دليلك الطبي» تلقائياً، اضغط «مزامنة مع الدليل»')
      }
    } catch (e) {
      toast('error', 'تعذر الحفظ: ' + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  // هل انتهى تحميل الجدول؟ (حتى لا تظهر «لا توجد أيام دوام» لحظة التحميل)
  useEffect(() => {
    if (schedules.length > 0) setLoaded(true)
  }, [schedules])

  const slotsCount = (r) =>
    buildSlots({ start: r.start, end: r.end, slotMinutes, slotsBeforeBreak, breakMinutes }).length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="أوقات دوامي"
        subtitle="حدد دوام كل يوم — واجعل اليوم عطلة فيختفي من الحجز تماماً"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={syncToDirectory} disabled={!schedules.length || saving}>
              {syncState === 'ok' ? <Check size={15} /> : syncState === 'failed' ? <CloudOff size={15} /> : <Cloud size={15} />}
              <span className="hidden sm:inline">مزامنة مع الدليل</span>
              <span className="sm:hidden">مزامنة</span>
            </Button>
            <Button onClick={save} loading={saving} disabled={!schedules.length}>
              <Save size={16} />
              <span className="hidden sm:inline">حفظ أوقات الدوام</span>
              <span className="sm:hidden">حفظ</span>
            </Button>
          </div>
        }
      />

      {/* حالة المزامنة مع «دليلك الطبي» */}
      {syncState === 'ok' && (
        <p className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[11px] font-semibold text-emerald-800">
          <Cloud size={14} /> تم تحديث أوقات الدوام في «دليلك الطبي» بنجاح
        </p>
      )}
      {syncState === 'failed' && (
        <p className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-800">
          <CloudOff size={14} /> تعذّر تحديث «دليلك الطبي» — الحفظ داخل العيادة تم بنجاح. أعد المحاولة بزر «مزامنة مع الدليل».
        </p>
      )}

      {!loaded && schedules.length === 0 ? (
        <Card>
          <Spinner label="جارٍ تحميل أوقات الدوام..." />
        </Card>
      ) : schedules.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarOff} title="لا توجد أيام دوام معرّفة" message="راجع إعدادات العيادة أو أضف أيام الدوام من هناك" />
        </Card>
      ) : (
        <>
          <Card bodyClass="!p-0">
            <ul className="divide-y divide-slate-100">
              {WEEK_ORDER.filter((wd) => schedules.some((s) => s.weekday === wd)).map((wd) => {
                const r = rowFor(wd)
                return (
                  <li key={wd} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-800 sm:h-10 sm:w-10">
                        <Clock size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800">{WEEKDAY_NAMES[wd]}</p>
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          {r.active
                            ? `${slotsCount(r)} موعداً · فاصل ${slotMinutes} دقائق`
                            : 'عطلة — لا حجز في هذا اليوم'}
                        </p>
                      </div>
                      <Toggle checked={r.active} onChange={(v) => setRow(wd, { active: v })} label={r.active ? 'دوام' : 'عطلة'} />
                    </div>
                    {r.active && (
                      <div className="mt-3 flex flex-col gap-2.5" dir="ltr">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">بداية الدوام</span>
                          <input
                            type="time"
                            value={r.start}
                            onChange={(e) => setRow(wd, { start: e.target.value })}
                            className="input-base h-10 flex-1 !py-0 sm:!w-32"
                            aria-label={`بداية دوام ${WEEKDAY_NAMES[wd]}`}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">نهاية الدوام</span>
                          <input
                            type="time"
                            value={r.end}
                            onChange={(e) => setRow(wd, { end: e.target.value })}
                            className="input-base h-10 flex-1 !py-0 sm:!w-32"
                            aria-label={`نهاية دوام ${WEEKDAY_NAMES[wd]}`}
                          />
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
            <CalendarOff size={15} className="mt-0.5 shrink-0" />
            <span>
              أيام العطلة تختفي من الحجز تماماً — لا يمكن حجز أي موعد فيها.
              <br />
              الفاصل بين كل حجز والآخر <b>{slotMinutes} دقائق</b> تلقائياً في كل أيام الدوام.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
