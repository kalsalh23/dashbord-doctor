import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Field, Input, Modal } from './ui'
import { formatDateShort } from '../lib/format'
import { teethForAge, dentitionLabel, fmtPrice, treatmentGlyph } from '../lib/dental'

const W = 640
const H = 360

// موضع كل سنّ على القوس بمسافة قوس متساوية (كالفك الحقيقي)
function archPos(i, n, { cy, rx, ry, flip }) {
  const K = 700
  const pt = (t) => ({
    x: W / 2 + rx * Math.cos(t),
    y: flip ? cy + ry * Math.sin(t) : cy - ry * Math.sin(t),
  })
  const segLen = (a, b) => {
    const p1 = pt(a)
    const p2 = pt(b)
    return Math.hypot(p2.x - p1.x, p2.y - p1.y)
  }
  const cum = [0]
  for (let s = 1; s <= K; s++) {
    const t1 = Math.PI * (1 - (s - 1) / K)
    const t2 = Math.PI * (1 - s / K)
    cum.push(cum[s - 1] + segLen(t1, t2))
  }
  const total = cum[K]
  const target = (total * (i + 0.5)) / n
  let s = cum.findIndex((c) => c >= target)
  if (s < 1) s = 1
  const t = Math.PI * (1 - (s - 0.5) / K)
  const { x, y } = pt(t)
  const rot = 90 - (t * 180) / Math.PI
  return { x, y, rot }
}

/**
 * مخطط الأسنان (الodontogram) — فك أفقي واقعي يتغير مع عمر المريض:
 * لبنية / مختلطة / دائمة. لكل علاج لون وشكل على السن.
 * props:
 *  - patientId          (لجلب تاريخ المعالجات السابقة)
 *  - age                عمر المريض
 *  - entries            إدخالات هذه الزيارة [{tooth_no, category, treatment, price, color, notes}]
 *  - pricebook          [{category, treatment, price, color}] من جدول أسعاري
 *  - onEntriesChange(next)
 */
