import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, Field, Modal, Textarea } from './ui'
import { formatDateShort } from '../lib/format'
import { obgynRegionLabel, OBGYN_DEFAULT_CATALOG } from '../lib/obgyn'
import { fmtPrice } from '../lib/dental'
import SketchCanvas from './SketchCanvas'

/**
 * مخطط النساء والتوليد — رسم تشريحي قابل للنقر مع طبقة رسم حرّ فوقه:
 *   تبويب «الرحم والحوض»: الرحم، عنق الرحم، المهبل، القنوات الناقلة، المبايض، المثانة، المستقيم
 *   تبويب «الثديان»: أرباع الثدي والحلمتين والإبطين
 *   تبويب «رسم حرّ»: مساحة فارغة للرسم اليدوي أثناء الكشف
 *
 * props:
 *  - patientId   : لجلب نتائج الزيارات السابقة
 *  - findings    : نتائج هذه الزيارة [{region, note, color, category, treatment, price}]
 *  - onFindingsChange(next)
 *  - pricebook   : [{category, treatment, price, color}]  — اختياري
 *  - sketch      : رابط صورة الرسم اليدوي المحفوظ
 *  - onSketchChange(dataURL|null)
 *  - tab         : التبويب المفتوح ('pelvis' | 'breast' | 'free')
 *  - onTabChange(next)
 */
