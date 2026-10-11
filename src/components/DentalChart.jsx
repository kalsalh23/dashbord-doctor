import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Field, Input, Modal } from './ui'
import { formatDateShort } from '../lib/format'
import { teethForAge, dentitionLabel, fmtPrice, treatmentGlyph, PERM_UPPER_ORDER, PERM_LOWER_ORDER, PRIM_UPPER_ORDER, PRIM_LOWER_ORDER } from '../lib/dental'

// ============================================================
// مخطط الأسنان — صفّان أفقيان بأسنان تشريحية (تاج + جذور) فوق شريط لثة،
// ترقيم FDI، ورمز مصوّر لكل حالة علاج. النقر على أي سن يفتح شبكة
// الحالات (كصور المرجع) مع ملاحظة وزر حفظ الحالة، وتحت الشبكة
// تبقى العلاجات المفصّلة بالأسعار المرتبطة بجدول أسعاري.
// ============================================================

// حالات السن الافتراضية — تُربط تلقائياً بعلاج جدول الأسعار إن وُجد (لحساب الثمن)
const STATE_DEFS = [
  { key: 'سليم', glyph: null, treatment: null, color: '#f8fafc' },
  { key: 'تسوس', glyph: 'caries', treatment: 'تسوس', color: '#dc2626' },
  { key: 'حشوة', glyph: 'filling', treatment: 'حشو ضوئي', color: '#2563eb' },
  { key: 'تاج', glyph: 'crown', treatment: 'تلبيسة زيركون', color: '#d4a017' },
  { key: 'جسر', glyph: 'bridge', treatment: 'جسر', color: '#7c3aed', special: 'bridge' },
  { key: 'زرعة', glyph: 'implant', treatment: 'زراعة', color: '#059669' },
  { key: 'مفقود', glyph: 'missing', treatment: 'مفقود', color: '#94a3b8' },
  { key: 'معالج لبّاً', glyph: 'rct', treatment: 'معالجة لبّاً', color: '#f97316' },
  { key: 'كسر', glyph: 'fracture', treatment: 'كسر', color: '#64748b' },
  { key: 'تقويم', glyph: 'ortho', treatment: 'تقويم ثابت', color: '#ec4899' },
  { key: 'فينير', glyph: 'veneer', treatment: 'فينير خزفي', color: '#38bdf8' },
  { key: 'أخرى', glyph: 'other', treatment: 'أخرى', color: '#a78bfa' },
]

const stateByTreatment = new Map(STATE_DEFS.filter((d) => d.treatment).map((d) => [d.treatment, d]))

// نوع السن التشريحي من رقمه — بأحجام نسبية واقعية
function toothKind(no) {
  const n = Number(no)
  const r = n % 10
  if (n >= 50) {
    if (r === 1) return 'central'
    if (r === 2) return 'lateral'
    if (r === 3) return 'canine'
    return 'molar' // الأرحاء اللبنية
  }
  if (r === 1) return 'central'
  if (r === 2) return 'lateral'
  if (r === 3) return 'canine'
  if (r === 4 || r === 5) return 'premolar'
  return 'molar'
}

const KIND_W = { central: 34, lateral: 27, canine: 30, premolar: 37, molar: 48 }