export default function DentalChart({ patientId, age, entries, pricebook, onEntriesChange }) {
  const [history, setHistory] = useState([])
  const [activeTooth, setActiveTooth] = useState(null)
  const [hover, setHover] = useState(null)
  const [cat, setCat] = useState('')
  const [notes, setNotes] = useState('')
  const [bridge, setBridge] = useState(null) // {from} أثناء اختيار السن الثاني ثم {from, to}

  useEffect(() => {
    if (!patientId) return
    supabase
      .from('dental_chart_entries')
      .select('id, tooth_no, procedure, notes, created_at, visit:visits(visit_date)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setHistory(data || []))
  }, [patientId])

  const dentition = useMemo(() => teethForAge(age), [age])
  const { upper, lower, type } = dentition
  const scale = dentition.type === 'primary' ? 0.72 : dentition.type === 'mixed' ? 0.85 : 1

  const historyByTooth = useMemo(() => {
    const m = {}
    for (const e of history) {
      if (!m[e.tooth_no]) m[e.tooth_no] = e
    }
    return m
  }, [history])

  const stagedByTooth = useMemo(() => {
    // قد يُطبق أكثر من علاج على السن الواحد — قائمة لكل سن
    const m = {}
    for (const e of entries) {
      m[e.tooth_no] = m[e.tooth_no] || []
      m[e.tooth_no].push(e)
    }
    return m
  }, [entries])

  const categories = useMemo(() => {
    const seen = []
    for (const p of pricebook || []) if (!seen.includes(p.category)) seen.push(p.category)
    return seen
  }, [pricebook])

  const child = dentition.type !== 'permanent'

  const openTooth = (no) => {
    // أثناء تحديد الجسر: النقر يحدد السن الثاني بدل فتح النافذة
    if (bridge && !bridge.to) {
      if (no === bridge.from) return
      setBridge({ ...bridge, to: no })
      return
    }
    setActiveTooth(no)
    setCat('')
    setNotes('')
  }

  // أرضية الجسر: كل الأسنان الواقعة بين السنّين على نفس القوس
  const spanFor = (from, to) => {
    const upperSet = [...(dentition.upper)]
    const lowerSet = [...(dentition.lower)]
    if (upperSet.includes(from) && upperSet.includes(to)) {
      const i1 = upperSet.indexOf(from)
      const i2 = upperSet.indexOf(to)
      return upperSet.slice(Math.min(i1, i2), Math.max(i1, i2) + 1)
    }
    if (lowerSet.includes(from) && lowerSet.includes(to)) {
      const i1 = lowerSet.indexOf(from)
      const i2 = lowerSet.indexOf(to)
      return lowerSet.slice(Math.min(i1, i2), Math.max(i1, i2) + 1)
    }
    return [from, to]
  }

  const confirmBridge = () => {
    if (!bridge?.to) return
    const span = spanFor(bridge.from, bridge.to)
    const item = (pricebook || []).find((p) => (p.treatment || '').includes('جسر')) || { price: 0, color: '#7c3aed' }
    onEntriesChange([
      ...entries,
      {
        bridge: true,
        teeth: [bridge.from, bridge.to],
        span,
        category: 'تركيبات خزفية',
        treatment: 'جسر',
        price: Number(item.price) || 0,
        color: item.color || '#7c3aed',
        notes: null,
      },
    ])
    setBridge(null)
  }

  const bridgeFor = (no) => entries.find((e) => e.bridge && (e.span || e.teeth).includes(no))

  const applyTreatment = (item) => {
    if (!activeTooth || !item) return
    // إضافة علاج آخر للسن نفسه (لا يستبدل السابق)
    onEntriesChange([
      ...entries,
      {
        tooth_no: activeTooth,
        category: item.category,
        treatment: item.treatment,
        price: Number(item.price) || 0,
        color: item.color || '#0d9488',
        notes: notes.trim() || null,
      },
    ])
    setNotes('')
  }

  const removeEntryAt = (index) => {
    onEntriesChange(entries.filter((_, i) => i !== index))
  }

  const removeToothTreatments = () => {
    onEntriesChange(entries.filter((e) => e.tooth_no !== activeTooth))
  }

  const colors = (no) => {
    const b = bridgeFor(no)
    if (b) return { fill: '#7c3aed', stroke: '#5b21b6', isStaged: true }
    const list = stagedByTooth[no]
    if (list && list.length) {
      const last = list[list.length - 1]
      return { fill: last.color, stroke: last.color, isStaged: true }
    }
    const h = historyByTooth[no]
    if (h) return { fill: '#fef9c3', stroke: '#facc15', isStaged: false }
    return { fill: '#f8fafc', stroke: '#cbd5e1', isStaged: false }
  }

  const lastTreatment = (no) => {
    const list = stagedByTooth[no]
    return list && list.length ? list[list.length - 1].treatment || '' : ''
  }
  const isExtraction = (no) => lastTreatment(no).includes('خلع') || lastTreatment(no).includes('قلع')
  const isRootCanal = (no) => lastTreatment(no).includes('عصب') || lastTreatment(no).includes('قناة')
  const isCrown = (no) => ['تلبيسة', 'تاج', 'فينير', 'طوق'].some((w) => lastTreatment(no).includes(w))
  const glyphFor = (no) => {
    const b = bridgeFor(no)
    if (b) return 'bridge'
    return treatmentGlyph(lastTreatment(no))
  }

  // الشكل المميز للعلاج فوق التاج: تاج ذهبي، مسمار زراعة، تقويم، نقاط لثة، نجوم تبييض...
  const Glyph = ({ no, flip }) => {
    const g = glyphFor(no)
    if (!g || g === 'extraction' || g === 'rct' || g === 'bridge') return null
    const c = colors(no)
    const ink = c.isStaged ? '#ffffff' : '#334155'
    const cw = 22 * scale
    const y0 = flip ? 2 : -2
    if (g === 'crown') {
      return (
        <path
          d={`M -6 ${y0 + 3} L -6 ${y0 - 2} L -3 ${y0} L 0 ${y0 - 4} L 3 ${y0} L 6 ${y0 - 2} L 6 ${y0 + 3} Z`}
          fill="#fbbf24"
          stroke="#92400e"
          strokeWidth={1}
          style={{ pointerEvents: 'none' }}
        />
      )
    }
    if (g === 'implant') {
      const ry0 = flip ? -11 * scale : 11 * scale
      const ry1 = flip ? -22 * scale : 22 * scale
      return (
        <g stroke="#065f46" strokeWidth={2} strokeLinecap="round" style={{ pointerEvents: 'none' }}>
          <line x1={0} y1={ry0} x2={0} y2={ry1} />
          <line x1={-3} y1={ry0 + (flip ? -2 : 2)} x2={3} y2={ry0 + (flip ? -4 : 4)} />
          <line x1={3} y1={ry0 + (flip ? -6 : 6)} x2={-3} y2={ry0 + (flip ? -8 : 8)} />
        </g>
      )
    }
    if (g === 'ortho') {
      return (
        <rect x={-3.5} y={y0 - 3.5} width={7} height={7} rx={1.5} fill="#fdf2f8" stroke="#db2777" strokeWidth={1.4} style={{ pointerEvents: 'none' }} />
      )
    }
    if (g === 'filling') {
      return <circle cx={0} cy={y0} r={3.2} fill="#ffffff" opacity={0.95} style={{ pointerEvents: 'none' }} />
    }
    if (g === 'caries') {
      return <circle cx={-4} cy={y0 - 3} r={3} fill="#7f1d1d" style={{ pointerEvents: 'none' }} />
    }
    if (g === 'perio') {
      return (
        <g fill="#fb7185" style={{ pointerEvents: 'none' }}>
          <circle cx={-5} cy={flip ? -8 * scale : 8 * scale} r={1.8} />
          <circle cx={0} cy={flip ? -9 * scale : 9 * scale} r={1.8} />
          <circle cx={5} cy={flip ? -8 * scale : 8 * scale} r={1.8} />
        </g>
      )
    }
    if (g === 'cleaning' || g === 'whitening') {
      const star = (cx, cy, r) =>
        `M ${cx} ${cy - r} L ${cx + r * 0.35} ${cy - r * 0.35} L ${cx + r} ${cy} L ${cx + r * 0.35} ${cy + r * 0.35} L ${cx} ${cy + r} L ${cx - r * 0.35} ${cy + r * 0.35} L ${cx - r} ${cy} L ${cx - r * 0.35} ${cy - r * 0.35} Z`
      return (
        <g fill="#ffffff" opacity={0.95} style={{ pointerEvents: 'none' }}>
          <path d={star(-4, y0 - 2, 3)} />
          <path d={star(4, y0 + 3, 2.2)} />
        </g>
      )
    }
    if (g === 'preventive') {
      return (
        <text x={0} y={y0 + 3.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#16a34a" style={{ pointerEvents: 'none' }}>
          ✓
        </text>
      )
    }
    if (g === 'xray') {
      return (
        <rect x={-5} y={y0 - 4} width={10} height={8} rx={1.5} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1.2} style={{ pointerEvents: 'none' }} />
      )
    }
    return null
  }

  // سنّ واحد: تاج + جذر (جذران للضواحك والأرحاء) — الجذر باتجاه اللثة
  const ToothShape = ({ no, flip }) => {
    const c = colors(no)
    const S = scale
    const cw = 22 * S // عرض التاج
    const ch = 18 * S
    const rl = 16 * S // طول الجذر
    const extracted = isExtraction(no)
    const rct = isRootCanal(no)
    const crown = isCrown(no)
    const molars = [16, 26, 36, 46, 17, 27, 37, 47, 55, 54, 64, 65, 75, 74, 84, 85, 18, 28, 38, 48].includes(no)
    const rootY1 = flip ? -ch / 2 - 2 : ch / 2 + 2
    const rootY2 = flip ? rootY1 - rl : rootY1 + rl
    return (
      <g>
        {/* الجذور */}
        {molars ? (
          <>
            <path d={`M ${-cw / 2 + 1} ${rootY1} L ${-cw / 2 + 3.5} ${rootY2} L ${-2} ${rootY1} Z`} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} opacity={0.9} />
            <path d={`M ${cw / 2 - 1} ${rootY1} L ${cw / 2 - 3.5} ${rootY2} L ${2} ${rootY1} Z`} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} opacity={0.9} />
          </>
        ) : (
          <path d={`M ${-cw / 2 + 2} ${rootY1} L 0 ${rootY2} L ${cw / 2 - 2} ${rootY1} Z`} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} opacity={0.9} />
        )}
        {/* التاج */}
        <rect
          x={-cw / 2}
          y={-ch / 2}
          width={cw}
          height={ch}
          rx={molars ? 5 * S : 8 * S}
          fill={extracted ? '#e2e8f0' : c.fill}
          stroke={crown ? '#b45309' : c.stroke}
          strokeWidth={crown ? 3.5 : 2}
          fillOpacity={extracted ? 0.6 : 0.92}
        />
        {/* علامة الخلع */}
        {extracted && (
          <g stroke="#0f172a" strokeWidth={2.4} strokeLinecap="round">
            <line x1={-cw / 2 + 3} y1={-ch / 2 + 3} x2={cw / 2 - 3} y2={ch / 2 - 3} />
            <line x1={cw / 2 - 3} y1={-ch / 2 + 3} x2={-cw / 2 + 3} y2={ch / 2 - 3} />
          </g>
        )}
        {/* عدد العلاجات المطبقة على السن */}
        {(stagedByTooth[no]?.length || 0) > 1 && (
          <g>
            <circle cx={cw / 2} cy={-ch / 2} r={6.5} fill="#0f766e" />
            <text x={cw / 2} y={-ch / 2 + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#ffffff" style={{ pointerEvents: 'none' }}>
              {stagedByTooth[no].length}
            </text>
          </g>
        )}
        {/* خط علاج العصب داخل الجذر */}
        {rct && !extracted && (
          <line x1={0} y1={flip ? -ch / 2 : ch / 2} x2={0} y2={rootY2} stroke="#7c2d12" strokeWidth={2.2} strokeLinecap="round" />
        )}
        {/* شكل العلاج المميز (تاج/زراعة/تقويم/تبييض...) */}
        <Glyph no={no} flip={flip} />
        {/* رقم السن */}
        <text y={flip ? ch / 2 + 11 : -ch / 2 - 5} textAnchor="middle" fontSize={9.5 * (S < 1 ? 1 : 1)} fontWeight={700}
          fill={c.isStaged ? c.color : historyByTooth[no] ? '#a16207' : '#94a3b8'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {no}
        </text>
      </g>
    )
  }

  const renderArch = (teeth, { cy, rx, ry, flip }) =>
    teeth.map((no, i) => {
      const { x, y, rot } = archPos(i, teeth.length, { cy, rx, ry, flip })
      const isActive = activeTooth === no
      const isHover = hover === no
      const list = stagedByTooth[no] || []
      const h = historyByTooth[no]
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
            {`السن ${no}${list.length ? ' — اليوم: ' + list.map((e) => e.treatment).join(' + ') : ''}${
              !list.length && h ? ' — سابقاً: ' + h.procedure : ''
            }`}
          </title>
          {isActive && <circle r={26 * scale} fill="#0d9488" opacity={0.15} />}
          <ToothShape no={no} flip={flip} />
          {(isHover || isActive) && (
            <circle r={23 * scale} fill="none" stroke="#0f766e" strokeWidth={2} strokeDasharray="3 3" />
          )}
        </g>
      )
    })

  // لوحة الألوان: علاجات اليوم المستخدمة + الأساسيات
  const usedTreatments = useMemo(() => {
    const m = new Map()
    for (const e of entries) m.set(e.treatment, e.color)
    return [...m.entries()]
  }, [entries])

  return (
    <div>
      <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white p-2">
        <p className="mb-1 text-center text-[11px] font-bold text-slate-400">{dentitionLabel(type)} — العمر: {age ?? '—'}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full" role="img" aria-label="مخطط الفكين العلوي والسفلي">
          {/* اللثة */}
          <path d={`M ${W / 2 - 236} ${128} A 236 96 0 0 1 ${W / 2 + 234} ${130}`} fill="none" stroke="#fbcfe8" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
          <path d={`M ${W / 2 - 236} ${236} A 236 96 0 0 0 ${W / 2 + 234} ${234}`} fill="none" stroke="#fbcfe8" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
          {/* وصلات الجسور خلف الأسنان */}
          {(entries || []).filter((e) => e.bridge).map((b, i) => {
            const isUpper = dentition.upper.includes(b.teeth[0])
            const arch = isUpper ? { cy: 122, rx: 215, ry: 92, flip: false } : { cy: 242, rx: 215, ry: 92, flip: true }
            const list = isUpper ? dentition.upper : dentition.lower
            const i1 = list.indexOf(b.span[0])
            const i2 = list.indexOf(b.span[b.span.length - 1])
            if (i1 < 0 || i2 < 0) return null
            const p1 = archPos(i1, list.length, arch)
            const p2 = archPos(i2, list.length, arch)
            return <line key={'br' + i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#7c3aed" strokeWidth={9} strokeLinecap="round" opacity={0.85} />
          })}
          {renderArch(upper, { cy: 122, rx: 215, ry: 92, flip: false })}
          {renderArch(lower, { cy: 242, rx: 215, ry: 92, flip: true })}
        </svg>

        {/* شريط تحديد الجسر */}
        {bridge && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-2.5">
            {!bridge.to ? (
              <p className="text-xs font-bold text-violet-800">جسر: اختر الآن السن الآخر الذي سيتصل به من الفك — السن الأول: {bridge.from}</p>
            ) : (
              <p className="text-xs font-bold text-violet-800">جسر من السن {bridge.from} إلى السن {bridge.to} — يؤشر «تحديد الجسر» للتلوين والحساب</p>
            )}
            <Button size="sm" disabled={!bridge.to} onClick={confirmBridge}>تحديد الجسر</Button>
            <Button size="sm" variant="secondary" onClick={() => setBridge(null)}>إلغاء</Button>
          </div>
        )}
      </div>

      {/* لوحة الألوان الكاملة */}
      <div className="mt-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
        <p className="mb-1 text-[10px] font-bold text-slate-400">دليل الألوان — لكل علاج لونه على السن</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-slate-300 bg-slate-50" /> سليم
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-amber-300 bg-amber-100" /> عولج سابقاً
          </span>
          {usedTreatments.map(([t, c]) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border" style={{ background: c, borderColor: c }} /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* إدخالات هذه الزيارة */}
      {entries.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {entries.map((e, idx) => (
            <li key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs">
              <span className="flex items-center gap-2 font-bold text-primary-900">
                <span className="inline-block h-3 w-3 rounded border" style={{ background: e.color, borderColor: e.color }} />
                {e.bridge
                  ? `جسر من السن ${e.teeth[0]} إلى ${e.teeth[1]} (يشمل ${e.span.length} أسنان)`
                  : `السن ${e.tooth_no} — ${e.treatment}`}
                {e.price ? <span className="text-slate-500"> · {fmtPrice(e.price)}</span> : null}
                {e.notes ? <span className="font-medium text-slate-500"> · {e.notes}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => removeEntryAt(idx)}
                className="text-rose-500 hover:text-rose-700"
                aria-label="إزالة"
              >
                إزالة العلاج
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* نافذة تشخيص السن */}
      <Modal
        open={!!activeTooth}
        onClose={() => setActiveTooth(null)}
        title={`السن ${activeTooth || ''}`}
        subtitle={
          bridgeFor(activeTooth)
            ? `جزء من جسر من السن ${bridgeFor(activeTooth).teeth[0]} إلى ${bridgeFor(activeTooth).teeth[1]} — يُزال كوحدة واحدة، ويمكن إضافة علاج آخر فوقه`
            : (stagedByTooth[activeTooth] || []).length
            ? `علاجات اليوم: ${(stagedByTooth[activeTooth] || []).map((e) => e.treatment).join(' + ')}`
            : historyByTooth[activeTooth]
              ? `عولج سابقاً: ${historyByTooth[activeTooth].procedure}${
                  historyByTooth[activeTooth]?.visit?.visit_date ? ` (${formatDateShort(historyByTooth[activeTooth].visit.visit_date)})` : ''
                }`
              : 'لا يوجد سجل سابق لهذا السن — اختر الفئة ثم العلاج'
        }
        footer={
          <div className="flex flex-wrap justify-start gap-2">
            {bridgeFor(activeTooth) && (
              <Button variant="dangerGhost" onClick={() => { onEntriesChange(entries.filter((e) => e !== bridgeFor(activeTooth))); setActiveTooth(null) }}>
                إزالة الجسر
              </Button>
            )}
            {(stagedByTooth[activeTooth] || []).length > 0 && (
              <Button variant="dangerGhost" onClick={removeToothTreatments}>إزالة كل علاجات اليوم من هذا السن</Button>
            )}
            <Button variant="secondary" onClick={() => setActiveTooth(null)}>إنهاء</Button>
          </div>
        }
      >
        {/* خيار الجسر المميز — أعلى الفئات */}
        {!bridgeFor(activeTooth) && (
          <button
            type="button"
            onClick={() => { setBridge({ from: activeTooth }); setActiveTooth(null) }}
            className="mb-3 flex w-full items-center justify-between rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-2.5 text-start transition-colors hover:bg-violet-100"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-violet-800">
              <span className="inline-block h-3 w-8 rounded bg-violet-600" />
              تركيب جسر — توصيل هذا السن بسن آخر
            </span>
            <span className="text-[10px] text-violet-500">يُلوَّن بالبنفسجي ويُحسب سعره كوحدة واحدة</span>
          </button>
        )}
        {/* العلاجات المطبقة على هذا السن — يمكن إزالة أي واحد منها */}
        {(stagedByTooth[activeTooth] || []).length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {(stagedByTooth[activeTooth] || []).map((e, idx) => {
              const globalIdx = entries.findIndex((x) => x === e)
              return (
                <li key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 font-bold text-primary-900">
                    <span className="inline-block h-3 w-3 rounded border" style={{ background: e.color, borderColor: e.color }} />
                    {e.treatment}
                    {e.price ? <span className="text-slate-500"> · {fmtPrice(e.price)}</span> : null}
                    {e.notes ? <span className="font-medium text-slate-500"> · {e.notes}</span> : null}
                  </span>
                  <button type="button" onClick={() => removeEntryAt(globalIdx)} className="text-rose-500 hover:text-rose-700">
                    إزالة
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {categories.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            لا توجد أسعار محفوظة — أضف فئات وعلاجات من صفحة «أسعاري» أولاً
          </p>
        ) : (
          <>
            <Field label="فئة التشخيص">
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      cat === c ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-primary-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            {cat && (
              <Field label="أضف علاجاً آخر لهذا السن — يُحسب سعره تلقائياً على حساب المريض" className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {(pricebook || [])
                    .filter((p) => p.category === cat)
                    .map((p, i) => (
                      <button
                        key={(p.treatment || '') + i}
                        type="button"
                        onClick={() => applyTreatment(p)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-primary-400 hover:bg-primary-50"
                      >
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                        {p.treatment}
                        {Number(p.price) > 0 && <span className="text-[10px] text-slate-400">{fmtPrice(p.price)}</span>}
                      </button>
                    ))}
                </div>
              </Field>
            )}
            <Field label="ملاحظة (اختياري)" className="mt-3">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: حشو ضوئي للوجه الأمامي" />
            </Field>
          </>
        )}
      </Modal>
    </div>
  )
}
