import { useEffect, useState } from 'react'
import { Modal, Button, Field, Textarea } from './ui'
import { useApp, audit } from '../lib/store'
import { supabase } from '../lib/supabase'
import { friendlyDbError } from '../lib/hooks'

const FIELDS = [
  { key: 'chronic_diseases', label: 'الأمراض المزمنة', hint: 'مثال: السكري، ارتفاع الضغط' },
  { key: 'allergies', label: 'الحساسية', hint: 'أدوية أو أطعمة — تظهر بلون تحذيري للطبيب' },
  { key: 'current_medications', label: 'الأدوية الحالية' },
  { key: 'previous_surgeries', label: 'العمليات السابقة' },
  { key: 'important_notes', label: 'ملاحظات طبية مهمة' },
]

/** Doctor-only editor for the patient's standing medical information. */
export default function MedicalInfoModal({ open, onClose, patientId, info, onSaved }) {
  const { profile, toast } = useApp()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const next = {}
    for (const f of FIELDS) next[f.key] = info?.[f.key] || ''
    setForm(next)
  }, [open, info])

  const submit = async () => {
    setSaving(true)
    const payload = {}
    for (const f of FIELDS) payload[f.key] = form[f.key].trim() || null
    const { error } = info
      ? await supabase.from('medical_information').update(payload).eq('id', info.id)
      : await supabase
          .from('medical_information')
          .insert({ ...payload, clinic_id: profile.clinic_id, patient_id: patientId })
    setSaving(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'update_medical_info', 'patients', patientId)
    toast('success', 'تم حفظ المعلومات الطبية')
    onSaved?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="المعلومات الطبية المهمة"
      subtitle="تظهر هذه المعلومات للطبيب فور فتح ملف المريض"
      footer={
        <div className="flex justify-start gap-2">
          <Button onClick={submit} loading={saving}>حفظ</Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>إلغاء</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <Textarea
              value={form[f.key] || ''}
              onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
              rows={2}
            />
          </Field>
        ))}
      </div>
    </Modal>
  )
}
