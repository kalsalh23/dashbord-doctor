import { useCallback, useEffect, useMemo, useState } from 'react'
import { Wallet, HandCoins, CalendarCheck, Banknote } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Badge, PAY_STATUS, Button, Card, EmptyState, SkeletonRows, StatCard, Tabs, Modal, Select, Field } from '../../components/ui'
import { todayStr, money, formatDateTime } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'

const METHOD_LABEL = { cash: 'نقدًا', card: 'بطاقة', transfer: 'حوالة', other: 'أخرى' }

export default function Payments() {
  const { profile, settings, toast } = useApp()
  const [tab, setTab] = useState('today')
  const [rows, setRows] = useState(null)
  const [stats, setStats] = useState({ collected: 0, due: 0, count: 0 })
  const [settling, setSettling] = useState(null) // payment row
  const [settleMethod, setSettleMethod] = useState('cash')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const t = todayStr()
    const start = new Date(new Date(t).getTime()).toISOString()
    const end = new Date(new Date(t).getTime() + 86400000).toISOString()

    const [listRes, paidTodayRes, dueRes] = await Promise.all([
      supabase
        .from('payments')
        .select('id, total_amount, amount, remaining, method, status, paid_at, created_at, patient:patients(id, full_name, phone)')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('payments').select('amount').eq('clinic_id', profile.clinic_id).eq('status', 'paid').gte('paid_at', start).lt('paid_at', end),
      supabase.from('payments').select('remaining').eq('clinic_id', profile.clinic_id).eq('status', 'due_later'),
    ])

    const list = listRes.data || []
    setRows(list)
    setStats({
      collected: (paidTodayRes.data || []).reduce((s, p) => s + Number(p.amount || 0), 0),
      due: (dueRes.data || []).reduce((s, p) => s + Number(p.remaining || 0), 0),
      count: (paidTodayRes.data || []).length,
    })
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => {
    const list = rows || []
    const t = todayStr()
    if (tab === 'today') return list.filter((p) => (p.created_at || '').slice(0, 10) === t || (p.paid_at || '').slice(0, 10) === t)
    if (tab === 'due') return list.filter((p) => p.status === 'due_later')
    return list
  }, [rows, tab])

  const settle = async () => {
    if (!settling) return
    setSaving(true)
    const remaining = Number(settling.remaining || 0)
    const { error } = await supabase
      .from('payments')
      .update({
        amount: Number(settling.amount || 0) + remaining,
        remaining: 0,
        status: 'paid',
        paid_at: new Date().toISOString(),
        method: settleMethod,
      })
      .eq('id', settling.id)
    setSaving(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'settle_payment', 'payments', settling.id, { amount: remaining })
    toast('success', 'تم تسجيل الدفع بنجاح')
    setSettling(null)
    load()
  }

  const currency = settings?.currency

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800 sm:text-xl">المدفوعات</h1>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">متابعة التحصيل اليومي والمبالغ المستحقة</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="محصّل اليوم" value={money(stats.collected, currency)} icon={Wallet} tone="emerald" />
        <StatCard label="مستحقات لاحقًا (الإجمالي)" value={money(stats.due, currency)} icon={HandCoins} tone="amber" />
        <StatCard label="عدد العمليات اليوم" value={stats.count} icon={CalendarCheck} tone="blue" />
      </div>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'today', label: 'اليوم' },
            { value: 'due', label: 'المستحقات' },
            { value: 'all', label: 'الكل' },
          ]}
        />
      </div>

      <Card bodyClass="!p-0">
        {rows === null ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : shown.length === 0 ? (
          <EmptyState icon={Banknote} title="لا توجد مدفوعات" message="ستظهر هنا المدفوعات عند تسجيل وصول المرضى" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{p.patient?.full_name || '—'}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {METHOD_LABEL[p.method] || p.method} · {formatDateTime(p.paid_at || p.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">{money(p.amount, currency)}</p>
                    {Number(p.remaining) > 0 && (
                      <p className="text-[11px] font-semibold text-amber-700">متبقي {money(p.remaining, currency)}</p>
                    )}
                  </div>
                  <Badge map={PAY_STATUS} value={p.status} />
                  {p.status === 'due_later' && (
                    <Button size="sm" onClick={() => { setSettling(p); setSettleMethod(p.method || 'cash') }}>
                      تسديد
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!settling}
        onClose={() => setSettling(null)}
        title="تسديد المبلغ المستحق"
        subtitle={settling?.patient?.full_name}
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={settle} loading={saving}>تأكيد التسديد</Button>
            <Button variant="secondary" onClick={() => setSettling(null)} disabled={saving}>إلغاء</Button>
          </div>
        }
      >
        <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-xs text-slate-500">المبلغ المتبقي</span>
          <span className="text-lg font-bold text-slate-800">{money(settling?.remaining, currency)}</span>
        </div>
        <Field label="طريقة الدفع">
          <Select value={settleMethod} onChange={(e) => setSettleMethod(e.target.value)}>
            <option value="cash">نقدًا</option>
            <option value="card">بطاقة</option>
            <option value="transfer">حوالة</option>
            <option value="other">أخرى</option>
          </Select>
        </Field>
      </Modal>
    </div>
  )
}
