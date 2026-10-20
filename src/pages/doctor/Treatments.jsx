import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Pill, List, Save } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Select, Spinner, EmptyState } from '../../components/ui'
import { friendlyDbError } from '../../lib/hooks'
import { isFatimaClinic } from '../../lib/clinicStyle'

const TREATMENT_TYPES = [
  { key: 'botox', label: 'بوتوكس' },
  { key: 'filler', label: 'فلير' },
  { key: 'peeling', label: 'تقشير' },
  { key: 'laser', label: 'ليزر' },
  { key: 'meso', label: 'ميزوثيرابي' },
  { key: 'thread', label: 'خيوط' },
  { key: 'other', label: 'أخرى' },
]

export default function Treatments() {
  const { profile, toast, clinic_id } = useApp()
  const nav = useNavigate()
  const isFatima = isFatimaClinic(profile)
  const [treatments, setTreatments] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ type: 'other', name: '', price: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('doctor_favorite_medications')
        .select('id, name, dosage, duration, instructions, created_at')
        .eq('doctor_id', profile.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setTreatments((data || []).map((t) => ({
        id: t.id,
        type: t.dosage || 'other',
        name: t.name || '',
        price: t.duration || '',
        notes: t.instructions || '',
        created_at: t.created_at,
      })))
    } catch (e) {
      toast('error', 'تعذر تحميل العلاجات: ' + friendlyDbError(e))
    } finally {
      setLoading(false)
    }
  }, [profile?.id, toast])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!form.name.trim() || !form.price.trim()) {
      return toast('error', 'اسم العلاج والسعر مطلوبان')
    }
    if (!profile?.id || !profile.clinic_id) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('doctor_favorite_medications')
        .insert({
          clinic_id: profile.clinic_id,
          doctor_id: profile.id,
          name: form.name.trim(),
          dosage: form.type,
          duration: form.price.trim(),
          instructions: '',
          created_at: new Date().toISOString(),
        })
      if (error) throw error
      audit(profile.clinic_id, 'add_treatment', 'doctor_favorite_medications', null)
      toast('success', 'تم إضافة العلاج')
      setForm({ type: 'other', name: '', price: '' })
      load()
    } catch (e) {
      toast('error', 'تعذر حفظ العلاج: ' + friendlyDbError(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!profile?.id) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('doctor_favorite_medications')
        .delete()
        .eq('id', id)
        .eq('doctor_id', profile.id)
      if (error) throw error
      toast('success', 'تم حذف العلاج')
      load()
    } catch (e) {
      toast('error', 'تعذر الحذف: ' + friendlyDbError(e))
    } finally {
      setSaving(false)
    }
  }

  if (!isFatima) {
    nav('/doctor')
    return null
  }

  const typeLabel = TREATMENT_TYPES.find((t) => t.key === form.type)?.label || form.type

  if (loading) return <Spinner />

  return (
    <div className="mx-auto max-w-2xl pb-24 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">علاجاتي</h1>
          <p className="text-xs text-slate-500">إضافة العلاجات المخصصة وأسعارها للاستخدام في الكشف</p>
        </div>
        <Button onClick={() => nav('/doctor')} variant="secondary" size="sm">
          <Pill size={14} />
         返回
        </Button>
      </div>

      <Card>
        <div className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">إضافة علاج جديد</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="نوع العلاج">
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TREATMENT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="اسم العلاج">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: بوتوكس الجبهة"
              />
            </Field>
            <Field label="السعر">
              <Input
                type="number"
                dir="ltr"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="150"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Button onClick={save} loading={saving} disabled={saving}>
              <Save size={16} />
              إضافة العلاج
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4">قائمة العلاجات المحفوظة</h2>
          {treatments.length === 0 ? (
            <EmptyState
              icon={List}
              title="لا توجد علاجات محفوظة بعد"
              message="أضف علاجًا جديدًا من الأعلى ليظهر هنا"
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {treatments.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 text-xs font-bold">
                      {typeEmoji(t.type)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      <p className="text-[10px] text-slate-500">{typeLabelByKey(t.type)} · {t.price} ر.س</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(t.id)}
                    className="text-rose-500 hover:text-rose-700"
                    title="حذف العلاج"
                  >
                    <Trash2 size={16} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )

  function typeEmoji(key) {
    const map = { botox: '💉', filler: '💧', peeling: '✨', laser: '⚡', meso: '💆‍♀️', thread: '🧵', other: '💊' }
    return map[key] || '💊'
  }

  function typeLabelByKey(key) {
    const t = TREATMENT_TYPES.find((x) => x.key === key)
    return t ? t.label : key
  }
}
