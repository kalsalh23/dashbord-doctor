import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Field, Input, Modal } from './ui'
import { formatDateShort } from '../lib/format'

const PROCEDURES = [
  'فحص', 'تنظيف جير', 'حشو ضوئي', 'حشو عادي', 'علاج عصب', 'خلع',
  'تركيبة (تلبيسة)', 'طوق أسنان', 'تبييض', 'زراعة', 'تقويم', 'جراحة',
]

// FDI permanent teeth: patient's right on the left of the screen
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const W = 470
const H = 330

// position each tooth evenly along the arch by ARC LENGTH (not angle),
// so teeth near the jaw edges spread out naturally like a real mouth
function archPos(i, n, { cy, rx, ry, flip }) {
  const K = 600
  const pt = (t) => ({
    x: W / 2 + rx * Math.cos(t),
    y: flip ? cy + ry * Math.sin(t) : cy - ry * Math.sin(t),
  })
  const segLen = (a, b) => {
    const p1 = pt(a)
    const p2 = pt(b)
    return Math.hypot(p2.x - p1.x, p2.y - p1.y)
  }
  // cumulative lengths sampling t from π → 0
  const cum = [0]
  for (let s = 1; s <= K; s++) {
    const t1 = Math.PI * (1 - (s - 1) / K)
    const t2 = Math.PI * (1 - s / K)
    cum.push(cum[s - 1] + segLen(t1, t2))
  }
  const total = cum[K]
  // target arc length for tooth i (centered within its slot)
  const target = (total * (i + 0.5)) / n
  let s = cum.findIndex((c) => c >= target)
  if (s < 1) s = 1
  const t = Math.PI * (1 - (s - 0.5) / K)
  const { x, y } = pt(t)
  const rot = 90 - (t * 180) / Math.PI
  return { x, y, rot }
}

/**
 * Odontogram — a live jaw visualization for dentistry clinics.
 * props:
 *  - patientId
 *  - entries        staged entries for THIS visit [{tooth_no, procedure, notes}]
 *  - onEntriesChange(next)
 */
export default function DentalChart({ patientId, entries, onEntriesChange }) {
  const [history, setHistory] = useState([])
  const [activeTooth, setActiveTooth] = useState(null)
  const [hover, setHover] = useState(null)
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

  const toothFill = (no) => {
    if (stagedByTooth[no]) return '#0d9488'
    if (historyByTooth[no]) return '#fef3c7'
    return '#f8fafc'
  }
  const toothStroke = (no) => {
    if (stagedByTooth[no]) return '#0f766e'
    if (historyByTooth[no]) return '#fcd34d'
    return '#cbd5e1'
  }

  const renderArch = (teeth, { cy, rx, ry, flip }) =>
    teeth.map((no, i) => {
      const { x, y, rot } = archPos(i, teeth.length, { cy, rx, ry, flip })
      const isActive = activeTooth === no
      const isHover = hover === no
      return (
        <g
          key={no}
          transform={`translate(${x},${y}) rotate(${rot})`}
          onClick={() => openTooth(no)}
          onMouseEnter={() => setHover(no)}
          onMouseLeave={() => setHover(null)}
          style={{ cursor: 'pointer' }}
        >
          <title>
            {`السن ${no}${stagedByTooth[no] ? ' — اليوم: ' + stagedByTooth[no].procedure : ''}${
              !stagedByTooth[no] && historyByTooth[no] ? ' — سابقاً: ' + historyByTooth[no].procedure : ''
            }`}
          </title>
          <rect
            x={-12}
            y={flip ? -16 : -14}
            width={24}
            height={28}
            rx={10}
            fill={toothFill(no)}
            stroke={isActive || isHover ? '#0f766e' : toothStroke(no)}
            strokeWidth={isActive || isHover ? 3 : 2}
          />
          {/* keep the tooth number upright regardless of the arch rotation */}
          <text
            transform={`rotate(${-rot})`}
            y={5}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill={stagedByTooth[no] ? '#ffffff' : historyByTooth[no] ? '#92400e' : '#64748b'}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {no}
          </text>
        </g>
      )
    })

  return (
    <div>
      {/* live jaw visualization */}
      <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-xl" role="img" aria-label="مخطط الفكين العلوي والسفلي">
          {/* gum arcs */}
          <path d={`M ${W / 2 - 188} ${118} A 188 84 0 0 1 ${W / 2 + 185} ${120}`} fill="none" stroke="#e2e8f0" strokeWidth={10} strokeLinecap="round" />
          <path d={`M ${W / 2 - 188} ${218} A 188 84 0 0 0 ${W / 2 + 185} ${230}`} fill="none" stroke="#e2e8f0" strokeWidth={10} strokeLinecap="round" />
          {renderArch(UPPER, { cy: 116, rx: 170, ry: 80, flip: false })}
          {renderArch(LOWER, { cy: 218, rx: 170, ry: 80, flip: true })}
        </svg>
      </div>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-[5px] border-2 border-slate-300 bg-slate-50" /> سليم
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-[5px] border-2 border-amber-300 bg-amber-100" /> عولج سابقاً
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-[5px] border-2 border-primary-700 bg-primary-600" /> زيارة اليوم
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
