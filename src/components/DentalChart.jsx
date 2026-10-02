import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Field, Input, Modal } from './ui'
import { formatDateShort } from '../lib/format'

const PROCEDURES = [
  'فحص', 'تنظيف جير', 'حشو ضوئي', 'حشو عادي', 'علاج عصب', 'خلع',
  'تركيبة (تلبيسة)', 'طوق أسنان', 'تبييض', 'زراعة', 'تقويم', 'جراحة',
]

// FDI permanent-teeth layout: patient's right appears on the left of the screen
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

/**
 * Odontogram (dental chart) for dentistry clinics.
 * props:
 *  - patientId
 *  - entries        staged entries for THIS visit [{tooth_no, procedure, notes}]
 *  - onEntriesChange(next)
 */
export default function DentalChart({ patientId, entries, onEntriesChange }) {
  const [history, setHistory] = useState([]) // entries from previous visits
  const [activeTooth, setActiveTooth] = useState(null)
  const [draft, setDraft] = useState({ procedure: '', notes: '' })

  useEffect(() => {
    if (!patientId) return
    supabase
      .from('dental_chart_entries')
      .select('id, tooth_no, procedure, notes, created_at, visit:visits(visit_date)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistory(data || []))
  }, [patientId])

  // latest previous-visit record per tooth
  const historyByTooth = useMemo(() => {
    const m = {}
    for (const e of history) {
      if (!m[e.tooth_no]) m[e.tooth_no] = e
    }
    return m
  }, [history])

  const stagedByTooth = useMemo(() => {
    const m = {}
    for (const e of entries) m[e.tooth_no] = e
    return m
  }, [entries])

  const openTooth = (no) => {
    setActiveTooth(no)
    const staged = stagedByTooth[no]
    setDraft({ procedure: staged?.procedure || '', notes: staged?.notes || '' })
  }

  const saveTooth = () => {
    if (!activeTooth || !draft.procedure) return
    const next = entries.filter((e) => e.tooth_no !== activeTooth)
    next.push({ tooth_no: activeTooth, procedure: draft.procedure, notes: draft.notes.trim() || null })
    onEntriesChange(next)
    setActiveTooth(null)
  }

  const removeTooth = () => {
    onEntriesChange(entries.filter((e) => e.tooth_no !== activeTooth))
    setActiveTooth(null)
  }

  const Tooth = ({ no, upper }) => {
    const staged = stagedByTooth[no]
    const past = historyByTooth[no]
    const shape = upper ? 'rounded-t-lg rounded-b-[4px]' : 'rounded-b-lg rounded-t-[4px]'
    return (
      <button
        type="button"
        onClick={() => openTooth(no)}
        className={`flex h-11 w-8 shrink-0 flex-col items-center justify-end pb-1 border-2 transition-colors ${shape} ${
          staged
            ? 'border-primary-700 bg-primary-600 text-white'
            : past
              ? 'border-amber-300 bg-amber-100 text-amber-900'
              : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-primary-400 hover:bg-white'
        }`}
        title={staged ? `اليوم: ${staged.procedure}` : past ? `سابقاً: ${past.procedure}` : `السن ${no}`}
      >
        <span className="text-[12px] font-bold leading-4">{no}</span>
        {(staged || past) && (
          <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${staged ? 'bg-white' : 'bg-amber-500'}`} />
        )}
      </button>
    )
  }

  const Arch = ({ teeth, upper, label }) => (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-end text-[10px] font-bold text-slate-300">{label}</span>
      <div className="flex items-center gap-[3px]">
        {teeth.slice(0, 8).map((no) => <Tooth key={no} no={no} upper={upper} />)}
        <span className="mx-1 h-12 w-px bg-slate-200" />
        {teeth.slice(8).map((no) => <Tooth key={no} no={no} upper={upper} />)}
      </div>
      <span className="w-10" />
    </div>
  )

  return (
    <div>
      {/* the chart scrolls horizontally on narrow screens instead of breaking */}
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto w-max space-y-2.5">
          <Arch teeth={UPPER} upper label="علوي" />
          <div className="ms-12 h-px bg-slate-100" style={{ width: 'calc(100% - 3.5rem)' }} />
          <Arch teeth={LOWER} upper={false} label="سفلي" />
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-[4px] border-2 border-slate-200 bg-slate-50" /> سليم
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-[4px] border-2 border-amber-300 bg-amber-100" /> عولج سابقاً
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-[4px] border-2 border-primary-700 bg-primary-600" /> زيارة اليوم
        </span>
        <span className="text-slate-300">·</span>
        <span>اضغط على أي سن لتسجيل إجراء</span>
      </div>

      {/* staged entries for this visit */}
      {entries.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {entries.map((e) => (
            <li key={e.tooth_no} className="flex items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs">
              <span className="font-bold text-primary-900">
                السن {e.tooth_no} — {e.procedure}
                {e.notes ? <span className="font-medium text-slate-500"> · {e.notes}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => onEntriesChange(entries.filter((x) => x.tooth_no !== e.tooth_no))}
                className="text-rose-500 hover:text-rose-700"
                aria-label="إزالة"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* tooth procedure modal */}
      <Modal
        open={!!activeTooth}
        onClose={() => setActiveTooth(null)}
        title={`السن ${activeTooth || ''}`}
        subtitle={
          historyByTooth[activeTooth]
            ? `عولج سابقاً: ${historyByTooth[activeTooth].procedure}${
                historyByTooth[activeTooth]?.visit?.visit_date
                  ? ` (${formatDateShort(historyByTooth[activeTooth].visit.visit_date)})`
                  : ''
              }`
            : 'لا يوجد سجل سابق لهذا السن'
        }
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={saveTooth} disabled={!draft.procedure}>حفظ</Button>
            {stagedByTooth[activeTooth] && (
              <Button variant="dangerGhost" onClick={removeTooth}>إزالة الإدخال</Button>
            )}
            <Button variant="secondary" onClick={() => setActiveTooth(null)}>إلغاء</Button>
          </div>
        }
      >
        <Field label="الإجراء" required>
          <div className="flex flex-wrap gap-1.5">
            {PROCEDURES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, procedure: p }))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  draft.procedure === p
                    ? 'border-primary-700 bg-primary-700 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-primary-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
        <Field label="ملاحظة (اختياري)" className="mt-3">
          <Input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="مثال: حشو ضوئي للوجه الأمامي" />
        </Field>
      </Modal>
    </div>
  )
}