export default function ObgynChart({
  patientId,
  findings = [],
  onFindingsChange,
  pricebook,
  sketch = null,
  onSketchChange,
  tab = 'pelvis',
  onTabChange,
}) {
  const [history, setHistory] = useState([])
  const [active, setActive] = useState(null) // المنطقة المفتوحة
  const [note, setNote] = useState('')
  const [catalog, setCatalog] = useState(OBGYN_DEFAULT_CATALOG)

  /* سجل الزيارات السابقة — لمتابعة ما شُخّص سابقاً في كل منطقة */
  useEffect(() => {
    if (!patientId) return
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('visits')
        .select('visit_date, specialty_data')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .limit(60)
      if (!alive) return
      const list = []
      for (const v of data || []) {
        const arr = v.specialty_data?.findings
        if (Array.isArray(arr)) for (const f of arr) list.push({ ...f, visit_date: v.visit_date })
      }
      setHistory(list)
    })()
    return () => {
      alive = false
    }
  }, [patientId])

  /* كتالوج الفحوصات — من أسعار العيادة إن وُجد، وإلا الافتراضي */
  useEffect(() => {
    if (Array.isArray(pricebook) && pricebook.length) {
      const groups = []
      for (const p of pricebook) {
        let g = groups.find((x) => x.category === p.category)
        if (!g) {
          g = { category: p.category, items: [] }
          groups.push(g)
        }
        g.items.push({ treatment: p.treatment, price: p.price, color: p.color })
      }
      setCatalog(groups)
    }
  }, [pricebook])

  const historyByRegion = useMemo(() => {
    const m = {}
    for (const h of history) {
      if (!m[h.region]) m[h.region] = h
    }
    return m
  }, [history])

  const stagedByRegion = useMemo(() => {
    const m = {}
    for (const f of findings) {
      m[f.region] = m[f.region] || []
      m[f.region].push(f)
    }
    return m
  }, [findings])

  const regionState = (id) => {
    const list = stagedByRegion[id] || []
    if (list.length) return { fill: list[list.length - 1].color, staged: true, count: list.length }
    if (historyByRegion[id]) return { fill: '#fde68a', staged: false, count: 0 }
    return { fill: '#f1f5f9', staged: false, count: 0 }
  }

  const openRegion = (region) => {
    setActive(region)
    setNote('')
  }

  const applyFinding = (item) => {
    if (!active) return
    onFindingsChange?.([
      ...findings,
      {
        region: active,
        note: note.trim() || null,
        category: item.category,
        treatment: item.treatment,
        price: Number(item.price) || 0,
        color: item.color || 'var(--p600)',
      },
    ])
    setNote('')
  }

  const removeFindingAt = (idx) => onFindingsChange?.(findings.filter((_, i) => i !== idx))

  /* ---------------- العناصر الرسومية ---------------- */

  /** منطقة قابلة للنقر — تُلوّن حسب نتيجة اليوم أو نتيجة سابقة */
  const Region = ({ id, children, label, cx, cy, labelDy = 16 }) => {
    const st = regionState(id)
    const isActive = active === id
    const prev = historyByRegion[id]
    const count = st.count
    return (
      <g onClick={() => openRegion(id)} style={{ cursor: 'pointer' }} data-region={id} role="button" aria-label={obgynRegionLabel(id)}>
        <title>
          {`${obgynRegionLabel(id)}${count ? ' — اليوم: ' + (stagedByRegion[id] || []).map((f) => f.treatment || f.note).join(' + ') : ''}${
            prev && !count ? ' — سابقاً: ' + (prev.treatment || prev.note || '') : ''
          }`}
        </title>
        {children(st.fill, isActive, st.staged)}
        {count > 1 && (
          <>
            <circle cx={cx} cy={cy} r={8} fill="var(--p800)" />
            <text x={cx} y={cy + 3.4} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff" style={{ pointerEvents: 'none' }}>
              {count}
            </text>
          </>
        )}
        {label && (
          <text
            x={cx}
            y={cy + labelDy}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill={st.staged ? st.fill : prev ? '#a16207' : '#64748b'}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {label}
          </text>
        )}
        {isActive && (
          <circle cx={cx} cy={cy} r={13} fill="none" stroke="var(--p700)" strokeWidth={2} strokeDasharray="3 3" style={{ pointerEvents: 'none' }} />
        )}
      </g>
    )
  }

  /** الرسم التشريحي — الرحم والحوض (منظر أمامي) */
  const PelvisDiagram = () => (
    <g>
      {/* حد البطن */}
      <path
        d="M 150 330 Q 130 210 200 120 Q 250 60 360 60 Q 470 60 520 120 Q 590 210 570 330 Q 470 400 360 400 Q 250 400 150 330 Z"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth={1.5}
      />

      {/* المثانة */}
      <Region id="bladder" cx={360} cy={112} label="المثانة" labelDy={-22}>
        {(fill, isActive) => (
          <ellipse
            cx={360}
            cy={112}
            rx={44}
            ry={30}
            fill={fill}
            fillOpacity={0.9}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.6 : 1.5}
          />
        )}
      </Region>

      {/* المستقيم — خلف الرحم */}
      <Region id="rectum" cx={520} cy={250}>
        {(fill) => (
          <path
            d="M 520 150 Q 552 210 540 270 Q 530 320 505 345"
            fill="none"
            stroke={fill}
            strokeWidth={26}
            strokeLinecap="round"
            strokeOpacity={0.9}
            style={{ pointerEvents: 'stroke' }}
          />
        )}
      </Region>
      <text x={520} y={378} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" style={{ pointerEvents: 'none' }}>
        المستقيم
      </text>

      {/* القنوات الناقلة */}
      <Region id="tube_right" cx={248} cy={168}>
        {(fill) => (
          <path
            d="M 318 176 Q 275 150 232 166"
            fill="none"
            stroke={fill}
            strokeWidth={13}
            strokeLinecap="round"
            style={{ pointerEvents: 'stroke' }}
          />
        )}
      </Region>
      <text x={248} y={140} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" style={{ pointerEvents: 'none' }}>
        القناة الناقلة (يمين)
      </text>

      <Region id="tube_left" cx={472} cy={168}>
        {(fill) => (
          <path
            d="M 402 176 Q 445 150 488 166"
            fill="none"
            stroke={fill}
            strokeWidth={13}
            strokeLinecap="round"
            style={{ pointerEvents: 'stroke' }}
          />
        )}
      </Region>
      <text x={472} y={140} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" style={{ pointerEvents: 'none' }}>
        القناة الناقلة (يسار)
      </text>

      {/* المبايض */}
      <Region id="ovary_right" cx={205} cy={180} label="المبيض (يمين)" labelDy={22}>
        {(fill, isActive) => (
          <ellipse
            cx={205}
            cy={172}
            rx={26}
            ry={16}
            fill={fill}
            fillOpacity={0.92}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.6 : 1.5}
          />
        )}
      </Region>
      <Region id="ovary_left" cx={515} cy={180} label="المبيض (يسار)" labelDy={22}>
        {(fill, isActive) => (
          <ellipse
            cx={515}
            cy={172}
            rx={26}
            ry={16}
            fill={fill}
            fillOpacity={0.92}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.6 : 1.5}
          />
        )}
      </Region>

      {/* جسم الرحم */}
      <Region id="uterus_body" cx={360} cy={225}>
        {(fill, isActive) => (
          <path
            d="M 296 196 Q 296 162 330 150 Q 360 138 390 150 Q 424 162 424 196 Q 424 236 392 266 L 328 266 Q 296 236 296 196 Z"
            fill={fill}
            fillOpacity={0.9}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.8 : 1.6}
          />
        )}
      </Region>
      <text x={360} y={288} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" style={{ pointerEvents: 'none' }}>
        جسم الرحم
      </text>

      {/* قاع الرحم */}
      <Region id="uterus_fundus" cx={360} cy={165}>
        {(fill, isActive) => (
          <path
            d="M 296 196 Q 296 162 330 150 Q 360 138 390 150 Q 424 162 424 196 Q 396 176 360 176 Q 324 176 296 196 Z"
            fill={fill}
            fillOpacity={0.95}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.4 : 1.2}
          />
        )}
      </Region>
      <text x={360} y={132} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" style={{ pointerEvents: 'none' }}>
        قاع الرحم
      </text>

      {/* بطانة الرحم */}
      <Region id="endometrium" cx={360} cy={215}>
        {(fill, isActive) => (
          <path
            d="M 326 200 Q 360 182 394 200 Q 392 232 374 256 L 346 256 Q 328 232 326 200 Z"
            fill={fill}
            fillOpacity={0.75}
            stroke={isActive ? 'var(--p700)' : '#a78bfa'}
            strokeWidth={isActive ? 2.2 : 1.2}
          />
        )}
      </Region>
      <text x={360} y={222} textAnchor="middle" fontSize={9} fontWeight={700} fill="#7c3aed" style={{ pointerEvents: 'none' }}>
        بطانة الرحم
      </text>

      {/* عنق الرحم */}
      <Region id="cervix" cx={360} cy={285}>
        {(fill, isActive) => (
          <path
            d="M 332 264 L 388 264 L 380 300 Q 360 312 340 300 Z"
            fill={fill}
            fillOpacity={0.9}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.6 : 1.6}
          />
        )}
      </Region>
      <text x={360} y={338} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" style={{ pointerEvents: 'none' }}>
        عنق الرحم
      </text>

      {/* المهبل */}
      <Region id="vagina" cx={360} cy={330}>
        {(fill, isActive) => (
          <path
            d="M 342 308 L 378 308 L 372 356 Q 360 366 348 356 Z"
            fill={fill}
            fillOpacity={0.9}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.6 : 1.6}
          />
        )}
      </Region>
      <text x={360} y={392} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" style={{ pointerEvents: 'none' }}>
        المهبل
      </text>

      {/* المدخل */}
      <Region id="vulva" cx={360} cy={378}>
        {(fill, isActive) => (
          <path
            d="M 344 364 L 376 364 L 368 388 Q 360 396 352 388 Z"
            fill={fill}
            fillOpacity={0.9}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.6 : 1.6}
          />
        )}
      </Region>

      {/* ارتفاع قاع الرحم */}
      <Region id="pelvis_abdomen" cx={245} cy={310}>
        {(fill, isActive) => (
          <rect
            x={222}
            y={285}
            width={46}
            height={50}
            rx={10}
            fill={fill}
            fillOpacity={0.85}
            stroke={isActive ? 'var(--p700)' : '#94a3b8'}
            strokeWidth={isActive ? 2.4 : 1.4}
          />
        )}
      </Region>
      <text x={245} y={352} textAnchor="middle" fontSize={9} fill="#64748b" style={{ pointerEvents: 'none' }}>
        ارتفاع قاع الرحم
      </text>
    </g>
  )

  /** الرسم التشريحي — الثديان (رباع + حلمتان + إبطان) */
  const quadrantPath = (cx, cy, r, sx, sy) => {
    const x1 = cx + sx * r
    const y1 = cy + sy * r
    const sweep = sx * sy > 0 ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${cy} A ${r} ${r} 0 0 ${sweep} ${cx} ${y1} Z`
  }

  const BreastDiagram = () => {
    const breasts = [
      { side: 'right', cx: 250, outer: -1 }, // ثدي المريضة الأيمن على يسار الصورة
      { side: 'left', cx: 470, outer: 1 },
    ]
    const r = 78
    return (
      <g>
        {/* القفص الصدري */}
        <path
          d="M 150 210 Q 240 120 360 120 Q 480 120 570 210 Q 480 300 360 300 Q 240 300 150 210 Z"
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth={1.5}
        />
        {breasts.map((b) => {
          const outer = b.outer
          const inner = -outer
          return (
            <g key={b.side}>
              <ellipse cx={b.cx} cy={210} rx={r} ry={92} fill="#fdf2f8" stroke="#f9a8d4" strokeWidth={1.4} />

              <Region id={`breast_outer_upper_${b.side}`} cx={b.cx + outer * 40} cy={168} label="علوي خارجي" labelDy={-16}>
                {(fill, isActive) => (
                  <path d={quadrantPath(b.cx, 210, r - 2, outer, -1)} fill={fill} fillOpacity={0.9} stroke={isActive ? 'var(--p700)' : '#f9a8d4'} strokeWidth={isActive ? 2.2 : 1} />
                )}
              </Region>
              <Region id={`breast_inner_upper_${b.side}`} cx={b.cx + inner * 40} cy={168} label="علوي داخلي" labelDy={-16}>
                {(fill, isActive) => (
                  <path d={quadrantPath(b.cx, 210, r - 2, inner, -1)} fill={fill} fillOpacity={0.9} stroke={isActive ? 'var(--p700)' : '#f9a8d4'} strokeWidth={isActive ? 2.2 : 1} />
                )}
              </Region>
              <Region id={`breast_outer_lower_${b.side}`} cx={b.cx + outer * 40} cy={254} label="سفلي خارجي" labelDy={22}>
                {(fill, isActive) => (
                  <path d={quadrantPath(b.cx, 210, r - 2, outer, 1)} fill={fill} fillOpacity={0.9} stroke={isActive ? 'var(--p700)' : '#f9a8d4'} strokeWidth={isActive ? 2.2 : 1} />
                )}
              </Region>
              <Region id={`breast_inner_lower_${b.side}`} cx={b.cx + inner * 40} cy={254} label="سفلي داخلي" labelDy={22}>
                {(fill, isActive) => (
                  <path d={quadrantPath(b.cx, 210, r - 2, inner, 1)} fill={fill} fillOpacity={0.9} stroke={isActive ? 'var(--p700)' : '#f9a8d4'} strokeWidth={isActive ? 2.2 : 1} />
                )}
              </Region>

              {/* الحلمة */}
              <Region id={`breast_nipple_${b.side}`} cx={b.cx} cy={210} label="الحلمة" labelDy={36}>
                {(fill, isActive) => (
                  <circle cx={b.cx} cy={210} r={17} fill={fill} fillOpacity={0.95} stroke={isActive ? 'var(--p700)' : '#f472b6'} strokeWidth={isActive ? 2.4 : 1.4} />
                )}
              </Region>

              {/* الإبط */}
              <Region id={`breast_axilla_${b.side}`} cx={b.cx + outer * 108} cy={140} label="الإبط" labelDy={-16}>
                {(fill, isActive) => (
                  <ellipse cx={b.cx + outer * 108} cy={140} rx={24} ry={16} fill={fill} fillOpacity={0.9} stroke={isActive ? 'var(--p700)' : '#94a3b8'} strokeWidth={isActive ? 2.2 : 1.4} />
                )}
              </Region>
            </g>
          )
        })}
        <text x={250} y={336} textAnchor="middle" fontSize={11} fontWeight={800} fill="#64748b" style={{ pointerEvents: 'none' }}>
          الثدي الأيمن
        </text>
        <text x={470} y={336} textAnchor="middle" fontSize={11} fontWeight={800} fill="#64748b" style={{ pointerEvents: 'none' }}>
          الثدي الأيسر
        </text>
      </g>
    )
  }

  const TABS = [
    { key: 'pelvis', label: 'الرحم والحوض' },
    { key: 'breast', label: 'الثديان' },
    { key: 'free', label: 'رسم حرّ' },
  ]

  return (
    <div>
      {/* التبويبات */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange?.(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              tab === t.key
                ? 'bg-primary-700 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* الرسم التشريحي + طبقة الرسم اليدوي */}
      {tab !== 'free' && (
        <div className="relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-b from-primary-50/50 to-white p-2">
          <p className="mb-1 text-center text-[11px] font-bold text-slate-400">
            اضغط على أي منطقة لتسجيل النتيجة — ويمكن الرسم فوق المخطط بالطبقة البيضاء
          </p>
          <div className="relative">
            <svg
              viewBox={tab === 'pelvis' ? '0 0 720 440' : '0 0 720 360'}
              className="mx-auto block h-auto w-full"
              role="img"
              aria-label="مخطط تشريحي للنساء والتوليد"
            >
              {tab === 'pelvis' ? <PelvisDiagram /> : <BreastDiagram />}
            </svg>
            {/* طبقة الرسم اليدوي فوق الرسم التشريحي */}
            <SketchOverlay sketch={sketch} onSketchChange={onSketchChange} />
          </div>
        </div>
      )}

      {/* التبويب الحر — مساحة رسم كاملة */}
      {tab === 'free' && (
        <div className="ob-sketch-wrap p-2">
          <SketchCanvas
            value={sketch}
            onChange={onSketchChange}
            height={330}
            transparent={false}
          />
        </div>
      )}

      {/* دليل الألوان */}
      <div className="mt-2 rounded-xl border border-slate-100 bg-white px-3 py-2">
        <p className="mb-1 text-[10px] font-bold text-slate-400">دليل الألوان</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-slate-300 bg-slate-100" /> سليم
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-amber-300 bg-amber-100" /> نتيجة سابقة
          </span>
          {Array.from(new Set(findings.map((f) => f.color))).map((c) => (
            <span key={c} className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border" style={{ background: c, borderColor: c }} /> اليوم
            </span>
          ))}
        </div>
      </div>

      {/* نتائج هذه الزيارة */}
      {findings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {findings.map((f, idx) => (
            <li key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 font-bold text-primary-900">
                <span className="inline-block h-3 w-3 shrink-0 rounded border" style={{ background: f.color, borderColor: f.color }} />
                <span className="truncate">
                  {obgynRegionLabel(f.region)}
                  {f.treatment ? ` — ${f.treatment}` : ''}
                  {f.note ? <span className="font-medium text-slate-500"> · {f.note}</span> : null}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {f.price ? <span className="text-[10px] font-bold text-slate-500">{fmtPrice(f.price)}</span> : null}
                <button type="button" onClick={() => removeFindingAt(idx)} className="text-rose-500 hover:text-rose-700" aria-label="إزالة">
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* نافذة تسجيل النتيجة على منطقة */}
      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? obgynRegionLabel(active) : ''}
        subtitle={
          active && (stagedByRegion[active] || []).length
            ? `نتائج اليوم: ${(stagedByRegion[active] || []).map((f) => f.treatment || f.note).join(' + ')}`
            : active && historyByRegion[active]
              ? `نتيجة سابقة: ${historyByRegion[active].treatment || historyByRegion[active].note || ''}${
                  historyByRegion[active].visit_date ? ` (${formatDateShort(historyByRegion[active].visit_date)})` : ''
                }`
              : 'اختر الفحص أو التشخيص ثم أضف ملاحظتك'
        }
        footer={
          <div className="flex justify-start gap-2">
            <Button variant="secondary" onClick={() => setActive(null)}>
              إغلاق
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {catalog.map((g) => (
            <div key={g.category}>
              <p className="mb-1.5 text-[11px] font-bold text-slate-500">{g.category}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((item, i) => (
                  <button
                    key={(item.treatment || '') + i}
                    type="button"
                    onClick={() => applyFinding({ ...item, category: g.category })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-primary-400 hover:bg-primary-50"
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    {item.treatment}
                    {Number(item.price) > 0 && <span className="text-[10px] text-slate-400">{fmtPrice(item.price)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <Field label="ملاحظة على النتيجة (اختياري)" className="mt-3">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="مثال: كيس مائي 4×3 سم — سائل شفاف" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

/* ============================================================
 * طبقة الرسم اليدوي فوق الرسم التشريحي
 * ============================================================ */
function SketchOverlay({ sketch, onSketchChange }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-2 end-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-primary-700 shadow-md ring-1 ring-primary-200 hover:bg-white"
      >
        <Pencil size={13} />
        {sketch ? 'تعديل الرسم' : 'رسم على المخطط'}
      </button>
    )
  }
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white/95 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-primary-800">الرسم اليدوي أثناء الكشف</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
        >
          إغلاق
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <SketchCanvas value={sketch} onChange={onSketchChange} height={250} transparent={false} />
      </div>
    </div>
  )
}
