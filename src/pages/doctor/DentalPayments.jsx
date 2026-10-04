import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgePercent, Banknote, Search, Wallet, Printer } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, SkeletonRows } from '../../components/ui'
import { fmtPrice } from '../../lib/dental'
import { usePrintIsolation } from '../../lib/print'
import { ageFrom, formatDateShort, todayStr } from '../../lib/format'

/**
 * الدفعات — حساب كل مريض: الإجمالي، المدفوعات، المتبقي.
 * مريض عليه مبلغ لم يُغلق كاملاً يظهر بالأحمر، وسدد كامل يظهر بالأخضر.
 * مع خصم يختاره الطبيب لمريض محدد فيُخصم من المستحق + طباعة كشف حساب كامل.
 */
export default function DentalPayments() {
  const { profile, toast } = useApp()
  usePrintIsolation()
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [payFor, setPayFor] = useState(null) // صف مريض لاتخاذ دفعة
  const [payAmount, setPayAmount] = useState('')
  const [discountFor, setDiscountFor] = useState(null)
  const [discountAmount, setDiscountAmount] = useState('')
  const [statement, setStatement] = useState(null) // {group, entries, visits}

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const [pRes, ptRes] = await Promise.all([
      supabase
        .from('payments')
        .select('id, patient_id, total_amount, amount, remaining, status, method, created_at')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false }),
      supabase.from('patients').select('id, full_name, phone').eq('clinic_id', profile.clinic_id),
    ])
    const pays = pRes.data || []
    const patients = Object.fromEntries((ptRes.data || []).map((p) => [p.id, p]))
    const byPatient = new Map()
    for (const p of pays) {
      if (!byPatient.has(p.patient_id)) byPatient.set(p.patient_id, { patient: patients[p.patient_id] || { full_name: '—', phone: '' }, rows: [], total: 0, paid: 0, remaining: 0 })
      const g = byPatient.get(p.patient_id)
      g.rows.push(p)
      g.total += Number(p.total_amount) || 0
      g.paid += Number(p.amount) || 0
      g.remaining += Number(p.remaining) || 0
    }
    setRows([...byPatient.values()].map((g) => ({ ...g, remaining: Math.max(0, g.total - g.paid) })))
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => {
    const term = q.trim()
    if (!term) return rows || []
    return (rows || []).filter((r) => (r.patient?.full_name || '').includes(term) || (r.patient?.phone || '').includes(term))
  }, [rows, q])

  const stats = useMemo(() => {
    const all = rows || []
    return {
      open: all.filter((r) => r.remaining > 0).length,
      closed: all.filter((r) => r.remaining <= 0).length,
      due: all.reduce((s, r) => s + Math.max(0, r.remaining), 0),
    }
  }, [rows])

  /* ---------------- تسديد دفعة ---------------- */
  const savePayment = async () => {
    const amount = Number(payAmount)
    if (!payFor || !Number.isFinite(amount) || amount <= 0) return toast('error', 'أدخل مبلغ الدفعة')
    // نوزع الدفعة على الدفعات المفتوحة بالأولوية للأحدث
    let left = amount
    const open = (payFor.rows || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    for (const pr of open) {
      if (left <= 0) break
      const remaining = Number(pr.remaining) || 0
      if (remaining <= 0) continue
      const take = Math.min(remaining, left)
      const newAmount = (Number(pr.amount) || 0) + take
      const newRemaining = (Number(pr.total_amount) || 0) - newAmount
      const { error } = await supabase
        .from('payments')
        .update({ amount: newAmount, remaining: Math.max(0, newRemaining), status: newRemaining <= 0 ? 'paid' : 'due_later', paid_at: new Date().toISOString() })
        .eq('id', pr.id)
      if (error) return toast('error', 'تعذر تسجيل الدفعة: ' + error.message)
      left -= take
    }
    if (left > 0) {
      // دفعة زائدة عن المستحق — تُسجل كدفعة مدفوعة كاملة (رصيد دفع مقدم)
      const { error } = await supabase.from('payments').insert({
        clinic_id: profile.clinic_id,
        patient_id: payFor.rows[0]?.patient_id,
        total_amount: left,
        amount: left,
        remaining: 0,
        method: 'cash',
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      if (error) return toast('error', 'تعذر تسجيل الدفعة: ' + error.message)
    }
    toast('success', `تم تسديد ${fmtPrice(amount)} على حساب ${payFor.patient?.full_name}`)
    setPayFor(null); setPayAmount('')
    load()
  }

  /* ---------------- خصم لمريض محدد ---------------- */
  const saveDiscount = async () => {
    const amount = Number(discountAmount)
    if (!discountFor || !Number.isFinite(amount) || amount <= 0) return toast('error', 'أدخل مبلغ الخصم')
    let left = amount
    const open = (discountFor.rows || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    let applied = 0
    for (const pr of open) {
      if (left <= 0) break
      const remaining = Number(pr.remaining) || 0
      if (remaining <= 0) continue
      const take = Math.min(remaining, left)
      const newTotal = (Number(pr.total_amount) || 0) - take
      const newRemaining = newTotal - (Number(pr.amount) || 0)
      const { error } = await supabase
        .from('payments')
        .update({ total_amount: newTotal, remaining: Math.max(0, newRemaining), status: newRemaining <= 0 ? 'paid' : 'due_later' })
        .eq('id', pr.id)
      if (error) return toast('error', 'تعذر تطبيق الخصم: ' + error.message)
      left -= take
      applied += take
    }
    if (applied <= 0) return toast('error', 'لا يوجد مستحق مفتوح لخصمه على هذا المريض')
    toast('success', `تم خصم ${fmtPrice(applied)} من حساب ${discountFor.patient?.full_name}`)
    setDiscountFor(null); setDiscountAmount('')
    load()
  }

  /* ---------------- طباعة كشف حساب المريض ---------------- */
  const openStatement = async (group) => {
    const pid = group.rows[0]?.patient_id
    const [dRes, vRes, pRes] = await Promise.all([
      supabase
        .from('dental_chart_entries')
        .select('tooth_no, procedure, notes, created_at, visit:visits(visit_date)')
        .eq('patient_id', pid)
        .order('created_at', { ascending: true }),
      supabase
        .from('visits')
        .select('visit_date, specialty_data')
        .eq('patient_id', pid)
        .order('visit_date', { ascending: true }),
      supabase.from('patients').select('full_name, phone, date_of_birth').eq('id', pid).maybeSingle(),
    ])
    setStatement({ group, entries: dRes.data || [], visits: vRes.data || [], patient: pRes.data || group.patient })
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="الدفعات"
        subtitle="حساب كل مريض: الإجمالي، المدفوع، المتبقي — الأحمر عليه مال لم يُغلق، والأخضر سدد كاملاً"
      />

      {rows !== null && rows.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center">
            <p className="text-[11px] font-bold text-rose-500">حسابات مفتوحة</p>
            <p className="mt-0.5 text-lg font-bold text-rose-700">{stats.open}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-[11px] font-bold text-emerald-500">حسابات مغلقة</p>
            <p className="mt-0.5 text-lg font-bold text-emerald-700">{stats.closed}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] font-bold text-slate-400">إجمالي المستحق</p>
            <p className="mt-0.5 text-lg font-bold text-slate-800" dir="ltr">{fmtPrice(stats.due)}</p>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المريض أو هاتفه..." className="input-base pr-9" />
      </div>

      {rows === null ? (
        <SkeletonRows rows={5} />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title={q ? 'لا توجد نتائج' : 'لا توجد حسابات بعد'} message="تُنشأ الحسابات تلقائياً من علاجات الكشف وسجل اليوم" />
        </Card>
      ) : (
        <Card bodyClass="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="px-4 py-2.5 text-start font-bold">المريض</th>
                  <th className="px-3 py-2.5 text-start font-bold">الهاتف</th>
                  <th className="px-3 py-2.5 text-start font-bold">الإجمالي</th>
                  <th className="px-3 py-2.5 text-start font-bold">المدفوعات</th>
                  <th className="px-3 py-2.5 text-start font-bold">المتبقي</th>
                  <th className="px-3 py-2.5 text-start font-bold">الحالة</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((r) => {
                  const open = r.remaining > 0
                  return (
                    <tr key={r.patient?.id} className={open ? 'bg-rose-50/70' : 'bg-emerald-50/60'}>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{r.patient?.full_name || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500" dir="ltr">{r.patient?.phone || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600" dir="ltr">{fmtPrice(r.total)}</td>
                      <td className="px-3 py-2.5 text-slate-600" dir="ltr">{fmtPrice(r.paid)}</td>
                      <td className={`px-3 py-2.5 font-bold ${open ? 'text-rose-700' : 'text-emerald-700'}`} dir="ltr">{fmtPrice(r.remaining)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${open ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {open ? 'حساب مفتوح — عليه مبلغ' : 'مسدد كاملاً'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {open && (
                            <Button size="sm" variant="ghost" onClick={() => { setDiscountFor(r); setDiscountAmount('') }} title="خصم">
                              <BadgePercent size={14} className="text-amber-600" />
                              خصم
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => openStatement(r)} title="طباعة كشف الحساب">
                            <Printer size={14} />
                            طباعة
                          </Button>
                          <Button size="sm" variant={open ? 'primary' : 'secondary'} onClick={() => { setPayFor(r); setPayAmount('') }}>
                            <Banknote size={14} />
                            تسديد
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* نافذة التسديد */}
      <Modal
        open={!!payFor}
        onClose={() => setPayFor(null)}
        title={payFor ? 'تسديد دفعة — ' + payFor.patient?.full_name : ''}
        subtitle={payFor ? `المتبقي الحالي: ${fmtPrice(payFor.remaining)}` : ''}
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={savePayment}>تسجيل الدفعة</Button>
            <Button variant="secondary" onClick={() => setPayFor(null)}>إلغاء</Button>
          </div>
        }
      >
        <Field label="مبلغ الدفعة">
          <Input type="number" dir="ltr" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus />
        </Field>
      </Modal>

      {/* نافذة الخصم */}
      <Modal
        open={!!discountFor}
        onClose={() => setDiscountFor(null)}
        title={discountFor ? 'خصم — ' + discountFor.patient?.full_name : ''}
        subtitle={discountFor ? `المستحق المفتوح: ${fmtPrice(discountFor.remaining)}` : ''}
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={saveDiscount}>تطبيق الخصم</Button>
            <Button variant="secondary" onClick={() => setDiscountFor(null)}>إلغاء</Button>
          </div>
        }
      >
        <Field label="قيمة الخصم — تُخصم مباشرة من المبلغ المستحق">
          <Input type="number" dir="ltr" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} autoFocus />
        </Field>
      </Modal>

      {/* كشف حساب المريض — جاهز للطباعة */}
      <Modal
        open={!!statement}
        onClose={() => setStatement(null)}
        wide
        title={statement ? 'كشف حساب — ' + statement.patient?.full_name : ''}
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={() => window.print()}>
              <Printer size={15} />
              طباعة الكشف
            </Button>
            <Button variant="secondary" onClick={() => setStatement(null)}>إغلاق</Button>
          </div>
        }
      >
        {statement && (
          <div className="print-area bg-white">
            <div style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }} dir="rtl">
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f766e', paddingBottom: 8, marginBottom: 12 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: '#134e4a', margin: 0 }}>{profile?.clinic?.name || 'العيادة'}</h1>
                <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>كشف حساب المريض — {todayStr()}</p>
              </div>
              <table style={{ width: '100%', fontSize: 12, marginBottom: 12 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: 2 }}><b>الاسم:</b> {statement.patient?.full_name}</td>
                    <td style={{ padding: 2 }}><b>الهاتف:</b> <span dir="ltr">{statement.patient?.phone || '—'}</span></td>
                    <td style={{ padding: 2 }}><b>العمر:</b> {statement.patient?.date_of_birth ? ageFrom(statement.patient.date_of_birth) : '—'}</td>
                  </tr>
                </tbody>
              </table>

              <p style={{ fontSize: 12, fontWeight: 800, color: '#134e4a', margin: '0 0 4px' }}>ما تم عمله في العيادة:</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 14 }}>
                <thead>
                  <tr style={{ background: '#f0fdfa' }}>
                    <th style={stTh}>التاريخ</th>
                    <th style={stTh}>السن</th>
                    <th style={stTh}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.entries.length === 0 ? (
                    <tr><td style={stTd} colSpan={3} style={{ textAlign: 'center' }}>لا توجد إجراءات مسجلة</td></tr>
                  ) : (
                    statement.entries.map((e, i) => (
                      <tr key={i}>
                        <td style={stTd}>{e.visit?.visit_date ? formatDateShort(e.visit.visit_date) : '—'}</td>
                        <td style={stTd} dir="ltr">{e.tooth_no}</td>
                        <td style={stTd}>{e.procedure}{e.notes ? <span style={{ color: '#94a3b8' }}> — {e.notes}</span> : null}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <p style={{ fontSize: 12, fontWeight: 800, color: '#134e4a', margin: '0 0 4px' }}>الحركة المالية:</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 12 }}>
                <thead>
                  <tr style={{ background: '#f0fdfa' }}>
                    <th style={stTh}>الإجمالي</th>
                    <th style={stTh}>المدفوع</th>
                    <th style={stTh}>المتبقي</th>
                    <th style={stTh}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.group.rows.map((p, i) => (
                    <tr key={i}>
                      <td style={stTd} dir="ltr">{fmtPrice(p.total_amount)}</td>
                      <td style={stTd} dir="ltr">{fmtPrice(p.amount)}</td>
                      <td style={stTd} dir="ltr">{fmtPrice(p.remaining)}</td>
                      <td style={stTd}>{(Number(p.remaining) || 0) <= 0 ? 'مسدد' : 'مفتوح'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 800, borderTop: '2px solid #0f766e' }}>
                    <td style={stTd} dir="ltr">{fmtPrice(statement.group.total)}</td>
                    <td style={stTd} dir="ltr">{fmtPrice(statement.group.paid)}</td>
                    <td style={stTd} dir="ltr">{fmtPrice(statement.group.remaining)}</td>
                    <td style={stTd} />
                  </tr>
                </tfoot>
              </table>
              <p style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
                شكراً لثقتكم — {profile?.clinic?.name || ''}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const stTh = { border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'start', fontSize: 11 }
const stTd = { border: '1px solid #e2e8f0', padding: '4px 6px' }
