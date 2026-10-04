import { useCallback, useEffect, useMemo, useState } from 'react'
import { NotebookPen, PencilLine, Plus, Trash2, X } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, SkeletonRows } from '../../components/ui'
import { ageFrom, todayStr } from '../../lib/format'
import { fmtPrice } from '../../lib/dental'

/**
 * سجلي اليوم — جدول عمل اليوم: الاسم، العمر، ماذا عملت للمريض، والمبلغ المدفوع.
 * إضافة / تعديل / حذف مباشرة من الجدول.
 */
export default function DentalTodayLog() {
  const { profile, toast } = useApp()
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null) // {visitId, name, age, desc}
  const [addOpen, setAddOpen] = useState(false)

  const today = todayStr()
  const dayStart = today + 'T00:00:00'

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const [vRes, dRes, pRes] = await Promise.all([
      supabase
        .from('visits')
        .select('id, visit_date, chief_complaint, patient:patients(id, full_name, date_of_birth, phone)')
        .eq('clinic_id', profile.clinic_id)
        .eq('visit_date', today)
        .order('created_at', { ascending: false }),
      supabase
        .from('dental_chart_entries')
        .select('visit_id, tooth_no, procedure')
        .eq('clinic_id', profile.clinic_id),
      supabase
        .from('payments')
        .select('id, patient_id, total_amount, amount, remaining, status, method')
        .eq('clinic_id', profile.clinic_id)
        .gte('created_at', dayStart),
    ])
    const visits = vRes.data || []
    const entries = dRes.data || []
    const pays = pRes.data || []
    const byVisit = {}
    for (const e of entries) {
      byVisit[e.visit_id] = byVisit[e.visit_id] || []
      byVisit[e.visit_id].push(`سن ${e.tooth_no}: ${e.procedure}`)
    }
    const byPatient = {}
    for (const p of pays) {
      byPatient[p.patient_id] = byPatient[p.patient_id] || { paid: 0, total: 0, rows: [] }
      byPatient[p.patient_id].paid += Number(p.amount) || 0
      byPatient[p.patient_id].total += Number(p.total_amount) || 0
      byPatient[p.patient_id].rows.push(p)
    }
    setRows(
      visits.map((v) => {
        const entriesText = (byVisit[v.id] || []).join(' · ')
        const fin = byPatient[v.patient?.id] || { paid: 0, total: 0, rows: [] }
        return { visit: v, patient: v.patient, desc: v.chief_complaint || entriesText || '', ...fin }
      })
    )
  }, [profile?.clinic_id, today, dayStart])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const paid = (rows || []).reduce((s, r) => s + r.paid, 0)
    const total = (rows || []).reduce((s, r) => s + r.total, 0)
    return { paid, total }
  }, [rows])

  /* ---------------- تعديل صف ---------------- */
  const openEdit = (row) => setEditing({ visitId: row.visit.id, desc: row.desc, paid: row.paid || '', name: row.patient?.full_name })

  const saveEdit = async () => {
    const e = editing
    if (!e) return
    // تحديث وصف العمل
    const { error: vErr } = await supabase.from('visits').update({ chief_complaint: e.desc.trim() || null }).eq('id', e.visitId)
    if (vErr) return toast('error', 'تعذر تحديث الوصف: ' + vErr.message)
    // ضبط المدفوع: نعدّل أول دفعة اليوم لهذا المريض أو ننشئها
    const row = rows.find((r) => r.visit.id === e.visitId)
    const desired = Number(e.paid) || 0
    const diff = desired - (row?.paid || 0)
    if (diff !== 0 && row?.patient?.id) {
      const payRows = row.rows || []
      if (payRows.length > 0) {
        const pr = payRows[0]
        const newAmount = Math.max(0, (Number(pr.amount) || 0) + diff)
        const newRemaining = Math.max(0, (Number(pr.total_amount) || 0) - newAmount)
        const { error } = await supabase
          .from('payments')
          .update({ amount: newAmount, remaining: newRemaining, status: newRemaining <= 0 ? 'paid' : 'due_later' })
          .eq('id', pr.id)
        if (error) return toast('error', 'تعذر تحديث الدفعة: ' + error.message)
      } else if (diff > 0) {
        const { error } = await supabase.from('payments').insert({
          clinic_id: profile.clinic_id,
          patient_id: row.patient.id,
          total_amount: diff,
          amount: diff,
          remaining: 0,
          method: 'cash',
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        if (error) return toast('error', 'تعذر تسجيل الدفعة: ' + error.message)
      }
    }
    toast('success', 'تم تحديث السجل')
    setEditing(null)
    load()
  }

  /* ---------------- حذف صف ---------------- */
  const deleteRow = async (row) => {
    const { error } = await supabase.from('visits').delete().eq('id', row.visit.id)
    if (error) return toast('error', 'تعذر الحذف: ' + error.message)
    toast('success', 'حُذف صف اليوم — سجلات الدفع تبقى في صفحة الدفعات')
    load()
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="سجلي اليوم"
        subtitle="كل ما عملته اليوم: الاسم، العمر، ماذا عملت للمريض، والمبلغ المدفوع"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={15} />
            إضافة سجل
          </Button>
        }
      />

      {rows === null ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title="لا يوجد عمل مسجل اليوم"
            message="تظهر هنا تلقائياً كل زيارة تكملها من الكشف، ويمكنك إضافة سجل يدوي بزر «إضافة سجل»"
          />
        </Card>
      ) : (
        <Card bodyClass="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="px-4 py-2.5 text-start font-bold">الاسم</th>
                  <th className="px-3 py-2.5 text-start font-bold">العمر</th>
                  <th className="px-3 py-2.5 text-start font-bold">ماذا عملت</th>
                  <th className="px-3 py-2.5 text-start font-bold">الإجمالي</th>
                  <th className="px-3 py-2.5 text-start font-bold">المدفوع</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.visit.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-bold text-slate-800">{r.patient?.full_name || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.patient?.date_of_birth ? ageFrom(r.patient.date_of_birth) : '—'}</td>
                    <td className="max-w-[260px] px-3 py-2.5 text-xs leading-relaxed text-slate-600">{r.desc || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600" dir="ltr">{fmtPrice(r.total)}</td>
                    <td className="px-3 py-2.5 font-bold text-emerald-700" dir="ltr">{fmtPrice(r.paid)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="تعديل">
                          <PencilLine size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRow(r)} title="حذف">
                          <Trash2 size={14} className="text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
                  <td className="px-4 py-2.5" colSpan={3}>إجمالي اليوم — {rows.length} مريض</td>
                  <td className="px-3 py-2.5" dir="ltr">{fmtPrice(totals.total)}</td>
                  <td className="px-3 py-2.5 text-emerald-700" dir="ltr">{fmtPrice(totals.paid)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* نافذة تعديل الصف */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? 'تعديل سجل: ' + editing.name : ''}
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={saveEdit}>حفظ التعديلات</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>إلغاء</Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-3">
            <Field label="ماذا عملت لهذا المريض">
              <Input value={editing.desc} onChange={(e) => setEditing((s) => ({ ...s, desc: e.target.value }))} />
            </Field>
            <Field label="المبلغ المدفوع (الإجمالي لعمل اليوم)">
              <Input type="number" dir="ltr" value={editing.paid} onChange={(e) => setEditing((s) => ({ ...s, paid: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>

      {/* إضافة سجل يدوي */}
      <AddLogModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false)
          load()
        }}
      />
    </div>
  )
}

/* ---------------- إضافة سجل: مريض موجود أو جديد + العمل + المدفوع ---------------- */
function AddLogModal({ open, onClose, onSaved }) {
  const { profile, toast } = useApp()
  const [mode, setMode] = useState('existing') // existing | new
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [chosen, setChosen] = useState(null)
  const [newP, setNewP] = useState({ name: '', age: '', phone: '' })
  const [desc, setDesc] = useState('')
  const [paid, setPaid] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setQ(''); setResults([]); setChosen(null); setNewP({ name: '', age: '', phone: '' }); setDesc(''); setPaid(''); setMode('existing')
    }
  }, [open])

  useEffect(() => {
    if (!open || mode !== 'existing' || !profile?.clinic_id) return
    const term = q.trim()
    if (!term) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, date_of_birth')
        .eq('clinic_id', profile.clinic_id)
        .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(6)
      setResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, mode, profile?.clinic_id])

  const save = async () => {
    let patientId = chosen?.id
    try {
      if (mode === 'new') {
        if (!newP.name.trim()) return toast('error', 'اسم المريض مطلوب')
        const age = Number(newP.age)
        // تاريخ ميلاد تقريبي من العمر (النظام يعتمد العمر الظاهر)
        const dob = Number.isFinite(age) && age >= 0 && age < 120
          ? new Date(new Date().getFullYear() - age, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10)
          : null
        const { data, error } = await supabase
          .from('patients')
          .insert({ clinic_id: profile.clinic_id, full_name: newP.name.trim(), phone: newP.phone.trim() || '—', date_of_birth: dob, created_by: profile.id })
          .select()
          .single()
        if (error) throw new Error(error.message)
        patientId = data.id
      }
      if (!patientId) return toast('error', 'اختر مريضاً موجوداً أو أضف مريضاً جديداً')
      const { data: visit, error: vErr } = await supabase
        .from('visits')
        .insert({
          clinic_id: profile.clinic_id,
          patient_id: patientId,
          doctor_id: profile.id,
          visit_date: todayStr(),
          chief_complaint: desc.trim() || 'عمل يومي',
        })
        .select()
        .single()
      if (vErr) throw new Error(vErr.message)
      const amount = Number(paid) || 0
      if (amount > 0) {
        const { error: pErr } = await supabase.from('payments').insert({
          clinic_id: profile.clinic_id,
          patient_id: patientId,
          total_amount: amount,
          amount,
          remaining: 0,
          method: 'cash',
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        if (pErr) throw new Error(pErr.message)
      }
      toast('success', 'تمت إضافة سجل اليوم')
      onSaved()
    } catch (err) {
      toast('error', 'تعذر الحفظ: ' + err.message)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="إضافة سجل إلى سجلي اليوم"
      footer={
        <div className="flex justify-start gap-2">
          <Button onClick={save} loading={saving}>حفظ السجل</Button>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" variant={mode === 'existing' ? 'primary' : 'secondary'} onClick={() => setMode('existing')}>مريض موجود</Button>
          <Button size="sm" variant={mode === 'new' ? 'primary' : 'secondary'} onClick={() => setMode('new')}>مريض جديد</Button>
        </div>

        {mode === 'existing' ? (
          chosen ? (
            <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-bold text-primary-900">
              <span>{chosen.full_name} <span className="text-xs font-medium text-slate-500" dir="ltr">{chosen.phone}</span></span>
              <button onClick={() => setChosen(null)} aria-label="تغيير"><X size={15} /></button>
            </div>
          ) : (
            <Field label="ابحث بالاسم أو الهاتف">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اكتب للبحث..." autoFocus />
              {results.length > 0 && (
                <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => setChosen(p)} className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-primary-50">
                        <span className="font-semibold text-slate-800">{p.full_name}</span>
                        <span className="text-xs text-slate-400" dir="ltr">{p.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          )
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="الاسم" required className="sm:col-span-1">
              <Input value={newP.name} onChange={(e) => setNewP((p) => ({ ...p, name: e.target.value }))} autoFocus />
            </Field>
            <Field label="العمر">
              <Input type="number" dir="ltr" value={newP.age} onChange={(e) => setNewP((p) => ({ ...p, age: e.target.value }))} />
            </Field>
            <Field label="الهاتف (اختياري)">
              <Input dir="ltr" value={newP.phone} onChange={(e) => setNewP((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
          </div>
        )}

        <Field label="ماذا عملت لهذا المريض">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثال: حشو ضوئي للسن 26 + تنظيف جير" />
        </Field>
        <Field label="المبلغ المدفوع (اختياري)">
          <Input type="number" dir="ltr" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" />
        </Field>
      </div>
    </Modal>
  )
}
