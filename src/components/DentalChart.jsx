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

// السنّ في الفك العلوي؟ (رحى عليا لها ٣ جذور، سفلية جذران)
const isUpperTooth = (no) => {
  const n = Number(no)
  return (n >= 10 && n < 30) || (n >= 50 && n < 60)
}

// ---- تيجان بحدود ومكامن إطباق حقيقية ----
const CROWN = {
  central:
    'M -16.5,-17.6 Q 0,-19.4 16.5,-17.6 C 16.2,-9.5 15,2 12.6,11.5 C 9.5,15.4 4.6,17.8 0,17.8 C -4.6,17.8 -9.5,15.4 -12.6,11.5 C -15,2 -16.2,-9.5 -16.5,-17.6 Z',
  lateral:
    'M -13,-16.9 Q 0,-18.6 13,-16.9 C 12.7,-9 11.6,1.6 9.4,10.6 C 7.1,14.2 3.6,16.4 0,16.4 C -3.6,16.4 -7.1,14.2 -9.4,10.6 C -11.6,1.6 -12.7,-9 -13,-16.9 Z',
  canine:
    'M 0,-21.5 C 6.2,-14.4 13.6,-4.6 14.4,3.4 C 13.4,12 8.8,18.2 0,18.2 C -8.8,18.2 -13.4,12 -14.4,3.4 C -13.6,-4.6 -6.2,-14.4 0,-21.5 Z',
  premolar:
    'M -18.6,-16.4 Q -18.6,-17.4 -14.6,-17.4 L -8.4,-16.6 Q -4.4,-12.6 0,-13.2 Q 4.4,-12.6 8.4,-16.6 L 14.6,-17.4 Q 18.6,-17.4 18.6,-16.4 C 18.2,-6 15.2,7.6 11,14.4 C 7.6,17.8 3.8,19.2 0,19.2 C -3.8,19.2 -7.6,17.8 -11,14.4 C -15.2,7.6 -18.2,-6 -18.6,-16.4 Z',
  molar:
    'M -23.6,-17.4 Q -23.6,-18.4 -18.6,-18.4 L -11.6,-17.8 Q -7.6,-13.4 -3.4,-17.8 L 3.4,-17.8 Q 7.6,-13.4 11.6,-17.8 L 18.6,-18.4 Q 23.6,-18.4 23.6,-17.4 C 23.2,-6.4 19.4,7.6 14.6,15.2 C 10,18.6 4.8,19.8 0,19.8 C -4.8,19.8 -10,18.6 -14.6,15.2 C -19.4,7.6 -23.2,-6.4 -23.6,-17.4 Z',
}

// ---- جذور بعددها التشريحي الحقيقي ----
const ROOTS = {
  central: ['M -9.6,16.6 Q -8.2,31 -2.6,43.5 Q 5.2,30.4 8.4,16.6 Z'],
  lateral: ['M -7.8,15.2 Q -6.6,28.6 -1.6,39.8 Q 5,28 7,15.2 Z'],
  canine: ['M -11,16.8 Q -7.6,34 0,49 Q 7.2,33.2 10.2,16.8 Z'],
  premolar: [
    'M -10.4,16.4 Q -8.6,30 -2.8,43 Q 3.2,29.6 6,16.4 Z',
    'M -6,16.2 Q -4,27 1.4,36.5 Q 6.4,27.2 8.4,16.2 Z',
  ],
  molarUpper: [
    'M -18.4,16.6 Q -20.6,32 -14.6,44 Q -7.4,32 -8.4,16.6 Z',
    'M 18.4,16.6 Q 20.6,32 14.6,44 Q 7.4,32 8.4,16.6 Z',
    'M -7.6,17 Q -6.4,30 0,41.5 Q 6.4,30 7.6,17 Z',
  ],
  molarLower: [
    'M -10.6,16.4 Q -9,31 -3.6,42.5 Q 2.6,30.8 3.4,16.4 Z',
    'M -3.2,16.2 Q -1.2,29 3.4,39.5 Q 9.4,29.6 10,16.2 Z',
  ],
}

function rootsFor(no) {
  const kind = toothKind(no)
  if (kind === 'molar') return isUpperTooth(no) ? ROOTS.molarUpper : ROOTS.molarLower
  return ROOTS[kind]
}

// تفاصيل سطح الإطباق: حدبات وشقوق حقيقية لكل نوع
function OcclusalDetail({ kind, stroke }) {
  const s = { stroke, strokeWidth: 1.15, fill: 'none', opacity: 0.5, strokeLinecap: 'round' }
  if (kind === 'central' || kind === 'lateral') return <path d="M 0,-14.5 L 0,9" {...s} />
  if (kind === 'canine') return <path d="M 0,-17 L 0,13" {...s} />
  if (kind === 'premolar') {
    return (
      <g {...s}>
        <path d="M -8.5,-8 Q 0,-11 8.5,-8" />
        <path d="M 0,-11 L 0,13" />
      </g>
    )
  }
  return (
    <g {...s}>
      <path d="M -13,-4 Q -8,-9 -2,-8 Q 2,-11 8,-8.5 Q 13,-5.5 13,1 Q 8,-3 2,-1 Q -2,-4 -8,-1.5 Q -13,0 -13,-4 Z" />
      <path d="M -6,-6 L -6,6" />
      <path d="M 6,-6 L 6,6" />
    </g>
  )
}