// سنّ تشريحي واقعي (يُرسم جذوره للأسفل — يستدعى داخل مجموعة معكوسة للفك العلوي)
function ToothArt({ no, fill = '#fdf8ef', stroke = '#c9ad7c', options = {} }) {
  const kind = toothKind(no)
  const k = options.scale || 1
  const missing = options.missing
  const st = {
    fill: missing ? 'none' : fill,
    stroke: missing ? '#b6c2cf' : stroke,
    strokeWidth: 1.5,
    strokeDasharray: missing ? '3 2.5' : undefined,
    opacity: missing ? 0.35 : 1,
  }
  // مسارات التاج لكل نوع (حافة الإطباق أعلى، العنق أسفل) — بنسب تشريحية
  const CROWN = {
    central: 'M -17,-16 Q 0,-18 17,-16 C 16.5,-4.5 14,7.5 10.5,15 Q 0,18.5 -10.5,15 C -14,7.5 -16.5,-4.5 -17,-16 Z',
    lateral: 'M -13.5,-15.5 Q 0,-17 13.5,-15.5 C 13,-4.5 11.3,6.8 8.3,14.3 Q 0,17.7 -8.3,14.3 C -11.3,6.8 -13,-4.5 -13.5,-15.5 Z',
    canine: 'M 0,-18 C 5.3,-12.8 14.3,-3 15,3 C 13.5,11.3 9,16.5 0,16.5 C -9,16.5 -13.5,11.3 -15,3 C -14.3,-3 -5.3,-12.8 0,-18 Z',
    premolar:
      'M -18.8,-15.8 Q -18.8,-16.5 -15,-16.5 L -4.5,-15.9 Q 0,-12.9 4.5,-15.9 L 15,-16.5 Q 18.8,-16.5 18.8,-15.8 C 18.5,-4.5 15,8.3 10.5,15 Q 0,18.5 -10.5,15 C -15,8.3 -18.5,-4.5 -18.8,-15.8 Z',
    molar:
      'M -24,-16.5 Q -24,-17.3 -19.5,-17.3 L -10.5,-16.8 Q -6.8,-13 -3,-16.8 L 3,-16.8 Q 6.8,-13 10.5,-16.8 L 19.5,-17.3 Q 24,-17.3 24,-16.5 C 23.6,-4.5 19.5,7.5 15,15.8 Q 0,19.5 -15,15.8 C -19.5,7.5 -23.6,-4.5 -24,-16.5 Z',
  }
  // الجذور لكل نوع (من العنق نحو الأسفل)
  const ROOT = {
    central: 'M -10.5,15.8 Q -8.3,30 -1.2,41 Q 5.7,29.3 9.3,15.8 Z',
    lateral: 'M -8.7,15 Q -6.6,28.5 -0.9,39 Q 4.8,27.8 7.8,15 Z',
    canine: 'M -11.3,15.8 Q -7.2,33 0,46.5 Q 6.6,32.3 10.2,15.8 Z',
    premolar: 'M -9.6,15.3 Q -7.2,28.5 0,40.5 Q 6.3,27.9 8.7,15.3 Z',
  }
  return (
    <g transform={`scale(${k})`} opacity={missing ? 0.35 : 1}>
      {/* الجذور */}
      {kind === 'molar' ? (
        <>
          <path d="M -18.8,16.2 Q -20.3,30 -12.8,39.8 Q -5.1,30 -6,16.2 Z" {...st} />
          <path d="M 18.8,16.2 Q 20.3,30 12.8,39.8 Q 5.1,30 6,16.2 Z" {...st} />
        </>
      ) : (
        <path d={ROOT[kind]} {...st} />
      )}
      {/* التاج */}
      <path d={CROWN[kind]} {...st} />
      {/* تفاصيل الإطباق */}
      {kind === 'molar' && !missing && (
        <g stroke={stroke} strokeWidth={1.2} fill="none" opacity={0.55}>
          <path d="M -7.5,-5.3 Q 0,-9.8 7.5,-5.3" />
          <path d="M -6,2.3 Q 0,0 6,2.3" />
        </g>
      )}
      {kind === 'premolar' && !missing && (
        <path d="M 0,-12.9 L 0,-4.5" stroke={stroke} strokeWidth={1.1} opacity={0.55} />
      )}
      {/* لمعة خفيفة على المينا */}
      {!missing && (
        <path d={`M ${-KIND_W[kind] * 0.3},-${kind === 'molar' ? 8 : 7} Q ${-KIND_W[kind] * 0.08},-${kind === 'molar' ? 11 : 10} ${KIND_W[kind] * 0.18},-${kind === 'molar' ? 8 : 7}`} stroke="#ffffff" strokeWidth={2} fill="none" opacity={0.8} strokeLinecap="round" />
      )}
      {options.overlay}
    </g>
  )
}

