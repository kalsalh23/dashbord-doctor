import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Receipt, Trash2, Wallet, TrendingDown, PiggyBank } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import {
  Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, SkeletonRows,
  StatCard, Tabs, Textarea, ConfirmDialog, Tag,
} from '../../components/ui'
import { todayStr, formatDateShort, money, toLocalISO } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'

const CATEGORIES = {
  salary: { label: 'رواتب وأجور' },
  supplies: { label: 'مستلزمات ومواد' },
  equipment: { label: 'معدات وأجهزة' },
  rent: { label: 'إيجار وفواتير' },
  maintenance: { label: 'صيانة' },
  other: { label: 'أخرى' },
}

const EMPTY = { title: '', amount: '', category: 'supplies', expense_date: '', notes: '' }

export default function Expenses() {
  const { profile, settings, toast, isAdmin } = useApp()
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('month')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY, expense_date: todayStr() })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [busyDelete, setBusyDelete] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const monthStart = useMemo(() => todayStr().slice(0, 7) + '-01', [])

  const stats = useMemo(() => {
    const list = rows || []
    const t = todayStr()
    const today = list.filter((e) => e.expense_date === t).reduce((s, e) => s + Number(e.amount || 0), 0)
    const month = list.filter((e) => e.expense_date >= monthStart).reduce((s, e) => s + Number(e.amount || 0), 0)
    const all = list.reduce((s, e) => s + Number(e.amount || 0), 0)
    return { today, month, all }
  }, [rows, monthStart])

  const shown = useMemo(() => {
    const list = rows || []
    if (tab === 'month') return list.filter((e) => e.expense_date >= monthStart)
    if (tab === 'day') return list.filter((e) => e.expense_date === todayStr())
    return list
  }, [rows, tab, monthStart])

  const save = async () => {
    if (!form.title.trim()) return toast('error', 'وصف المصروف مطلوب')
    if (!form.amount || Number(form.amount) <= 0) return toast('error', 'المبلغ مطلوب')
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      clinic_id: profile.clinic_id,
      title: form.title.trim(),
      amount: Number(form.amount),
      category: form.category,
      expense_date: form.expense_date || todayStr(),
      notes: form.notes.trim() || null,
      created_by: profile.id,
    })
    setSaving(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'add_expense', 'expenses', null, { amount: Number(form.amount), category: form.category })
    toast('success', 'تم تسجيل المصروف')
    setModal(false)
    setForm({ ...EMPTY, expense_date: todayStr() })
    load()
  }

  const remove = async () => {
    if (!deleting) return
    setBusyDelete(true)
    const { error } = await supabase.from('expenses').delete().eq('id', deleting.id)
    setBusyDelete(false)
    setDeleting(null)
    if (error) return toast('error', friendlyDbError(error))
    toast('success', 'تم حذف المصروف')
    load()
  }

  const currency = settings?.currency

  return (
    <div>
      <PageHeader
        title="المصاريف"
        subtitle="تسجيل مصاريف العيادة: رواتب، معدات، مستلزمات وأكثر"
        actions={
          <Button onClick={() => setModal(true)}>
            <Plus size={16} />
            تسجيل مصروف
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="مصاريف اليوم" value={money(stats.today, currency)} icon={TrendingDown} tone="rose" />
        <StatCard label="مصاريف هذا الشهر" value={money(stats.month, currency)} icon={Receipt} tone="amber" />
        <StatCard label="إجمالي المصاريف المسجلة" value={money(stats.all, currency)} icon={PiggyBank} tone="slate" />
      </div>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'day', label: 'اليوم' },
            { value: 'month', label: 'هذا الشهر' },
            { value: 'all', label: 'الكل' },
          ]}
        />
      </div>

      <Card bodyClass="!p-0">
        {rows === null ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="لا توجد مصاريف في هذه القائمة"
            message="سجّل مصاريف العيادة (رواتب، شراء معدات، مستلزمات...) لمتابعة وضعها المالي"
            action={<Button size="sm" onClick={() => setModal(true)}>تسجيل مصروف</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                    {e.title}
                    <Tag>{CATEGORIES[e.category]?.label || e.category}</Tag>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {formatDateShort(e.expense_date)}
                    {e.notes ? ` · ${e.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-rose-600">{money(e.amount, currency)}</span>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(e)} title="حذف">
                      <Trash2 size={14} className="text-rose-500" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="تسجيل مصروف"
        subtitle="رواتب، شراء معدات، مستلزمات أو أي مصروف آخر"
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={save} loading={saving}>حفظ المصروف</Button>
            <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>إلغاء</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="وصف المصروف" required className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: راتب موظفة الاستقبال - شهر 10" />
          </Field>
          <Field label="المبلغ" required>
            <Input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          </Field>
          <Field label="التصنيف" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="التاريخ">
            <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="تفاصيل إضافية إن لزم" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="حذف المصروف"
        message={`حذف «${deleting?.title}» بمبلغ ${money(deleting?.amount, currency)}؟ لا يمكن التراجع.`}
        confirmLabel="نعم، حذف"
        danger
        loading={busyDelete}
        onConfirm={remove}
      />
    </div>
  )
}
