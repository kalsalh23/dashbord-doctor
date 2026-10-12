import { useEffect, useState } from 'react'
import { CalendarOff, Clock, Save } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, PageHeader, Toggle, Spinner } from '../../components/ui'
import { useSchedules } from '../../lib/hooks'
import { timeToMin } from '../../lib/format'
import { buildSlots } from '../../lib/slots'

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
  const [edits, setEdits] = useState({}) // { [weekday]: { active?, start?, end? } } — فوق القيم المحفوظة
  const [saving, setSaving] = useState(false)

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

  const save = async () => {
    if (!schedules.length) return
    for (const s of schedules) {
      const r = rowFor(s.weekday)
      if (r.active && timeToMin(r.end) <= timeToMin(r.start)) {
        return toast('error', `يوم ${WEEKDAY_NAMES[s.weekday]}: نهاية الدوام يجب أن تكون بعد بدايته`)
      }
    }
    setSaving(true)
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
      toast('success', 'تم حفظ أوقات الدوام — أيام العطلة تختفي من الحجز فوراً')
    } catch (e) {
      toast('error', 'تعذر الحفظ: ' + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  const slotsCount = (r) =>
    buildSlots({ start: r.start, end: r.end, slotMinutes, slotsBeforeBreak, breakMinutes }).length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="أوقات دوامي"
        subtitle="حدد دوام كل يوم — واجعل اليوم عطلة فيختفي من الحجز تماماً"
        actions={
          <Button onClick={save} loading={saving} disabled={!schedules.length}>
            <Save size={16} />
            <span className="hidden sm:inline">حفظ أوقات الدوام</span>
            <span className="sm:hidden">حفظ</span>
          </Button>
        }
      />

      {schedules.length === 0 ? (
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
                      <div className="mt-2.5 flex items-center gap-2 sm:ms-12" dir="ltr">
                        <input
                          type="time"
                          value={r.start}
                          onChange={(e) => setRow(wd, { start: e.target.value })}
                          className="input-base h-10 min-w-0 flex-1 !py-0 sm:!w-32 sm:flex-none"
                          aria-label={`بداية دوام ${WEEKDAY_NAMES[wd]}`}
                        />
                        <span className="shrink-0 text-xs text-slate-400">—</span>
                        <input
                          type="time"
                          value={r.end}
                          onChange={(e) => setRow(wd, { end: e.target.value })}
                          className="input-base h-10 min-w-0 flex-1 !py-0 sm:!w-32 sm:flex-none"
                          aria-label={`نهاية دوام ${WEEKDAY_NAMES[wd]}`}
                        />
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
