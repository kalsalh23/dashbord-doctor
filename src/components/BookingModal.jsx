import { useEffect, useMemo, useState } from 'react'
import { UserPlus, CalendarCheck } from 'lucide-react'
import { Modal, Button, Input, Select, Field, Spinner, EmptyState } from './ui'
import { useApp, audit } from '../lib/store'
import { useSchedules, fetchBookedMap, friendlyDbError } from '../lib/hooks'
import { slotsForDay } from '../lib/slots'
import { todayStr, addDays, dayLabel, formatDateShort, nowMinutes, timeToMin, genderLabel, ageFrom } from '../lib/format'
import { supabase } from '../lib/supabase'

/**
 * Booking flow: patient (search / quick create) -> date -> slot -> confirm.
 * props:
 *  - open, onClose
 *  - onBooked(appt)                 called after successful booking
 *  - presetPatient                  optional {id, full_name, phone}
 *  - presetDate                     optional 'YYYY-MM-DD'
 *  - moveAppointment                optional appointment row to reschedule
 */
export default function BookingModal({ open, onClose, onBooked, presetPatient, presetDate, moveAppointment }) {
  const { profile, settings, toast } = useApp()
  const [schedules] = useSchedules()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [patient, setPatient] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newPatient, setNewPatient] = useState({ full_name: '', phone: '', gender: '', date_of_birth: '' })
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [date, setDate] = useState(presetDate || todayStr())
  const [booked, setBooked] = useState({})
  const [slot, setSlot] = useState(null)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setPatient(presetPatient || (moveAppointment ? moveAppointment.patient : null))
    setSearch('')
    setResults([])
    setShowNew(false)
    setSlot(null)
    setDate(presetDate || (moveAppointment ? moveAppointment.appointment_date : todayStr()))
  }

  useEffect(() => {
    if (open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetPatient, presetDate, moveAppointment?.id])

  // patient search
  useEffect(() => {
    if (!open || patient) return
    const q = search.trim()
    if (q.length < 1) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, date_of_birth, gender')
        .eq('clinic_id', profile.clinic_id)
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(6)
      setResults(data || [])
      setSearching(false)
    }, 250)
    return () => {
      clearTimeout(t)
      setSearching(false)
    }
  }, [search, open, patient, profile?.clinic_id])

  // booked slots for selected date
  useEffect(() => {
    if (!open || !profile?.clinic_id || !date) return
    let alive = true
    fetchBookedMap(profile.clinic_id, date).then((m) => alive && setBooked(m))
    return () => {
      alive = false
    }
  }, [open, date, profile?.clinic_id])

  const { closed, slots } = useMemo(
    () => slotsForDay({ schedules, settings, dateStr: date }),
    [schedules, settings, date]
  )

  const isPastSlot = (s) => {
    if (date !== todayStr()) return false
    return timeToMin(s.start) <= nowMinutes()
  }

  const createPatient = async () => {
    if (!newPatient.full_name.trim() || !newPatient.phone.trim()) {
      toast('error', 'الاسم ورقم الهاتف مطلوبان')
      return
    }
    setCreatingPatient(true)
    const { data, error } = await supabase
      .from('patients')
      .insert({ clinic_id: profile.clinic_id, ...newPatient, gender: newPatient.gender || null, date_of_birth: newPatient.date_of_birth || null })
      .select('id, full_name, phone, date_of_birth, gender')
      .single()
    setCreatingPatient(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'create_patient', 'patients', data.id)
    setPatient(data)
    setShowNew(false)
    toast('success', 'تمت إضافة المريض')
  }

  const confirm = async () => {
    if (!patient || !slot) return
    setSaving(true)
    const payloadBase = {
      appointment_date: date,
      start_time: slot.start,
      end_time: slot.end,
    }
    let error
    if (moveAppointment) {
      ;({ error } = await supabase.from('appointments').update({ ...payloadBase, status: 'confirmed', reminder_sent_at: null }).eq('id', moveAppointment.id))
    } else {
      ;({ error } = await supabase.from('appointments').insert({
        clinic_id: profile.clinic_id,
        patient_id: patient.id,
        status: 'confirmed',
        price: settings?.consultation_price ?? null,
        created_by: profile.id,
        ...payloadBase,
      }))
    }
    setSaving(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, moveAppointment ? 'move_appointment' : 'book_appointment', 'appointments', moveAppointment?.id, { date, ...slot })
    toast('success', moveAppointment ? 'تم تعديل الموعد بنجاح' : 'تم حجز الموعد بنجاح')
    onBooked?.()
    onClose()
  }

  const price = settings?.consultation_price
  const currency = settings?.currency

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={moveAppointment ? 'تعديل الموعد' : 'حجز موعد جديد'}
      subtitle="اختر المريض ثم اليوم والوقت المناسب"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {patient && slot ? (
              <>
                <b className="text-slate-700">{patient.full_name}</b> · {dayLabel(date)} · {slot.start}
                {price ? ` · ${Number(price).toLocaleString('en-US')} ${currency || ''}` : ''}
              </>
            ) : (
              'أكمل اختيار المريض والوقت'
            )}
          </p>
          <Button onClick={confirm} disabled={!patient || !slot} loading={saving} className="min-w-36">
            <CalendarCheck size={16} />
            {moveAppointment ? 'حفظ التعديل' : 'تأكيد الحجز'}
          </Button>
        </div>
      }
    >
      {/* 1) patient */}
      {!patient ? (
        <div className="mb-5">
          <p className="label-base">المريض</p>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              autoFocus
            />
            <Button variant={showNew ? 'secondary' : 'primary'} onClick={() => setShowNew((v) => !v)} className="shrink-0">
              <UserPlus size={16} />
              مريض جديد
            </Button>
          </div>

          {showNew && (
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-primary-100 bg-primary-50/40 p-3 sm:grid-cols-2">
              <Field label="الاسم الكامل" required className="col-span-2 sm:col-span-1">
                <Input value={newPatient.full_name} onChange={(e) => setNewPatient({ ...newPatient, full_name: e.target.value })} placeholder="مثال: محمد أحمد" />
              </Field>
              <Field label="رقم الهاتف" required className="col-span-2 sm:col-span-1">
                <Input value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} placeholder="09xxxxxxxx" dir="ltr" />
              </Field>
              <Field label="الجنس">
                <Select value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}>
                  <option value="">—</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </Select>
              </Field>
              <Field label="تاريخ الميلاد">
                <Input type="date" value={newPatient.date_of_birth} onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })} />
              </Field>
              <div className="col-span-2">
                <Button onClick={createPatient} loading={creatingPatient} size="sm">حفظ المريض</Button>
              </div>
            </div>
          )}

          {!showNew && search.trim().length > 0 && (
            <div className="mt-3 space-y-1.5">
              {searching && <Spinner label="جارٍ البحث..." />}
              {!searching && results.length === 0 && (
                <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
                  لا يوجد مريض مطابق — أضف مريضًا جديدًا
                </p>
              )}
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPatient(p)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-start hover:border-primary-300 hover:bg-primary-50/40"
                >
                  <span className="text-sm font-semibold text-slate-700">{p.full_name}</span>
                  <span className="text-xs text-slate-400" dir="ltr">
                    {p.phone}
                    {p.date_of_birth ? ` · ${ageFrom(p.date_of_birth)} سنة` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-primary-100 bg-primary-50/50 px-3 py-2.5">
          <div>
            <p className="text-sm font-bold text-slate-800">{patient.full_name}</p>
            <p className="text-xs text-slate-500" dir="ltr">{patient.phone}</p>
          </div>
          {!moveAppointment && (
            <Button variant="ghost" size="sm" onClick={() => { setPatient(null); setSearch('') }}>
              تغيير
            </Button>
          )}
        </div>
      )}

      {/* 2) date */}
      <div className="mb-4">
        <p className="label-base">اليوم</p>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'اليوم', v: todayStr() },
            { label: 'غدًا', v: addDays(todayStr(), 1) },
          ].map((d) => (
            <button
              key={d.v}
              onClick={() => setDate(d.v)}
              className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                date === d.v ? 'border-primary-600 bg-primary-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {d.label}
            </button>
          ))}
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="!w-auto" />
        </div>
      </div>

      {/* 3) slots */}
      <div>
        <p className="label-base">
          الوقت المتاح <span className="font-normal text-slate-400">({formatDateShort(date)})</span>
        </p>
        {closed ? (
          schedules.length > 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="العيادة مغلقة في هذا اليوم"
              message="يمكن تعديل أيام العمل من صفحة الإعدادات"
            />
          ) : (
            <Spinner label="جارٍ تحميل أوقات العمل..." />
          )
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {slots.map((s) => {
              const taken = booked[s.start]
              const past = isPastSlot(s)
              const disabled = !!taken || past
              const selected = slot?.start === s.start
              return (
                <button
                  key={s.start}
                  disabled={disabled}
                  onClick={() => setSlot(s)}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                    selected
                      ? 'border-primary-700 bg-primary-700 text-white shadow-sm'
                      : disabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-primary-400 hover:bg-primary-50/50'
                  }`}
                  title={taken ? 'محجوز' : past ? 'وقت منقضٍ' : ''}
                >
                  {s.start}
                  {taken && <span className="text-[9px] font-medium">محجوز</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
