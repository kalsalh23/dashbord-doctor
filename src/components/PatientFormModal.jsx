import { useEffect, useState } from 'react'
import { Modal, Button, Input, Select, Field, Textarea } from './ui'
import { useApp, audit } from '../lib/store'
import { supabase } from '../lib/supabase'
import { friendlyDbError } from '../lib/hooks'
import { usesNumericAge, isFatimaClinic } from '../lib/clinicStyle'
import { ageFrom } from '../lib/format'

/** Add / edit basic patient information (reception & admin). */
export default function PatientFormModal({ open, onClose, patient, onSaved }) {
  const { profile, settings, toast } = useApp()
  const isNizar = usesNumericAge(profile, settings)
  const isFatima = isFatimaClinic(profile)
  const [form, setForm] = useState({ full_name: '', phone: '', date_of_birth: '', age: '', gender: '', address: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      patient
        ? {
            full_name: patient.full_name || '',
            phone: patient.phone || '',
            date_of_birth: patient.date_of_birth || '',
            // العمر يُعرض رقماً لعيادة الدكتورة فاطمة وعيادات أسلوب نزار
            age: (isFatima || isNizar) && patient.date_of_birth ? String(ageFrom(patient.date_of_birth)) : '',
            gender: patient.gender || '',
            address: patient.address || '',
            notes: patient.notes || '',
          }
        : { full_name: '', phone: '', date_of_birth: '', age: '', gender: '', address: '', notes: '' }
    )
  }, [open, patient, isNizar, isFatima])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast('error', 'الاسم ورقم الهاتف مطلوبان')
      return
    }
    setSaving(true)
    // العمر الرقمي يُحوَّل لتاريخ ميلاد تقريبي — يخدم حساب العمر والوثائق لاحقاً
    let dateOfBirth = form.date_of_birth || null
    if (isNizar && String(form.age).trim() !== '') {
      const a = Number(form.age)
      if (Number.isFinite(a) && a >= 0 && a < 120) {
        const now = new Date()
        dateOfBirth = new Date(now.getFullYear() - a, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
      }
    }
    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      date_of_birth: dateOfBirth,
      gender: form.gender || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    }
    const { data, error } = patient
      ? await supabase.from('patients').update(payload).eq('id', patient.id).select().single()
      : await supabase
          .from('patients')
          .insert({ ...payload, clinic_id: profile.clinic_id, created_by: profile.id })
          .select()
          .single()
    setSaving(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, patient ? 'update_patient' : 'create_patient', 'patients', data.id)
    toast('success', patient ? 'تم حفظ بيانات المريض' : 'تمت إضافة المريض بنجاح')
    onSaved?.(data)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? 'تعديل بيانات المريض' : 'مريض جديد'}
      footer={
        <div className="flex justify-start gap-2">
          <Button onClick={submit} loading={saving}>
            {patient ? 'حفظ التعديلات' : 'إضافة المريض'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" required className="sm:col-span-2">
          <Input value={form.full_name} onChange={set('full_name')} placeholder="الاسم الثلاثي" />
        </Field>
        <Field label="رقم الهاتف" required>
          <Input value={form.phone} onChange={set('phone')} placeholder="09xxxxxxxx" dir="ltr" />
        </Field>
        <Field label="الجنس">
          <Select value={form.gender} onChange={set('gender')}>
            <option value="">— اختر —</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </Select>
        </Field>
        <Field label="العنوان">
          <Input value={form.address} onChange={set('address')} placeholder="المدينة / الحي" />
        </Field>
        {(isFatima || isNizar) && (
          <Field label="العمر (سنة)">
            <Input
              type="number"
              dir="ltr"
              min={0}
              max={120}
              value={form.age}
              onChange={set('age')}
              placeholder="مثال: 20"
            />
          </Field>
        )}
        <Field label="ملاحظات مهمة" className="sm:col-span-2" hint="ملاحظات إدارية أو تعليمات خاصة بالمريض">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} />
        </Field>
      </div>
    </Modal>
  )
}
