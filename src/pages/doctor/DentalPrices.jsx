import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2, Wallet, ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, Field, Input, PageHeader, SkeletonRows, Select } from '../../components/ui'
import { DEFAULT_CATALOG, TREATMENT_TREE, fmtPrice } from '../../lib/dental'

/**
 * أسعاري — فئات التشخيص، ولكل فئة علاجات لها سعر يُدخل ويُثبت ويمكن تعديله لاحقاً.
 * الأسعار تُحسب تلقائياً على حساب المريض عند اختيار العلاج في الكشف.
 */
export default function DentalPrices() {
  const { profile, toast } = useApp()
  const [rows, setRows] = useState(null) // [{id, category, treatment, price, color}]
  const [drafts, setDrafts] = useState({}) // id -> {price, color}
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ category: '', treatment: '', price: '', color: 'var(--p600)' })
  const [seeding, setSeeding] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [expandedCat, setExpandedCat] = useState(null) // الفئة المطويّة (null = كل الفئات مفتوحة)

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('dental_pricebook')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      // الأحدث أولاً داخل كل فئة: العلاج المضاف جديداً يظهر في الأعلى لا في الأسفل
      .order('category')
      .order('created_at', { ascending: false })
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
    // ترتيب الفئات حسب الترتيب المعروف لشجرة العلاجات، ثم المضافة لاحقاً
    const known = TREATMENT_TREE.map((g) => g.family)
    const knownSet = new Set(known)
    const ordered = [...m.entries()].sort((a, b) => {
      const ia = known.indexOf(a[0])
      const ib = known.indexOf(b[0])
      if (ia >= 0 && ib >= 0) return ia - ib
      if (ia >= 0) return -1
      if (ib >= 0) return 1
      return a[0].localeCompare(b[0], 'ar')
    })
    // الفئات المعروفة التي لا يوجد لها أسعار بعد — تظهر ليعرف الطبيب أنها تحتاج تسعيراً
    for (const fam of known) if (!m.has(fam)) ordered.push([fam, []])
    return ordered.filter(([cat]) => knownSet.has(cat) || m.has(cat))
  }, [rows])

  const totalTypes = useMemo(() => (rows || []).length, [rows])
  const pricedTypes = useMemo(() => (rows || []).filter((r) => Number(r.price) > 0).length, [rows])

  const categories = useMemo(
    () => [...new Set([...(rows || []).map((r) => r.category), ...DEFAULT_CATALOG.map((c) => c.category), ...TREATMENT_TREE.map((g) => g.family)])],
    [rows]
  )

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
    setNewRow({ category: '', treatment: '', price: '', color: 'var(--p600)' })
    setFormOpen(false)
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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="أسعاري"
        subtitle="أسعار العيادة على مخطط الأسنان — تُحسب تلقائياً على حساب المريض عند الكشف"
        actions={
          <Button variant="secondary" size="sm" onClick={seedDefaults} loading={seeding} className="print:hidden">
            
            استعادة القائمة الافتراضية
          </Button>
        }
      />

      {/* نموذج إضافة علاج جديد — مخفي حتى الضغط على الزر */}
      {rows !== null && (
        <div className="sticky top-14 z-20 -mx-1 mb-4 bg-slate-50/95 px-1 py-1 backdrop-blur">
          {!formOpen ? (
            <Button onClick={() => setFormOpen(true)} className="w-full sm:w-auto">
              <Plus size={16} />
              إضافة علاج جديد
            </Button>
          ) : (
            <Card title="إضافة علاج جديد" subtitle="اختر عائلة العلاج ثم أضف أنواعها — النوع يظهر فوراً على المخطط وفي شبكة الأنواع">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="العائلة (العلاج)">
                  <Select value={newRow.category} onChange={(e) => setNewRow((r) => ({ ...r, category: e.target.value }))}>
                    <option value="">— اختر عائلة أو اكتب جديدة —</option>
                    {TREATMENT_TREE.map((g) => (
                      <option key={g.family} value={g.family}>{g.family} ({g.items.length} نوع)</option>
                    ))}
                    {categories
                      .filter((c) => !TREATMENT_TREE.some((g) => g.family === c))
                      .map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                  </Select>
                </Field>
                <Field label="أو عائلة جديدة" hint="اتركها فارغة إذا اخترت عائلة من القائمة">
                  <Input value={newRow.category && !categories.includes(newRow.category) ? newRow.category : ''} onChange={(e) => setNewRow((r) => ({ ...r, category: e.target.value }))} placeholder="مثال: تقويم شفاف" />
                </Field>
                <Field label="نوع العلاج" required hint="مثال عند عائلة «حشوة»: حشو ضوئي / حشو أملغم…">
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
              <div className="mt-3 flex justify-start gap-2">
                <Button onClick={addRow} loading={adding}>
                  <Plus size={15} />
                  إضافة العلاج
                </Button>
                <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={adding}>
                  إلغاء
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* قائمة الفئات (علاج وأنواعه) — كل عائلة بأنواعها المسعّرة */}
      {rows === null ? (
        <SkeletonRows rows={5} />
      ) : (
      <div className="space-y-4">
          {grouped.map(([category, items]) => {
            const tree = TREATMENT_TREE.find((g) => g.family === category)
            const expanded = expandedCat !== category
            return (
              <Card
                key={category}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{category}</span>
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                      {items.length} نوع
                    </span>
                    {tree && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {tree.items.length} في القائمة الافتراضية
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedCat(expanded ? null : category)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600 print:hidden"
                    >
                      {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {expanded ? 'إخفاء' : 'عرض'}
                    </button>
                  </span>
                }
                bodyClass="!p-0"
              >
                {items.length === 0 ? (
                  <p className="px-4 py-3 text-[11px] text-amber-700">
                    لا توجد أنواع مسعّرة بعد — استعد القائمة الافتراضية أو أضف النوع يدوياً.
                  </p>
                ) : expanded ? (
                  <ul className="divide-y divide-slate-100">
                    {items.map((row) => {
                      const d = drafts[row.id] || {}
                      return (
                        <li key={row.id} className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 sm:gap-2">
                          <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-slate-200" style={{ background: row.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{row.treatment}</span>
                          <Input
                            type="number"
                            dir="ltr"
                            className="!h-8 w-20 !px-1.5 text-xs sm:w-32 sm:!px-3"
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
                ) : (
                  <p className="px-4 py-2 text-[11px] text-slate-400">
                    {items.map((r) => r.treatment).join(' · ')}
                  </p>
                )}
              </Card>
            )
          })}
          {rows !== null && rows.length === 0 && (
            <Card>
              <EmptyState
                icon={Wallet}
                title="لا توجد أسعار محفوظة بعد"
                message="أضف علاجاً من النموذج في الأعلى — أو استعد القائمة الافتراضية وعدّلها"
              />
            </Card>
          )}
        </div>
      )}

      {rows !== null && totalTypes > 0 && (
        <p className="mt-3 text-center text-[11px] text-slate-400">
          {TREATMENT_TREE.length} عائلة علاج · {totalTypes} نوع مسعّر ({pricedTypes} بسعر أكبر من صفر)
        </p>
      )}
    </div>
  )
}
