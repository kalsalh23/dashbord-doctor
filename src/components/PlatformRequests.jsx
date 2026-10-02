import { useCallback, useEffect, useState } from 'react'
import { Inbox, Check, X, RefreshCcw, Phone, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Card, Button, EmptyState, SkeletonRows } from './ui'
import { useApp } from '../lib/store'
import { dayLabel } from '../lib/format'

const STATUS_BADGE = {
  new: { label: 'بانتظار المراجعة', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'مقبول ✓', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'مرفوض', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
}

/** صندوق الطلبات الواردة من منصة دليل طيبة الإمام — القبول يحوّل الطلب لموعد مؤكد */
export default function PlatformRequests({ onChanged }) {
  const { profile, toast } = useApp()
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('platform_requests')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const accept = async (r) => {
    setBusy(r.id)
    const { data, error } = await supabase.rpc('platform_request_accept', { p_request_id: r.id })
    setBusy(null)
    if (error || data?.error) {
      toast('error', data?.error || error?.message || 'تعذر قبول الطلب')
      load()
      return
    }
    toast('success', 'تم القبول — أُضيف موعداً مؤكداً في الجدول وسُجّل المريض')
    load()
    onChanged?.()
  }

  const reject = async (r) => {
    setBusy(r.id)
    const { data, error } = await supabase.rpc('platform_request_reject', { p_request_id: r.id })
    setBusy(null)
    if (error || data?.error) {
      toast('error', data?.error || error?.message || 'تعذر رفض الطلب')
      load()
      return
    }
    toast('info', 'تم رفض الطلب — سيصل المواطن إشعار بذلك')
    load()
    onChanged?.()
  }

  const all = items || []
  const fresh = all.filter((r) => r.status === 'new')
  const history = all.filter((r) => r.status !== 'new')

  return (
    <Card bodyClass="!p-0" className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Inbox size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">طلبات واردة من دليل طيبة الإمام</p>
            <p className="text-[11px] text-slate-400">اقبل الطلب ليصبح موعداً مؤكداً في الجدول، أو ارفضه ليُبلَّغ المواطن</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fresh.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
              {fresh.length} جديد
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={load} title="تحديث" aria-label="تحديث الطلبات">
            <RefreshCcw size={15} />
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {items === null ? (
          <SkeletonRows rows={3} />
        ) : fresh.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="لا توجد طلبات جديدة"
            message="عند حجز مواطن موعداً من صفحة الطبيب في دليل طيبة الإمام سيظهر هنا فوراً"
          />
        ) : (
          <ul className="space-y-3">
            {fresh.map((r) => (
              <li key={r.id} className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{r.patient_name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <Phone size={12} className="text-primary-600" />
                        {r.patient_phone}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} className="text-primary-600" />
                        {r.day_label || dayLabel(r.requested_date)} — {r.preferred_time || 'وقت مرن'}
                        {r.requested_date ? ` (${r.requested_date})` : ''}
                      </span>
                    </p>
                    {r.note && <p className="mt-1.5 rounded-lg bg-white/70 px-3 py-1.5 text-[11px] text-slate-600">ملاحظة المواطن: {r.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="success" loading={busy === r.id} onClick={() => accept(r)}>
                      <Check size={14} /> قبول
                    </Button>
                    <Button size="sm" variant="dangerGhost" loading={busy === r.id} onClick={() => reject(r)}>
                      <X size={14} /> رفض
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {history.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600"
            >
              {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              المعالجة سابقاً ({history.length})
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1.5">
                {history.map((r) => {
                  const b = STATUS_BADGE[r.status] || STATUS_BADGE.rejected
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-xs font-semibold text-slate-600">
                        {r.patient_name} — {r.preferred_time || '—'}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${b.cls}`}>{b.label}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
