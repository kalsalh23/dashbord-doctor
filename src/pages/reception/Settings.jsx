import { useEffect, useState } from 'react'
import { AlertTriangle, Save } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Select, Textarea, Toggle, Modal, PageHeader, Spinner } from '../../components/ui'
import { useSchedules } from '../../lib/hooks'
import { weekdayName } from '../../lib/format'

const DEFAULTS = { start_time: '17:00', end_time: '21:00' }

export default function Settings() {
  const { profile, settings, toast, refreshSettings } = useApp()
  const [schedules, reloadSchedules] = useSchedules()
  const [clinic, setClinic] = useState(null)
  const [form, setForm] = useState(null)
  const [days, setDays] = useState([])
  const [globalCfg, setGlobalCfg] = useState({ slot_minutes: 10, slots_before_break: 8, break_minutes: 10 })
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState(null)

  useEffect(() => {
    if (!profile?.clinic_id || !settings) return
    setClinic(settings)
    setForm({
      name: profile.clinic?.name || '',
      specialty: profile.clinic?.specialty || '',
      phone: profile.clinic?.phone || '',
      address: profile.clinic?.address || '',
      doctor_name: settings.doctor_name || '',
      consultation_price: settings.consultation_price ?? 0,
      currency: settings.currency || 'ل.س',
      whatsapp_country_code: settings.whatsapp_country_code || '963',
      reminder_template: settings.reminder_template || '',
    })
    setGlobalCfg({
      slot_minutes: settings.slot_minutes ?? 10,
      slots_before_break: settings.slots_before_break ?? 8,
      break_minutes: settings.break_minutes ?? 10,
    })
  }, [profile, settings])

  useEffect(() => {
    // build a 7-day editable list, creating rows on the fly for missing weekdays
    setDays(
      [0, 1, 2, 3, 4, 5, 6].map((wd) => {
        const row = schedules.find((s) => s.weekday === wd)
        return {
          weekday: wd,
          id: row?.id || null,
          is_active: row?.is_active || false,
          start_time: row?.start_time || DEFAULTS.start_time,
          end_time: row?.end_time || DEFAULTS.end_time,
        }
      })
    )
  }, [schedules])

  if (!form || !clinic) return <Spinner />

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setDay = (wd, patch) => setDays((ds) => ds.map((d) => (d.weekday === wd ? { ...d, ...patch } : d)))

  // future active appointments that fall outside the new hours
  const findOutsideAppointments = async () => {
    const today = new Date()
    const { data } = await supabase
      .from('appointments')
      .select('id, appointment_date, start_time, patient:patients(full_name)')
      .eq('clinic_id', profile.clinic_id)
      .gte('appointment_date', today.toISOString().slice(0, 10))
      .not('status', 'in', '(cancelled,no_show,completed)')
      .order('appointment_date')
      .limit(500)
    const outside = []
    for (const a of data || []) {
      const wd = new Date(a.appointment_date + 'T00:00:00').getDay()
      const row = days.find((d) => d.weekday === wd)
      const t = a.start_time?.slice(0, 5)
      const bad = !row?.is_active || t < row.start_time || t >= row.end_time
      if (bad) outside.push(a)
    }
    return outside
  }

  const save = async () => {
    if (!form.name.trim()) return toast('error', 'اسم العيادة مطلوب')
    setSaving(true)

    const outside = await findOutsideAppointments()
    if (outside.length > 0) {
      setSaving(false)
      setWarning(outside)
      return
    }
    await persist()
  }

  const persist = async () => {
    setSaving(true)
    // clinic
    const { error: e1 } = await supabase
      .from('clinics')
      .update({ name: form.name.trim(), specialty: form.specialty.trim(), phone: form.phone.trim(), address: form.address.trim() })
      .eq('id', profile.clinic_id)
    // settings
    const { error: e2 } = await supabase
      .from('clinic_settings')
      .update({
        doctor_name: form.doctor_name.trim(),
        consultation_price: Number(form.consultation_price) || 0,
        currency: form.currency.trim(),
        whatsapp_country_code: form.whatsapp_country_code.trim(),
        reminder_template: form.reminder_template,
        ...globalCfg,
      })
      .eq('clinic_id', profile.clinic_id)
    // schedules (upsert per weekday)
    let e3 = null
    for (const d of days) {
      const payload = {
        clinic_id: profile.clinic_id,
        weekday: d.weekday,
        start_time: d.start_time,
        end_time: d.end_time,
        is_active: d.is_active,
      }
      const res = d.id
        ? await supabase.from('doctor_schedules').update(payload).eq('id', d.id)
        : await supabase.from('doctor_schedules').insert(payload)
      if (res.error) e3 = res.error
    }
    setSaving(false)
    const err = e1 || e2 || e3
    if (err) return toast('error', 'تعذر الحفظ: ' + (err.message || ''))
    audit(profile.clinic_id, 'update_settings', 'clinics', profile.clinic_id)
    await refreshSettings()
    await reloadSchedules()
    setWarning(null)
    toast('success', 'تم حفظ الإعدادات بنجاح')
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="إعدادات العيادة" subtitle="هوية العيادة وساعات العمل وقواعد الحجز" />

      <div className="space-y-5">
        <Card title="معلومات العيادة">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="اسم العيادة" required className="sm:col-span-2">
              <Input value={form.name} onChange={setF('name')} />
            </Field>
            <Field label="اسم الطبيب">
              <Input value={form.doctor_name} onChange={setF('doctor_name')} placeholder="د. ..." />
            </Field>
            <Field label="التخصص">
              <Input value={form.specialty} onChange={setF('specialty')} />
            </Field>
            <Field label="هاتف العيادة">
              <Input value={form.phone} onChange={setF('phone')} dir="ltr" />
            </Field>
            <Field label="العنوان">
              <Input value={form.address} onChange={setF('address')} />
            </Field>
          </div>
        </Card>

        <Card title="قيمة الكشف والدفع">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="سعر الكشف">
              <Input type="number" min="0" value={form.consultation_price} onChange={setF('consultation_price')} />
            </Field>
            <Field label="العملة">
              <Input value={form.currency} onChange={setF('currency')} placeholder="ل.س / ر.س / $" />
            </Field>
            <Field label="مفتاح الدولة (واتساب)" hint="يُستخدم لبناء رابط التذكير">
              <Input value={form.whatsapp_country_code} onChange={setF('whatsapp_country_code')} dir="ltr" />
            </Field>
          </div>
        </Card>

        <Card title="أيام وساعات العمل" subtitle="يُعاد توليد المواعيد المتاحة تلقائيًا حسب هذه القواعد">
          <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3">
            <Field label="مدة الموعد (دقيقة)">
              <Input type="number" min="5" value={globalCfg.slot_minutes} onChange={(e) => setGlobalCfg((g) => ({ ...g, slot_minutes: e.target.value }))} />
            </Field>
            <Field label="مواعيد قبل الاستراحة">
              <Input type="number" min="1" value={globalCfg.slots_before_break} onChange={(e) => setGlobalCfg((g) => ({ ...g, slots_before_break: e.target.value }))} />
            </Field>
            <Field label="مدة الاستراحة (دقيقة)">
              <Input type="number" min="0" value={globalCfg.break_minutes} onChange={(e) => setGlobalCfg((g) => ({ ...g, break_minutes: e.target.value }))} />
            </Field>
          </div>

          <ul className="space-y-2">
            {days.map((d) => (
              <li key={d.weekday} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                <Toggle checked={d.is_active} onChange={(v) => setDay(d.weekday, { is_active: v })} label={weekdayName(d.weekday)} />
                <div className="ms-auto flex items-center gap-2">
                  <input
                    type="time"
                    className="input-base !w-28 !py-1.5"
                    value={d.start_time}
                    disabled={!d.is_active}
                    onChange={(e) => setDay(d.weekday, { start_time: e.target.value })}
                  />
                  <span className="text-xs text-slate-400">←</span>
                  <input
                    type="time"
                    className="input-base !w-28 !py-1.5"
                    value={d.end_time}
                    disabled={!d.is_active}
                    onChange={(e) => setDay(d.weekday, { end_time: e.target.value })}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            عند تعديل ساعات العمل لا يتم حذف أو نقل المواعيد المحجوزة تلقائيًا — سيظهر لك تنبيه بالمواعيد التي أصبحت خارج أوقات العمل.
          </p>
        </Card>

        <Card title="نموذج رسالة التذكير" subtitle="متغيرات متاحة: {patient} {doctor} {when} {time}">
          <Textarea rows={4} value={form.reminder_template} onChange={setF('reminder_template')} />
        </Card>

        <div className="flex justify-end pb-4">
          <Button size="lg" onClick={save} loading={saving}>
            <Save size={16} />
            حفظ الإعدادات
          </Button>
        </div>
      </div>

      <Modal
        open={!!warning}
        onClose={() => setWarning(null)}
        title="مواعيد أصبحت خارج ساعات العمل"
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={persist} loading={saving}>
              <AlertTriangle size={15} />
              حفظ على أي حال
            </Button>
            <Button variant="secondary" onClick={() => setWarning(null)} disabled={saving}>
              رجوع للتعديل
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          هناك <b>{warning?.length}</b> موعد قادم أصبح خارج أوقات العمل الجديدة. <b>لن يتم حذفه أو نقله تلقائيًا</b> — يمكنك
          تعديله لاحقًا من شاشة المواعيد.
        </p>
        <ul className="max-h-48 space-y-1.5 overflow-y-auto">
          {(warning || []).map((a) => (
            <li key={a.id} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {a.patient?.full_name} — {a.appointment_date} الساعة {a.start_time?.slice(0, 5)}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
