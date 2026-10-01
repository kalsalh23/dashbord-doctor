import { useState } from 'react'
import { Banknote, Clock3 } from 'lucide-react'
import { Modal, Button, Select, Field } from './ui'
import { useApp, audit } from '../lib/store'
import { supabase } from '../lib/supabase'
import { friendlyDbError } from '../lib/hooks'
import { money } from '../lib/format'

/**
 * Patient arrival check-in: shows the consultation price and lets reception
 * choose "pay now" or "pay later". The patient becomes 'arrived' either way.
 */
export default function CheckInModal({ open, onClose, appointment, onDone }) {
  const { profile, settings, toast } = useApp()
  const [method, setMethod] = useState('cash')
  const [saving, setSaving] = useState(null) // 'now' | 'later'

  if (!appointment) return null
  const price = Number(appointment.price ?? settings?.consultation_price ?? 0)
  const patientName = appointment.patient?.full_name || ''

  const doCheckIn = async (payNow) => {
    setSaving(payNow ? 'now' : 'later')
    // existing payment for this appointment (e.g. re-check-in)
    const { data: existing } = await supabase
      .from('payments')
      .select('id, amount, remaining, status')
      .eq('appointment_id', appointment.id)
      .maybeSingle()

    let error
    if (existing) {
      error = (
        await supabase
          .from('payments')
          .update({
            total_amount: price,
            remaining: payNow ? 0 : price,
            amount: payNow ? price : 0,
            status: payNow ? 'paid' : 'due_later',
            paid_at: payNow ? new Date().toISOString() : null,
            method,
          })
          .eq('id', existing.id)
      ).error
    } else {
      error = (
        await supabase.from('payments').insert({
          clinic_id: profile.clinic_id,
          patient_id: appointment.patient_id,
          appointment_id: appointment.id,
          total_amount: price,
          amount: payNow ? price : 0,
          remaining: payNow ? 0 : price,
          method,
          status: payNow ? 'paid' : 'due_later',
          paid_at: payNow ? new Date().toISOString() : null,
          created_by: profile.id,
        })
      ).error
    }

    if (!error) {
      ;({ error } = await supabase.from('appointments').update({ status: 'arrived' }).eq('id', appointment.id))
    }
    setSaving(null)
    if (error) return toast('error', friendlyDbError(error))

    audit(profile.clinic_id, 'check_in', 'appointments', appointment.id, { pay_now: payNow })
    toast('success', payNow ? 'تم تسجيل الوصول والدفع بنجاح' : 'تم تسجيل الوصول — الدفع لاحقًا')
    onDone?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تسجيل وصول المريض"
      footer={
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="success" onClick={() => doCheckIn(true)} loading={saving === 'now'} disabled={!!saving}>
            <Banknote size={16} />
            دفع الآن
          </Button>
          <Button variant="secondary" onClick={() => doCheckIn(false)} loading={saving === 'later'} disabled={!!saving}>
            دفع لاحقًا
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{patientName}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Clock3 size={12} />
            موعد الساعة {appointment.start_time?.slice(0, 5)}
          </p>
        </div>
        <div className="text-left">
          <p className="text-[11px] text-slate-400">قيمة الكشف</p>
          <p className="text-lg font-bold text-slate-800">{money(price, settings?.currency)}</p>
        </div>
      </div>

      <Field label="طريقة الدفع" hint="يمكن اختيار الدفع لاحقًا — لن يمنع ذلك نقل المريض إلى الطبيب">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">نقدًا</option>
          <option value="card">بطاقة</option>
          <option value="transfer">حوالة</option>
          <option value="other">أخرى</option>
        </Select>
      </Field>
    </Modal>
  )
}