// رمز الحالة فوق السنّ — نسخة مصغرة تُستخدم في الدليل وشبكة النافذة
function StateIcon({ def, size = 34, active }) {
  const s = 1
  const gold = def.key === 'تاج' || def.key === 'جسر'
  const overlay = (glyph) => {
    if (!glyph) return null
    switch (glyph) {
      case 'caries':
        return <circle cx={-4.5} cy={-4.5} r={3.2} fill="#431407" />
      case 'filling':
        return <circle cx={0} cy={0} r={3.4} fill="#94a3b8" opacity={0.95} />
      case 'crown':
        return null
      case 'bridge':
        return (
          <g>
            <line x1={-15} y1={-5} x2={15} y2={-5} stroke="#7c3aed" strokeWidth={2.6} />
            <line x1={-15} y1={-1} x2={15} y2={-1} stroke="#7c3aed" strokeWidth={2.6} />
          </g>
        )
      case 'implant':
        return (
          <g stroke="#065f46" strokeWidth={1.8} strokeLinecap="round">
            <line x1={0} y1={11} x2={0} y2={27} />
            <line x1={-3} y1={14} x2={3} y2={16} />
            <line x1={3} y1={19} x2={-3} y2={21} />
            <line x1={-3} y1={23} x2={3} y2={25} />
          </g>
        )
      case 'missing':
        return null
      case 'rct':
        return <line x1={0} y1={10} x2={0} y2={27} stroke="#7c2d12" strokeWidth={2} strokeLinecap="round" />
      case 'fracture':
        return <polyline points={-9 + ',1 ' + -3 + ',-3 ' + 2 + ',2 ' + 9 + ',-2'} fill="none" stroke="#334155" strokeWidth={1.8} strokeLinecap="round" />
      case 'ortho':
        return <rect x={-3.5} y={-3.5} width={7} height={7} rx={1.2} fill="#fdf2f8" stroke="#db2777" strokeWidth={1.4} />
      case 'veneer':
        return <line x1={-9} y1={-9} x2={9} y2={-9} stroke="#38bdf8" strokeWidth={2.6} strokeLinecap="round" />
      case 'other':
        return <circle cx={6} cy={6} r={3} fill="#a78bfa" />
      default:
        return null
    }
  }
  return (
    <svg width={size} height={size * 1.25} viewBox="-16 -16 32 44" aria-hidden="true">
      <ToothArt no={def.glyph === 'implant' ? 14 : 11} fill={gold ? '#f0b429' : '#fdf8ef'} stroke={active ? '#0f766e' : '#c9ad7c'} options={{ overlay: overlay(def.glyph), missing: def.glyph === 'missing', scale: 0.92 }} />
    </svg>
  )
}

const W = 1000
const GAP = 30

