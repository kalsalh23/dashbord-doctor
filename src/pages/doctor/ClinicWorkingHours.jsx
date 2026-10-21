import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CalendarOff, Clock, Save } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Modal, PageHeader, Spinner, Toggle } from '../../components/ui'
import { useSchedules } from '../../lib/hooks'
import { timeToMin, getWeekday, todayStr, formatDateShort } from '../../lib/format'
import { buildSlots } from '../../lib/slots'
import { isFatimaClinic, isFadwaClinic } from '../../lib/clinicStyle'

/**
 * أوقات دوامي — عيادة الدكتورة فاطمة سالم الجاموس وعيادة الدكتورة فدوى الرحال
 * تحدّد أيام الدوام وأوقاتها، وهي نفس الأوقات التي تُبنى منها مواعيد
 * الحجز (شاشة الاستقبال + جدول الطبيب + منصة دليلك الطبي).
 * يوم العطلة يختفي من الحجز تماماً.
 */

const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] // السبت أولاً — الجمعة أخيراً
const WEEKDAY_NAMES = { 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت' }
const DEFAULT_START = '17:00'
const DEFAULT_END = '21:00'
const hhmm = (t) => (t || '').slice(0, 5)

export default function ClinicWorkingHours() {
  const { profile, settings, toast } = useApp()
  const nav = useNavigate()
  const isFatima = isFatimaClinic(profile)
  const isFadwa = isFadwaClinic(profile)
  const [schedules, reload] = useSchedules()
  const [edits, setEdits] = useState({}) // { [weekday]: { active?, start?, end? } } — فوق القيم المحفوظة
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState(null) // مواعيد صارت خارج أوقات الدوام بعد التعديل

  // قواعد توليد المواعيد — نفس افتراضات slotsForDay المستخدمة في شاشة الحجز
  const slotMinutes = Number(settings?.examination_minutes ?? settings?.consultation_minutes ?? settings?.slot_minutes) || 10
  const slotsBeforeBreak = Number(settings?.slots_before_break ?? 8)
  const breakMinutes = Number(settings?.break_minutes ?? 10)

  // الصف الفعلي = القيم المحفوظة + التعديلات المحلية (حتى لا تسبق حالة التحميل البيانات)
  const rowFor = (wd) => {
    const s = schedules.find((x) => x.weekday === wd)
    const e = edits[wd] || {}
    return {
      id: s?.id || null,
      active: e.active ?? !!s?.is_active,
      start: e.start ?? (hhmm(s?.start_time) || DEFAULT_START),
      end: e.end ?? (hhmm(s?.end_time) || DEFAULT_END),
    }
  }

  const setRow = (wd, patch) => setEdits((m) => ({ ...m, [wd]: { ...m[wd], ...patch } }))

  // المواعيد القادمة — لعرض عدد الحجوزات في كل يوم ولكشف ما قد يخرج عن الأوقات الجديدة
  const loadAppts = useCallback(async () => {
    if (!profile?.clinic_id) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('appointments')
      .select('id, appointment_date, start_time, end_time, status, patient:patients(full_name)')
      .eq('clinic_id', profile.clinic_id)
      .gte('appointment_date', todayStr())
      .not('status', 'in', '(cancelled,no_show,completed)')
      .order('appointment_date')
      .limit(500)
    setAppts(data || [])
    setLoading(false)
  }, [profile?.clinic_id])

  useEffect(() => {
    loadAppts()
  }, [loadAppts])

  // عدد الحجوزات القادمة في كل يوم من أيام الأسبوع
  const bookedByDay = useMemo(() => {
    const m = {}
    for (const a of appts) {
      const wd = getWeekday(a.appointment_date)
      m[wd] = (m[wd] || 0) + 1
    }
    return m
  }, [appts])

  // المواعيد التي ستصبح خارج أوقات الدوام بعد حفظ التعديل
  const isOutside = (a) => {
    const r = rowFor(getWeekday(a.appointment_date))
    if (!r.active) return true
    const t = hhmm(a.start_time)
    return t < r.start || t >= r.end
  }

  const slotsOf = (r) =>
    r.active ? buildSlots({ start: r.start, end: r.end, slotMinutes, slotsBeforeBreak, breakMinutes }) : []

  // كتابة مباشرة في جدول الدوام — والتحقق بعدها لأن سياسة الأمان قد تُسقط التعديل بصمت
  const writeRows = async () => {
    for (const wd of WEEK_ORDER) {
      const r = rowFor(wd)
      const { error } = r.id
        ? await supabase
            .from('doctor_schedules')
            .update({ start_time: r.start, end_time: r.end, is_active: r.active })
            .eq('id', r.id)
        : await supabase.from('doctor_schedules').insert({
            clinic_id: profile.clinic_id,
            weekday: wd,
            start_time: r.start,
            end_time: r.end,
            is_active: r.active,
          })
      if (error) throw error
    }
  }

  const mismatches = async () => {
    const { data: fresh } = await supabase
      .from('doctor_schedules')
      .select('id, weekday, is_active, start_time, end_time')
      .eq('clinic_id', profile.clinic_id)
    const map = new Map((fresh || []).map((x) => [x.weekday, x]))
    const bad = []
    for (const wd of WEEK_ORDER) {
      const r = rowFor(wd)
      const row = map.get(wd)
      if (!row) {
        bad.push(wd)
        continue
      }
      if (
        !!row.is_active !== !!r.active ||
        hhmm(row.start_time) !== r.start ||
        hhmm(row.end_time) !== r.end
      ) {
        bad.push(wd)
      }
    }
    return bad
  }

  const save = async (force = false) => {
    for (const wd of WEEK_ORDER) {
      const r = rowFor(wd)
      if (!r.active) continue
      if (timeToMin(r.end) <= timeToMin(r.start)) {
        return toast('error', `يوم ${WEEKDAY_NAMES[wd]}: نهاية الدوام يجب أن تكون بعد بدايته`)
      }
      if (timeToMin(r.end) - timeToMin(r.start) < slotMinutes) {
        return toast('error', `يوم ${WEEKDAY_NAMES[wd]}: مدة الدوام قصيرة — لا تتسع موعداً واحداً (${slotMinutes} دقيقة)`)
      }
    }
    const outside = appts.filter(isOutside)
    if (outside.length && !force) {
      setWarning(outside)
      return
    }
    setSaving(true)
    try {
      await writeRows()
      let bad = await mismatches()
      if (bad.length) {
        // الكتابة المباشرة لم تُحفظ (صلاحيات) — تُجرّب دالة الحفظ المخصّصة
        const days = WEEK_ORDER.map((wd) => {
          const r = rowFor(wd)
          return { weekday: wd, active: r.active, start: r.start, end: r.end }
        })
        const { error: rpcErr } = await supabase.rpc('set_clinic_working_hours', { p_days: days })
        if (rpcErr) {
          throw new Error(
            'لم يتم حفظ الأوقات — تحقّق من صلاحيات حسابك (طبيب أو مشرف للعيادة) ثم أعد المحاولة.'
          )
        }
        bad = await mismatches()
        if (bad.length) {
          throw new Error(`تعذّر حفظ دوام ${WEEKDAY_NAMES[bad[0]]}.`)
        }
      }
      setEdits({})
      setWarning(null)
      await reload()
      await loadAppts()
      audit(profile.clinic_id, 'update_working_hours', 'doctor_schedules', profile.clinic_id)
      toast('success', 'تم حفظ أوقات الدوام — وهي الآن الأوقات التي تظهر في الحجز')
    } catch (e) {
      toast('error', 'تعذر الحفظ: ' + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  if (!isFatima && !isFadwa) {
    nav('/doctor')
    return null
  }

  const activeDays = WEEK_ORDER.filter((wd) => rowFor(wd).active)
  const totalSlots = activeDays.reduce((sum, wd) => sum + slotsOf(rowFor(wd)).length, 0)
  const totalBooked = appts.length

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <PageHeader
        title="أوقات دوامي"
        subtitle="حدّد أيام الدوام وأوقاتها — هذه الأوقات هي نفسها التي تظهر في شاشة الحجز"
        actions={
          <Button onClick={() => save()} loading={saving}>
            <Save size={16} />
            <span className="hidden sm:inline">حفظ أوقات الدوام</span>
            <span className="sm:hidden">حفظ</span>
          </Button>
        }
      />

      {/* ملخّص الجدول */}
      <div className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-card">
          <p className="text-[11px] font-semibold text-slate-400">أيام الدوام</p>
          <p className="mt-0.5 text-lg font-bold text-slate-800">{activeDays.length} / 7</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-card">
          <p className="text-[11px] font-semibold text-slate-400">مواعيد أسبوعياً</p>
          <p className="mt-0.5 text-lg font-bold text-slate-800">{totalSlots}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-card">
          <p className="text-[11px] font-semibold text-slate-400">حجوزات قادمة</p>
          <p className="mt-0.5 text-lg font-bold text-slate-800">{totalBooked}</p>
        </div>
      </div>

      {loading ? (
        <Card>
          <Spinner label="جارٍ تحميل أوقات الدوام..." />
        </Card>
      ) : (
        <Card bodyClass="!p-0">
          <ul className="divide-y divide-slate-100">
            {WEEK_ORDER.map((wd) => {
              const r = rowFor(wd)
              const slots = slotsOf(r)
              const booked = bookedByDay[wd] || 0
              return (
                <li key={wd} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        r.active ? 'bg-primary-50 text-primary-800' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Clock size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">{WEEKDAY_NAMES[wd]}</p>
                      <p className="text-[11px] leading-relaxed text-slate-400">
                        {r.active
                          ? `${slots.length} موعداً · ${slotMinutes} دقيقة للموعد${booked ? ` · ${booked} حجز قادم` : ''}`
                          : `عطلة — لا حجز في هذا اليوم${booked ? ` · ${booked} حجز قادم` : ''}`}
                      </p>
                    </div>
                    <Toggle checked={r.active} onChange={(v) => setRow(wd, { active: v })} label={r.active ? 'دوام' : 'عطلة'} />
                  </div>

                  {r.active && (
                    <div className="mt-3">
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                        <label className="flex flex-1 items-center gap-2.5">
                          <span className="text-xs text-slate-500">بداية الدوام</span>
                          <input
                            type="time"
                            dir="ltr"
                            value={r.start}
                            onChange={(e) => setRow(wd, { start: e.target.value })}
                            className="input-base h-10 flex-1 !py-0 sm:!w-32"
                            aria-label={`بداية دوام ${WEEKDAY_NAMES[wd]}`}
                          />
                        </label>
                        <label className="flex flex-1 items-center gap-2.5">
                          <span className="text-xs text-slate-500">نهاية الدوام</span>
                          <input
                            type="time"
                            dir="ltr"
                            value={r.end}
                            onChange={(e) => setRow(wd, { end: e.target.value })}
                            className="input-base h-10 flex-1 !py-0 sm:!w-32"
                            aria-label={`نهاية دوام ${WEEKDAY_NAMES[wd]}`}
                          />
                        </label>
                      </div>

                      {/* معاينة الأوقات التي ستظهر في الحجز لهذا اليوم */}
                      {slots.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-slate-400">أوقات الحجز:</span>
                          {slots.slice(0, 8).map((s) => (
                            <span
                              key={s.start}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                              dir="ltr"
                            >
                              {s.start}
                            </span>
                          ))}
                          {slots.length > 8 && (
                            <span className="text-[10px] font-semibold text-slate-400">+{slots.length - 8}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
        <CalendarOff size={15} className="mt-0.5 shrink-0" />
        <span>
          أيام العطلة تختفي من الحجز تماماً — لا يمكن حجز أي موعد فيها.
          <br />
          مدة الموعد <b>{slotMinutes} دقيقة</b> (تُحدَّد من «إعداداتي») مع استراحة <b>{breakMinutes} دقيقة</b> كل{' '}
          <b>{slotsBeforeBreak} مواعيد</b>.
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => nav('/doctor/schedule')}>
          <CalendarDays size={15} />
          عرض المواعيد
        </Button>
        <Button variant="ghost" size="sm" onClick={() => nav('/doctor')}>
          رجوع إلى لوحة اليوم
        </Button>
      </div>

      {/* تنبيه: مواعيد صارت خارج أوقات الدوام الجديدة */}
      <Modal
        open={!!warning}
        onClose={() => setWarning(null)}
        title="مواعيد أصبحت خارج أوقات الدوام"
        subtitle="هذه المواعيد المجدولة ستبقى كما هي إن حفظت الأوقات الجديدة"
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => save(true)} loading={saving}>
              <AlertTriangle size={15} />
              حفظ على أي حال
            </Button>
            <Button variant="secondary" onClick={() => setWarning(null)} disabled={saving}>
              رجوع للتعديل
            </Button>
          </div>
        }
      >
        <ul className="space-y-2">
          {(warning || []).map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-amber-900">{a.patient?.full_name || 'مريض'}</p>
                <p className="text-[11px] text-amber-700">
                  {formatDateShort(a.appointment_date)} · {hhmm(a.start_time)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-amber-800">خارج الدوام</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