// سنّ تشريحي واقعي (يُرسم جذوره للأسفل — يُستدعى داخل مجموعة معكوسة للفك العلوي)
function ToothArt({ no, fill = '#fdf8ef', stroke = '#c9ad7c', options = {} }) {
  const kind = toothKind(no)
  const k = options.scale || 1
  const missing = options.missing
  const st = {
    fill: missing ? 'none' : fill,
    stroke: missing ? '#b6c2cf' : stroke,
    strokeWidth: 1.4,
    strokeDasharray: missing ? '3 2.5' : undefined,
    opacity: missing ? 0.35 : 1,
  }
  const roots = rootsFor(no)
  const crownD = CROWN[kind]
  const gid = 'en-' + no + '-' + Math.round(k * 1000)
  // خطّ العنق (أعلى منطقة اللثة) يتبع عرض التاج
  const neck =
    kind === 'molar'
      ? 'M -22.4,15 Q -11,18.6 0,18.6 Q 11,18.6 22.4,15'
      : kind === 'canine'
      ? 'M -14.2,15.6 Q -7,18.2 0,18.2 Q 7,18.2 14.2,15.6'
      : kind === 'premolar'
      ? 'M -17.8,14.4 Q -9,17.8 0,17.8 Q 9,17.8 17.8,14.4'
      : 'M -15.4,14.4 Q -8,17.6 0,17.6 Q 8,17.6 15.4,14.4'
  return (
    <g transform={'scale(' + k + ')'} opacity={missing ? 0.35 : 1}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.8} />
          <stop offset="30%" stopColor="#ffffff" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* الجذور */}
      {roots.map((d, i) => (
        <path key={i} d={d} {...st} />
      ))}
      {/* التاج */}
      <path d={crownD} {...st} />
      {/* حدبات وشقوق الإطباق */}
      {!missing && <OcclusalDetail kind={kind} stroke={stroke} />}
      {/* لمعة المينا + تدرّج لون المينا */}
      {!missing && <path d={crownD} fill={'url(#' + gid + ')'} stroke="none" style={{ pointerEvents: 'none' }} />}
      {/* خطّ العنق عند اللثة */}
      {!missing && <path d={neck} fill="none" stroke={stroke} strokeWidth={1.1} opacity={0.45} />}
      {options.overlay}
    </g>
  )
}

