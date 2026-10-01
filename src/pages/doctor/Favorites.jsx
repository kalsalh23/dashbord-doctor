import { useCallback, useEffect, useState } from 'react'
import { Pill, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, SkeletonRows } from '../../components/ui'
import { friendlyDbError } from '../../lib/hooks'

const EMPTY = { name: '', dosage: '', duration: '', instructions: '' }

export default function Favorites() {
  const { profile, toast } = useApp()
  const [rows, setRows] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('doctor_favorite_medications')
      .select('*')
      .eq('doctor_id', profile.id)
      .order('created_at', { ascending: true })
    setRows(data || [])
  }, [profile?.id])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!form.name.trim()) return toast('error', 'اسم الدواء مطلوب')
    setSaving(true)
    const { error } = await supabase.from('doctor_favorite_medications').insert({
      clinic_id: profile.clinic_id,
      doctor_id: profile.id,
      name: form.name.trim(),
      dosage: form.dosage.trim() || null,
      duration: form.duration.trim() || null,
      instructions: form.instructions.trim() || null,
    })
    setSaving(false)
    if (error) return toast('error', friendlyDbError(error))
    toast('success', 'أُضيف الدواء إلى قائمتك الشائعة')
    setModal(false)
    setForm(EMPTY)
    load()
  }

  const remove = async (row) => {
    setDeleting(row.id)
    const { error } = await supabase.from('doctor_favorite_medications').delete().eq('id', row.id)
    setDeleting(null)
    if (error) return toast('error', friendlyDbError(error))
    toast('success', 'تم الحذف من قائمتك')
    load()
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="أدويتي الشائعة"
        subtitle="أدوية تصفها كثيراً — تظهر كأزرار سريعة داخل شاشة الكشف"
        actions={
          <Button onClick={() => setModal(true)}>
            <Plus size={16} />
            إضافة دواء
          </Button>
        }
      />

      {rows === null ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Pill}
            title="قائمتك فارغة"
            message="أضف الأدوية التي تصفها باستمرار (الاسم والجرعة المعتادة) لتُدرج أثناء الكشف بضغطة واحدة"
            action={<Button size="sm" onClick={() => setModal(true)}>إضافة أول دواء</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <Pill size={14} className="text-primary-600" />
                  {r.name}
                </p>
                <Button size="sm" variant="ghost" loading={deleting === r.id} onClick={() => remove(r)} title="حذف">
                  <Trash2 size={14} className="text-rose-500" />
                </Button>
              </div>
              <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                {r.dosage && <p>الجرعة: <b className="text-slate-600">{r.dosage}</b></p>}
                {r.duration && <p>المدة: <b className="text-slate-600">{r.duration}</b></p>}
                {r.instructions && <p>التعليمات: <b className="text-slate-600">{r.instructions}</b></p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="إضافة دواء شائع"
        subtitle="احفظ الجرعة والمدة المعتادة لإدراجها بضغطة واحدة"
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={save} loading={saving}>حفظ</Button>
            <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>إلغاء</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="اسم الدواء" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="أموكسيسيلين" />
          </Field>
          <Field label="الجرعة المعتادة">
            <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="500 ملغ" />
          </Field>
          <Field label="المدة المعتادة">
            <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="7 أيام" />
          </Field>
          <Field label="التعليمات" className="sm:col-span-2">
            <Input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="كبسولة كل 8 ساعات بعد الأكل" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