export default function DentalChart({ patientId, age, entries, pricebook, onEntriesChange }) {
  const [history, setHistory] = useState([])
  const [activeTooth, setActiveTooth] = useState(null)
  const [hover, setHover] = useState(null)
  const [cat, setCat] = useState('')
  const [notes, setNotes] = useState('')
  const [forcedType, setForcedType] = useState(null) // دائمة / لبنية — يدوياً
  const [bridge, setBridge] = useState(null)

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

  const dentition = useMemo(() => {
    if (forcedType === 'permanent') return { upper: PERM_UPPER_ORDER, lower: PERM_LOWER_ORDER, type: 'permanent' }
    if (forcedType === 'primary') return { upper: PRIM_UPPER_ORDER, lower: PRIM_LOWER_ORDER, type: 'primary' }
    return teethForAge(age)
  }, [age, forcedType])
  const { upper, lower, type } = dentition

  const historyByTooth = useMemo(() => {
    const m = {}
    for (const e of history) if (!m[e.tooth_no]) m[e.tooth_no] = e
    return m
  }, [history])

  const stagedByTooth = useMemo(() => {
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

  // حالة السن الحالية (من إدخالات اليوم ثم من السجل السابق)
  const currentStateKey = (no) => {
    const b = entries.find((e) => e.bridge && (e.span || e.teeth).includes(no))
    if (b) return 'جسر'
    const list = stagedByTooth[no]
    const g = list && list.length ? treatmentGlyph(list[list.length - 1].treatment) : historyByTooth[no] ? treatmentGlyph(historyByTooth[no].procedure) : null
    if (!g) return 'سليم'
    const def = STATE_DEFS.find((d) => d.glyph === g)
    return def ? def.key : 'أخرى'
  }

  const openTooth = (no) => {
    if (bridge && !bridge.to) {
      if (no === bridge.from) return
      setBridge({ ...bridge, to: no })
      return
    }
    setActiveTooth(no)
    setCat('')
    setNotes('')
  }

  const spanFor = (from, to) => {
    const upperSet = [...dentition.upper]
    const lowerSet = [...dentition.lower]
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

  // تطبيق حالة من الشبكة المصوّرة
  const applyState = (def) => {
    if (!activeTooth) return
    if (def.special === 'bridge') {
      setBridge({ from: activeTooth })
      setActiveTooth(null)
      return
    }
    if (!def.treatment) {
      // سليم — إزالة علاجات اليوم من هذا السن
      onEntriesChange(entries.filter((e) => e.tooth_no !== activeTooth))
      setActiveTooth(null)
      return
    }
    const pb = (pricebook || []).find((p) => p.treatment === def.treatment)
    const stateTreatments = new Set(STATE_DEFS.filter((d) => d.treatment).map((d) => d.treatment))
    // الحالة تستبدل الحالة السابقة للسن (وتُبقي العلاجات المفصّلة الأخرى)
    const kept = entries.filter((e) => !(e.tooth_no === activeTooth && stateTreatments.has(e.treatment)))
    onEntriesChange([
      ...kept,
      {
        tooth_no: activeTooth,
        category: pb?.category || 'حالات السن',
        treatment: def.treatment,
        price: Number(pb?.price) || 0,
        color: pb?.color || def.color,
        notes: notes.trim() || null,
      },
    ])
    setActiveTooth(null)
  }

  const removeEntryAt = (index) => onEntriesChange(entries.filter((_, i) => i !== index))
  const removeToothTreatments = () => onEntriesChange(entries.filter((e) => e.tooth_no !== activeTooth))

  const colors = (no) => {
    const b = bridgeFor(no)
    if (b) return { fill: '#f0b429', stroke: '#b45309', isStaged: true }
    const list = stagedByTooth[no]
    const last = list && list.length ? list[list.length - 1] : null
    const t = last ? String(last.treatment || '') : ''
    if (t === 'مفقود') return { fill: '#f8fafc', stroke: '#94a3b8', isStaged: true, missing: true }
    if (t.includes('خلع') || t.includes('قلع')) return { fill: '#e2e8f0', stroke: '#475569', isStaged: true, extracted: true }
    // التاج: يتلون التاج كاملاً بالذهبي مثل المرجع
    if (['تلبيسة', 'تاج', 'طوق'].some((wd) => t.includes(wd))) return { fill: '#f0b429', stroke: '#b45309', isStaged: true }
    // باقي الحالات: يبقى العاج طبيعياً والحالة تظهر برمزها فوق السن
    if (last) return { fill: '#fdf8ef', stroke: '#c9ad7c', isStaged: true }
    if (historyByTooth[no]) return { fill: '#fdf3d7', stroke: '#d9b75a', isStaged: false }
    return { fill: '#fdf8ef', stroke: '#c9ad7c', isStaged: false }
  }

  const isCrown = (no) => {
    const list = stagedByTooth[no]
    const t = list && list.length ? String(list[list.length - 1].treatment) : ''
    return ['تلبيسة', 'تاج', 'فينير', 'طوق'].some((wd) => t.includes(wd))
  }

  // ---- الهندسة: مواضع الأسنان في الصف ----
  const rowGeom = (teeth) => {
    const cellW = Math.min(56, (W - 80 - (teeth.length > 8 ? GAP : 0)) / teeth.length)
    const totalW = teeth.length * cellW + (teeth.length > 8 ? GAP : 0)
    const startX = (W - totalW) / 2
    const pos = (i) => ({
      x: startX + cellW * i + cellW / 2 + (i >= Math.ceil(teeth.length / 2) && teeth.length > 8 ? GAP : 0),
      cellW,
    })
    return { cellW, startX, pos, totalW }
  }

  const gumY = (row) => (row === 'upper' ? { y: 74, h: 30 } : { y: 300, h: 30 })
  const rowCenter = (row) => (row === 'upper' ? 148 : 268)

  const renderRow = (teeth, row) => {
    const { cellW, pos, totalW, startX } = rowGeom(teeth)
    const flip = row === 'lower'
    const s = flip ? 1 : -1
    const cy = rowCenter(row)
    const g = gumY(row)
    const scale = type !== 'permanent' ? 0.85 : 0.95
    return (
      <g key={row}>
        {/* شريط اللثة */}
        <rect x={startX + 4} y={g.y} width={totalW - 8} height={g.h} rx={12} fill="#f8c9d4" opacity={0.85} />
        {/* وصلات الجسور خلف الأسنان */}
        {(entries || [])
          .filter((e) => e.bridge && teeth.includes(e.span[0]))
          .map((b, i) => {
            const i1 = teeth.indexOf(b.span[0])
            const i2 = teeth.indexOf(b.span[b.span.length - 1])
            if (i1 < 0 || i2 < 0) return null
            const p1 = pos(i1)
            const p2 = pos(i2)
            return <line key={'br' + row + i} x1={p1.x} y1={cy} x2={p2.x} y2={cy} stroke="#7c3aed" strokeWidth={10} strokeLinecap="round" opacity={0.85} />
          })}
        {teeth.map((no, i) => {
          const { x } = pos(i)
          const c = colors(no)
          const isActive = activeTooth === no
          const isHover = hover === no
          const list = stagedByTooth[no] || []
          const h = historyByTooth[no]
          const glyph = list && list.length ? treatmentGlyph(list[list.length - 1].treatment) : null
          const stateDef = STATE_DEFS.find((d) => d.glyph === glyph)
          const overlay = (g) => {
            if (!g) return null
            switch (g) {
              case 'caries':
                return <circle cx={-4.5} cy={-4.5 * s} r={3.4} fill="#431407" style={{ pointerEvents: 'none' }} />
              case 'filling':
                return <circle cx={0} cy={0} r={3.8} fill="#94a3b8" opacity={0.95} style={{ pointerEvents: 'none' }} />
              case 'crown':
                return null // التاج يلوّن التاج كاملاً بالذهبي من colors()
              case 'implant':
                return (
                  <g stroke="#065f46" strokeWidth={2} strokeLinecap="round" style={{ pointerEvents: 'none' }}>
                    <line x1={0} y1={11 * s} x2={0} y2={(11 + 16) * s} />
                    <line x1={-3} y1={(14) * s} x2={3} y2={(16) * s} />
                    <line x1={3} y1={(19) * s} x2={-3} y2={(21) * s} />
                  </g>
                )
              case 'rct':
                return <line x1={0} y1={9 * s} x2={0} y2={(11 + 15) * s} stroke="#7c2d12" strokeWidth={2.2} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
              case 'fracture':
                return <polyline points="-9,1 -3,-3 2,2 9,-2" fill="none" stroke="#334155" strokeWidth={1.8} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
              case 'ortho':
                return <rect x={-3.5} y={-3.5} width={7} height={7} rx={1.2} fill="#fdf2f8" stroke="#db2777" strokeWidth={1.4} style={{ pointerEvents: 'none' }} />
              case 'veneer':
                return <line x1={-10} y1={-9 * s} x2={10} y2={-9 * s} stroke="#38bdf8" strokeWidth={2.8} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
              case 'other':
                return <circle cx={6} cy={5 * s} r={3} fill="#a78bfa" style={{ pointerEvents: 'none' }} />
              case 'extraction':
                return (
                  <g stroke="#0f172a" strokeWidth={2.4} strokeLinecap="round" style={{ pointerEvents: 'none' }}>
                    <line x1={-8} y1={-7} x2={8} y2={7} />
                    <line x1={8} y1={-7} x2={-8} y2={7} />
                  </g>
                )
              case 'cleaning':
              case 'whitening':
                return (
                  <g fill="#ffffff" opacity={0.95} style={{ pointerEvents: 'none' }}>
                    <circle cx={-4} cy={-3 * s} r={1.6} />
                    <circle cx={4} cy={2 * s} r={1.6} />
                  </g>
                )
              case 'preventive':
                return (
                  <text x={0} y={3 * s} textAnchor="middle" fontSize={11} fontWeight={800} fill="#16a34a" style={{ pointerEvents: 'none' }}>
                    ✓
                  </text>
                )
              case 'perio':
                return (
                  <g fill="#fb7185" style={{ pointerEvents: 'none' }}>
                    <circle cx={-5} cy={9 * s} r={1.8} />
                    <circle cx={0} cy={10 * s} r={1.8} />
                    <circle cx={5} cy={9 * s} r={1.8} />
                  </g>
                )
              default:
                return null
            }
          }
          return (
            <g
              key={no}
              transform={`translate(${x},${cy})`}
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
              {isActive && <rect x={-cellW / 2 + 2} y={-46 * s} width={cellW - 4} height={92 * s} rx={10} fill="#0d9488" opacity={0.12} />}
              {/* السن — الجذور للاتجاه المناسب */}
              <g transform={`scale(1,${s})`}>
                <ToothArt
                  no={no}
                  s={1}
                  fill={c.fill}
                  stroke={c.stroke}
                  options={{
                    scale: (type === 'permanent' ? 0.98 : 0.8) * (cellW / 56),
                    missing: c.missing,
                    overlay: glyph && !c.missing ? overlay(glyph) : null,
                  }}
                />
              </g>
              {(isHover || isActive) && (
                <rect x={-cellW / 2 + 3} y={-44 * s} width={cellW - 6} height={88 * s} rx={9} fill="none" stroke="#0f766e" strokeWidth={2} strokeDasharray="4 3" />
              )}
              {/* رقم السن — خارج شريط اللثة */}
              <text
                y={flip ? g.y + g.h + 16 : g.y - 10}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={c.isStaged ? '#0f766e' : h ? '#a16207' : '#94a3b8'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {no}
              </text>
              {/* شارة عدد علاجات اليوم */}
              {(list.length || 0) > 1 && (
                <g>
                  <circle cx={cellW / 2 - 4} cy={flip ? -34 : 34} r={8} fill="#0f766e" />
                  <text x={cellW / 2 - 4} y={flip ? -31 : 37} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ffffff" style={{ pointerEvents: 'none' }}>
                    {list.length}
                  </text>
                </g>
              )}
            </g>
          )
        })}
        {/* R / L */}
        <text x={startX - 18} y={cy + 4} textAnchor="middle" fontSize={14} fontWeight={800} fill="#cbd5e1">
          R
        </text>
        <text x={startX + totalW + 18} y={cy + 4} textAnchor="middle" fontSize={14} fontWeight={800} fill="#cbd5e1">
          L
        </text>
      </g>
    )
  }

  const usedTreatments = useMemo(() => {
    const m = new Map()
    for (const e of entries) m.set(e.treatment, e.color)
    return [...m.entries()]
  }, [entries])

  return (
    <div>
      {/* تبويب نوع السنين — مثل المرجع */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-400">{dentitionLabel(type)} — العمر: {age ?? '—'}</p>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
          {[
            { k: null, label: 'حسب العمر' },
            { k: 'permanent', label: 'دائمة' },
            { k: 'primary', label: 'لبنية' },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setForcedType(t.k)}
              className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                forcedType === t.k ? 'bg-primary-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white p-2">
        <svg viewBox={`0 0 ${W} 400`} className="mx-auto block h-auto w-full" role="img" aria-label="مخطط الفكين العلوي والسفلي">
          {renderRow(upper, 'upper')}
          {renderRow(lower, 'lower')}
        </svg>

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

      {/* دليل الحالات المصوّر */}
      <div className="mt-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
        <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-1">
          {STATE_DEFS.map((d) => (
            <span key={d.key} className="inline-flex flex-col items-center">
              <StateIcon def={d} size={22} />
              <span className="text-[9px] font-bold text-slate-500">{d.key}</span>
            </span>
          ))}
        </div>
        {usedTreatments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-50 pt-1.5 text-[10px] font-semibold text-slate-500">
            {usedTreatments.map(([t, c]) => (
              <span key={t} className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded border" style={{ background: c, borderColor: c }} /> {t}
              </span>
            ))}
          </div>
        )}
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
              <button type="button" onClick={() => removeEntryAt(idx)} className="text-rose-500 hover:text-rose-700" aria-label="إزالة">
                إزالة العلاج
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* نافذة السن — شبكة الحالات المصوّرة */}
      <Modal
        open={!!activeTooth}
        onClose={() => setActiveTooth(null)}
        title={`السن ${activeTooth || ''} · ${currentStateKey(activeTooth) || ''}`}
        subtitle={
          bridgeFor(activeTooth)
            ? `جزء من جسر من السن ${bridgeFor(activeTooth).teeth[0]} إلى ${bridgeFor(activeTooth).teeth[1]} — يُزال كوحدة واحدة`
            : (stagedByTooth[activeTooth] || []).length
            ? `علاجات اليوم: ${(stagedByTooth[activeTooth] || []).map((e) => e.treatment).join(' + ')}`
            : historyByTooth[activeTooth]
            ? `عولج سابقاً: ${historyByTooth[activeTooth].procedure}${
                historyByTooth[activeTooth]?.visit?.visit_date ? ` (${formatDateShort(historyByTooth[activeTooth].visit.visit_date)})` : ''
              }`
            : 'اختر حالة السن من الشبكة — أو علاجاً مفصّلاً بالأسعار من الأسفل'
        }
        footer={
          <div className="flex flex-wrap justify-start gap-2">
            {(stagedByTooth[activeTooth] || []).length > 0 && (
              <Button variant="dangerGhost" onClick={removeToothTreatments}>إزالة كل علاجات اليوم من هذا السن</Button>
            )}
            <Button variant="secondary" onClick={() => setActiveTooth(null)}>إنهاء</Button>
          </div>
        }
      >
        {/* شبكة الحالات */}
        <div className="grid grid-cols-4 gap-2">
          {STATE_DEFS.map((d) => {
            const selected = currentStateKey(activeTooth) === d.key
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => applyState(d)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 transition-colors ${
                  selected ? 'border-primary-600 bg-primary-50' : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50/40'
                }`}
              >
                <StateIcon def={d} size={30} active={selected} />
                <span className={`text-[11px] font-bold ${selected ? 'text-primary-800' : 'text-slate-600'}`}>{d.key}</span>
              </button>
            )
          })}
        </div>

        <Field label="ملاحظة على السن" className="mt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const def = STATE_DEFS.find((d) => d.key === (currentStateKey(activeTooth) || 'أخرى'))
                if (def && def.treatment) applyState(def)
              }
            }}
            rows={2}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-primary-500"
            placeholder="ملاحظة على السن… (Enter للحفظ)"
          />
        </Field>

        {/* العلاجات المفصّلة بالأسعار */}
        {categories.length > 0 && (
          <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold text-slate-600">علاجات مفصّلة بالأسعار (من أسعاري)</summary>
            <div className="mt-2">
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
                <Field label="يُضاف للسن ويُحسب سعره على الحساب" className="mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(pricebook || [])
                      .filter((p) => p.category === cat)
                      .map((p, i) => (
                        <button
                          key={(p.treatment || '') + i}
                          type="button"
                          onClick={() => {
                            onEntriesChange([
                              ...entries,
                              {
                                tooth_no: activeTooth,
                                category: p.category,
                                treatment: p.treatment,
                                price: Number(p.price) || 0,
                                color: p.color || '#0d9488',
                                notes: notes.trim() || null,
                              },
                            ])
                            setNotes('')
                          }}
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
            </div>
          </details>
        )}
        {categories.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            لا توجد أسعار محفوظة — أضف فئات وعلاجات من صفحة «أسعاري» لتظهر هنا مع الحساب التلقائي
          </p>
        )}

        {/* علاجات اليوم على هذا السن */}
        {(stagedByTooth[activeTooth] || []).length > 0 && (
          <ul className="mt-3 space-y-1.5">
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
      </Modal>
    </div>
  )
}