// أشكال واقعية لكل علاج — تُرسم فوق السن بمقاييسه الحقيقية (s = اتجاه الفك، no = رقم السن)
function treatmentOverlay(g, s, no) {
  if (!g) return null
              switch (g) {
                case 'caries':
                  // تجويف تسوّس غير منتظم بلون بني غامق مع حدّ داكن
                  return (
                    <path
                      d="M -6.2,-6.6 Q -2.4,-9.2 1.4,-7.6 Q 6,-8.4 7.2,-3.4 Q 8.6,1.6 3.2,3.6 Q -2.4,6.2 -6,2.6 Q -9.4,-1.2 -6.2,-6.6 Z"
                      transform={`scale(1,${s}) translate(0,${-4 * s})`}
                      fill="#3f1006"
                      stroke="#1c0703"
                      strokeWidth={0.7}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                case 'filling':
                  // حشوة كومبوزيت/أملغم غير منت几何 على سطح الإطباق
                  return (
                    <g transform={`scale(1,${s})`} style={{ pointerEvents: 'none' }}>
                      <path
                        d="M -7.4,-6.4 Q -1,-9.6 5,-6.2 Q 8.8,-2.6 5.2,1.8 Q 0.4,5.4 -4.6,3.2 Q -9.4,0.2 -7.4,-6.4 Z"
                        fill="#cbd5e1"
                        stroke="#64748b"
                        strokeWidth={0.9}
                      />
                      <path d="M -4.6,-4.4 Q 0,-6 3.4,-3.6" fill="none" stroke="#ffffff" strokeWidth={1.1} opacity={0.85} />
                    </g>
                  )
                case 'crown':
                  // حدّ تاج عند العنق (التاج نفسه ملوّن بالكامل من colors())
                  return (
                    <path
                      d="M -17.4,13.4 Q -9,17.4 0,17.4 Q 9,17.4 17.4,13.4"
                      transform={`scale(1,${s})`}
                      fill="none"
                      stroke="#b45309"
                      strokeWidth={1.6}
                      opacity={0.9}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                case 'implant':
                  // زراعة: برغي حلزوني بلفات حقيقية في موضع الجذر
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <path
                        d={`M -4.4,${16 * s} L 4.4,${16 * s} L 3,${40 * s} L -3,${40 * s} Z`}
                        transform={`scale(1,${s})`}
                        fill="#e2e8f0"
                        stroke="#0f766e"
                        strokeWidth={1.3}
                      />
                      {[20, 24.5, 29, 33.5, 38].map((y, i) => (
                        <line
                          key={i}
                          x1={i % 2 ? -3.4 : -3}
                          y1={y * s}
                          x2={i % 2 ? 3 : 3.4}
                          y2={(y + 2.4) * s}
                          stroke="#0f766e"
                          strokeWidth={1.1}
                          strokeLinecap="round"
                        />
                      ))}
                      <ellipse cx={0} cy={16.6 * s} rx={4.6} ry={2.2 * s} fill="#f1f5f9" stroke="#0f766e" strokeWidth={1.2} />
                    </g>
                  )
                case 'rct':
                  // معالجة لبّ: قنوات الجذور (خط لكل جذر)
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      {rootsFor(no).length <= 2 ? (
                        rootsFor(no).map((_, i) => (
                          <line
                            key={i}
                            x1={rootsFor(no).length === 2 ? (i === 0 ? -4 : 4.5) : 0}
                            y1={10 * s}
                            x2={rootsFor(no).length === 2 ? (i === 0 ? -4 : 4.5) : 0}
                            y2={32 * s}
                            stroke="#b91c1c"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                          />
                        ))
                      ) : (
                        [-6, 0, 6.5].map((x, i) => (
                          <line key={i} x1={x} y1={10 * s} x2={x} y2={i === 1 ? 30 : 28} stroke="#b91c1c" strokeWidth={1.4} strokeLinecap="round" />
                        ))
                      )}
                    </g>
                  )
                case 'fracture':
                  // كسر: شقّ متعرّج يعبر التاج
                  return (
                    <polyline
                      points="-10,8 -6,-2 -2,4 1,-8 5,3 9,-5"
                      transform={`scale(1,${s})`}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth={1.9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                case 'ortho':
                  // تقويم: bracket + سلك يربط الأسنان
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={-4.4} y={-4.4 * s} width={8.8} height={8.8 * s} rx={1.4} fill="#fdf2f8" stroke="#db2777" strokeWidth={1.5} />
                      <line x1={-5.6} y1={-0.6 * s} x2={5.6} y2={-0.6 * s} stroke="#be185d" strokeWidth={0.9} />
                    </g>
                  )
                case 'veneer':
                  // فينير: طبقة رقيقة على السطح الأمامي
                  return (
                    <path
                      d="M -14,-14.6 Q 0,-16.6 14,-14.6 Q 13,-2 0,0.6 Q -13,-2 -14,-14.6 Z"
                      transform={`scale(1,${s})`}
                      fill="#bae6fd"
                      opacity={0.85}
                      stroke="#0284c7"
                      strokeWidth={0.8}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                case 'other':
                  return <circle cx={6} cy={5 * s} r={3} fill="#a78bfa" style={{ pointerEvents: 'none' }} />
                case 'extraction':
                  // خلع: علامة X فوق السنّ المتضاءل
                  return (
                    <g stroke="#0f172a" strokeWidth={2.6} strokeLinecap="round" style={{ pointerEvents: 'none' }}>
                      <line x1={-9} y1={-9 * s} x2={9} y2={9 * s} />
                      <line x1={9} y1={-9 * s} x2={-9} y2={9 * s} />
                    </g>
                  )
                case 'cleaning':
                case 'whitening':
                  return (
                    <g fill="#ffffff" opacity={0.95} style={{ pointerEvents: 'none' }}>
                      <path d="M 0,-11 L 1.8,-6.4 L 6.6,-5.4 L 3,-1.8 L 4,2.8 L 0,0.6 L -4,2.8 L -3,-1.8 L -6.6,-5.4 L -1.8,-6.4 Z" transform={`scale(1,${s}) translate(0,${-4 * s})`} />
                      <circle cx={-7} cy={-7 * s} r={1.3} />
                      <circle cx={7} cy={-7 * s} r={1.3} />
                    </g>
                  )
                case 'preventive':
                  return (
                    <text x={0} y={4 * s} textAnchor="middle" fontSize={12} fontWeight={800} fill="#16a34a" style={{ pointerEvents: 'none' }}>
                      ✓
                    </text>
                  )
                case 'perio':
                  // التهاب لثة: نقاط حمرة على خطّ اللثة
                  return (
                    <g fill="#e11d48" style={{ pointerEvents: 'none' }}>
                      {[-8, -2.5, 3, 8.5].map((x, i) => (
                        <circle key={i} cx={x} cy={(14 + (i % 2 ? 1.4 : 0)) * s} r={1.9} />
                      ))}
                    </g>
                  )
                default:
                  return null
              }
}

// رمز الحالة فوق السنّ — نسخة مصغرة تُستخدم في الدليل وشبكة النافذة
function StateIcon({ def, size = 34, active }) {
  const s = 1
  const gold = def.key === 'تاج' || def.key === 'جسر'
  const overlay = (glyph) => treatmentOverlay(glyph, 1, 11)
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
          const overlay = (g) => treatmentOverlay(g, s, no)
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
