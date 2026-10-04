import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2, Wallet } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, Field, Input, PageHeader, SkeletonRows, Select } from '../../components/ui'
import { DEFAULT_CATALOG, fmtPrice } from '../../lib/dental'

/**
 * أسعاري — فئات التشخيص، ولكل فئة علاجات لها سعر يُدخل ويُثبت ويمكن تعديله لاحقاً.
 * الأسعار تُحسب تلقائياً على حساب المريض عند اختيار العلاج في الكشف.
 */
export default function DentalPrices() {
  const { profile, toast } = useApp()
  const [rows, setRows] = useState(null) // [{id, category, treatment, price, color}]
  const [drafts, setDrafts] = useState({}) // id -> {price, color}
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ category: '', treatment: '', price: '', color: '#0d9488' })
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('dental_pricebook')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .order('category')
      .order('treatment')
    setRows(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    const m = new Map()
    for (const r of rows || []) {
      if (!m.has(r.category)) m.set(r.category, [])
      m.get(r.category).push(r)
    }
    return [...m.entries()]
  }, [rows])

  const categories = useMemo(() => [...new Set([...(rows || []).map((r) => r.category), ...DEFAULT_CATALOG.map((c) => c.category)])], [rows])

  const updateRow = async (row, patch) => {
    const { error } = await supabase.from('dental_pricebook').update(patch).eq('id', row.id)
    if (error) return toast('error', 'تعذر حفظ التعديل: ' + error.message)
    toast('success', 'تم تحديث السعر')
    load()
  }

  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...(d[id] || { price: '', color: '' }), ...patch } }))

  const deleteRow = async (row) => {
    const { error } = await supabase.from('dental_pricebook').delete().eq('id', row.id)
    if (error) return toast('error', 'تعذر الحذف: ' + error.message)
    setRows((rs) => rs.filter((r) => r.id !== row.id))
  }

  const addRow = async () => {
    if (!newRow.category.trim() || !newRow.treatment.trim()) return toast('error', 'الفئة واسم العلاج مطلوبان')
    setAdding(true)
    const { error } = await supabase.from('dental_pricebook').insert({
      clinic_id: profile.clinic_id,
      category: newRow.category.trim(),
      treatment: newRow.treatment.trim(),
      price: Number(newRow.price) || 0,
      color: newRow.color,
    })
    setAdding(false)
    if (error) return toast('error', error.message.includes('duplicate') ? 'هذا العلاج موجود في الفئة أصلاً' : 'تعذر الإضافة: ' + error.message)
    toast('success', 'تمت إضافة العلاج')
    setNewRow({ category: '', treatment: '', price: '', color: '#0d9488' })
    load()
  }

  // تحميل القائمة الافتراضية — يضيف الفئات والعلاجات غير الموجودة فقط (بدون تكرار)
  const seedDefaults = async () => {
    setSeeding(true)
    const existing = new Set((rows || []).map((r) => r.category + '|' + r.treatment))
    const payload = DEFAULT_CATALOG.flatMap((g) =>
      g.items
        .filter((i) => !existing.has(g.category + '|' + i.treatment))
        .map((i) => ({ clinic_id: profile.clinic_id, category: g.category, treatment: i.treatment, price: i.price, color: i.color }))
    )
    if (payload.length === 0) {
      setSeeding(false)
      return toast('info', 'كل القائمة الافتراضية مضافة أصلاً')
    }
    const { error } = await supabase.from('dental_pricebook').insert(payload)
    setSeeding(false)
    if (error) return toast('error', 'تعذر التحميل: ' + error.message)
    toast('success', `تمت إضافة ${payload.length} علاجاً جديداً — عدّل الأسعار كما يناسب عيادتك`)
    load()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="أسعاري"
        subtitle="فئات التشخيص وعلاجاتها وأسعارها — السعر المثبت هنا يُحسب تلقائياً على حساب المريض في الكشف"
        actions={
          <Button size="sm" variant="secondary" onClick={seedDefaults} loading={seeding} title="يضيف الفئات والعلاجات غير الموجودة فقط">
            <Plus size={14} />
            إضافة القائمة الافتراضية
          </Button>
        }
      />

      {rows === null ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="لم تُدخل أسعارك بعد"
            message="حمّل القائمة الافتراضية الكاملة (فئات وعلاجات بألوانها) وعدّل الأسعار، أو أضف علاجاتك بنفسك"
            action={
              <Button onClick={seedDefaults} loading={seeding}>
                <Plus size={15} />
                تحميل القائمة الافتراضية
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, items]) => (
            <Card key={category} title={category} bodyClass="!p-0">
              <ul className="divide-y divide-slate-100">
                {items.map((row) => {
                  const d = drafts[row.id] || {}
                  return (
                    <li key={row.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                      <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-slate-200" style={{ background: row.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{row.treatment}</span>
                      <Input
                        type="number"
                        dir="ltr"
                        className="!h-8 w-32 text-xs"
                        value={d.price !== undefined && d.price !== '' ? d.price : row.price}
                        onChange={(e) => setDraft(row.id, { price: e.target.value })}
                        placeholder="السعر"
                      />
                      <input
                        type="color"
                        value={d.color || row.color}
                        onChange={(e) => setDraft(row.id, { color: e.target.value })}
                        className="h-8 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                        title="لون العلاج على الفك"
                      />
                      <Button
                        size="sm"
                        disabled={Object.keys(d).length === 0}
                        onClick={() => updateRow(row, {
                          price: d.price !== undefined && d.price !== '' ? Number(d.price) : row.price,
                          color: d.color || row.color,
                        })}
                      >
                        <Save size={13} />
                        تثبيت
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRow(row)} title="حذف العلاج">
                        <Trash2 size={14} className="text-rose-500" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {/* إضافة علاج جديد */}
      {rows !== null && (
        <Card title="إضافة علاج جديد" className="mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="الفئة">
              <Select value={newRow.category} onChange={(e) => setNewRow((r) => ({ ...r, category: e.target.value }))}>
                <option value="">— اختر فئة أو اكتب جديدة —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="أو فئة جديدة" hint="اتركها فارغة إذا اخترت فئة من القائمة">
              <Input value={newRow.category && !categories.includes(newRow.category) ? newRow.category : ''} onChange={(e) => setNewRow((r) => ({ ...r, category: e.target.value }))} placeholder="مثال: جراحة الفم" />
            </Field>
            <Field label="اسم العلاج" required>
              <Input value={newRow.treatment} onChange={(e) => setNewRow((r) => ({ ...r, treatment: e.target.value }))} placeholder="مثال: حشو ضوئي" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="السعر">
                <Input type="number" dir="ltr" value={newRow.price} onChange={(e) => setNewRow((r) => ({ ...r, price: e.target.value }))} placeholder="150000" />
              </Field>
              <Field label="اللون على الفك">
                <input
                  type="color"
                  value={newRow.color}
                  onChange={(e) => setNewRow((r) => ({ ...r, color: e.target.value }))}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex justify-start">
            <Button onClick={addRow} loading={adding}>
              <Plus size={15} />
              إضافة العلاج
            </Button>
          </div>
        </Card>
      )}

      {rows !== null && rows.length > 0 && (
        <p className="mt-3 text-center text-[11px] text-slate-400">
          إجمالي العلاجات المعرفة: {rows.length} — الأسعار بـ {fmtPrice(0).split(' ')[1] || 'ل.س'}
        </p>
      )}
    </div>
  )
}
