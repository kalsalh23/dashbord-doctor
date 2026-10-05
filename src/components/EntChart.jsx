import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Field, Input, Modal } from './ui'
import { formatDateShort } from '../lib/format'
import { regionDisplayName } from '../lib/ent'
import { fmtPrice } from '../lib/dental'

/**
 * مخطط الأنف والأذن والحنجرة — رسومات تشريحية قابلة للنقر لطبيب ENT:
 * الأنف والجيوب (وسط)، الأذن اليمنى واليسرى، البلعوم والحنجرة.
 * لكل تشخيص/إجراء لون يظهر على المنطقة + سعر يُحسب على حساب المريض.
 * props:
 *  - patientId   (لجلب التشخيصات السابقة)
 *  - entries     إدخالات هذه الزيارة [{region, side, category, treatment, price, color, notes}]
 *  - pricebook   [{category, treatment, price, color}]
 *  - onEntriesChange(next)
 */
export default function EntChart({ patientId, entries, pricebook, onEntriesChange }) {
  const [history, setHistory] = useState([])
  const [active, setActive] = useState(null) // {region, side}
  const [hover, setHover] = useState(null)
  const [cat, setCat] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!patientId) return
    supabase
      .from('ent_chart_entries')
      .select('id, region, side, procedure, notes, created_at, visit:visits(visit_date)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setHistory(data || []))
  }, [patientId])

  const historyByRegion = useMemo(() => {
    const m = {}
    for (const e of history) {
      const k = e.region + (e.side || '')
      if (!m[k]) m[k] = e
    }
    return m
  }, [history])

  const stagedByRegion = useMemo(() => {
    const m = {}
    for (const e of entries) {
      const k = e.region + (e.side || '')
      m[k] = m[k] || []
      m[k].push(e)
    }
    return m
  }, [entries])

  const categories = useMemo(() => {
    const seen = []
    for (const p of pricebook || []) if (!seen.includes(p.category)) seen.push(p.category)
    return seen
  }, [pricebook])

  const openRegion = (region, side) => {
    setActive({ region, side })
    setCat('')
    setNotes('')
  }

  const applyFinding = (item) => {
    if (!active || !item) return
    onEntriesChange([
      ...entries,
      {
        region: active.region,
        side: active.side,
        category: item.category,
        treatment: item.treatment,
        price: Number(item.price) || 0,
        color: item.color || '#0d9488',
        notes: notes.trim() || null,
      },
    ])
    setNotes('')
  }

  const removeEntryAt = (idx) => onEntriesChange(entries.filter((_, i) => i !== idx))

  const regionColor = (region, side) => {
    const list = stagedByRegion[region + (side || '')]
    if (list && list.length) return { fill: list[list.length - 1].color, staged: true }
    const h = historyByRegion[region + (side || '')]
    if (h) return { fill: '#fef9c3', staged: false }
    return { fill: '#f1f5f9', staged: false }
  }

  /* ------------ الرسومات ------------ */

  const R = ({ id, side, d, label, cx, cy, h = 1.18 }) => {
    const c = regionColor(id, side)
    const isHover = hover === id + (side || '')
    const isActive = active?.region === id && (active?.side || '') === (side || '')
    const list = stagedByRegion[id + (side || '')] || []
    return (
      <g
        onClick={() => openRegion(id, side)}
        onMouseEnter={() => setHover(id + (side || ''))}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'pointer' }}
      >
        <title>{`${
          label + (side ? (side === 'right' ? ' (يمين)' : ' (يسار)') : '')
        }${list.length ? ' — اليوم: ' + list.map((e) => e.treatment).join(' + ') : ''}${
          !list.length && historyByRegion[id + (side || '')] ? ' — سابقاً: ' + historyByRegion[id + (side || '')].procedure : ''
        }`}</title>
        <path d={d} fill={c.fill} fillOpacity={c.staged ? 0.9 : 0.85} stroke={isActive || isHover ? '#0f766e' : '#94a3b8'} strokeWidth={isActive ? 2.6 : 1.4} />
        {list.length > 1 && (
          <>
            <circle cx={cx} cy={cy} r={7} fill="#0f766e" />
            <text x={cx} y={cy + 3.2} textAnchor="middle" fontSize={9} fontWeight={800} fill="#ffffff" style={{ pointerEvents: 'none' }}>
              {list.length}
            </text>
          </>
        )}
        <text x={cx} y={cy + 15 * h} textAnchor="middle" fontSize={9} fontWeight={700}
          fill={c.staged ? c.fill : historyByRegion[id + (side || '')] ? '#a16207' : '#64748b'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {label}
        </text>
      </g>
    )
  }

  // الأنف: رسم أمامي مبسط مع الجيوب
  const NoseDiagram = () => (
    <g>
      {/* الجيب الجبهي */}
      <R id="sinus_frontal" label="الجيب الجبهي" d="M 330 26 Q 355 20 380 26 Q 382 42 355 46 Q 328 42 330 26 Z" cx={355} cy={40} />
      {/* الجيبان الفكيان */}
      <R id="sinus_maxillary" side="right" label="جيب فكي يمين" d="M 315 95 Q 295 88 288 105 Q 287 126 305 132 Q 322 128 322 110 Q 322 100 315 95 Z" cx={300} cy={112} h={0.4} />
      <R id="sinus_maxillary" side="left" label="جيب فكي يسار" d="M 395 95 Q 415 88 422 105 Q 423 126 405 132 Q 388 128 388 110 Q 388 100 395 95 Z" cx={410} cy={112} h={0.4} />
      {/* أنف خارجي */}
      <path d="M 340 50 Q 335 80 328 98 Q 322 114 355 118 Q 388 114 382 98 Q 375 80 370 50 Q 355 42 340 50 Z" fill="#fecdd3" stroke="#94a3b8" strokeWidth={1.4} />
      {/* فتحتا الأنف */}
      <R id="nose_vestibule" label="مدخل الأنف" d="M 342 104 Q 348 96 353 104 Q 348 112 342 104 Z M 357 104 Q 362 96 368 104 Q 362 112 357 104 Z" cx={355} cy={108} h={0.4} />
      {/* الحاجز */}
      <R id="nose_septum" label="حاجز الأنف" d="M 354 62 L 356 62 L 356 100 L 354 100 Z" cx={355} cy={82} h={0.2} />
      {/* القرينات */}
      <R id="nose_turbinates" label="القرينات" d="M 340 70 Q 332 78 338 90 Q 344 96 348 88 Q 346 76 340 70 Z M 370 70 Q 378 78 372 90 Q 366 96 362 88 Q 364 76 370 70 Z" cx={355} cy={84} h={0.2} />
      {/* لحم الأنف */}
      <R id="nose_polyp" label="لحم الأنف" d="M 348 76 Q 352 70 356 76 Q 354 84 350 84 Z" cx={352} cy={72} h={0.2} />
      {/* الأدينويد */}
      <R id="nose_adenoid" label="الخشائي" d="M 344 56 Q 355 48 366 56 Q 362 64 355 64 Q 348 64 344 56 Z" cx={355} cy={56} h={0.2} />
    </g>
  )

  // الأذن — جانب واحد (يمين أو يسار)
  const EarDiagram = ({ x, side }) => {
    const sx = (dx) => x + (side === 'right' ? dx : -dx)
    return (
      <g>
        {/* الصيوان */}
        <path d={`M ${sx(0)} 90 Q ${sx(-16)} 78 ${sx(-20)} 100 Q ${sx(-24)} 122 ${sx(-8)} 138 Q ${sx(4)} 148 ${sx(10)} 132 Q ${sx(16)} 116 ${sx(8)} 104 Q ${sx(4)} 94 ${sx(0)} 90 Z`} fill="#fde68a" stroke="#94a3b8" strokeWidth={1.4} />
        {/* قناة الأذن */}
        <R id="ear_canal" side={side} label="القناة" d={`M ${sx(8)} 118 Q ${sx(20)} 116 ${sx(30)} 120 L ${sx(30)} 130 Q ${sx(20)} 128 ${sx(8)} 128 Z`} cx={sx(20)} cy={126} h={0.2} />
        {/* شمع الأذن (داخل القناة) */}
        <R id="ear_wax" side={side} label="شمع" d={`M ${sx(14)} 119 Q ${sx(20)} 117 ${sx(24)} 121 L ${sx(24)} 127 Q ${sx(19)} 126 ${sx(14)} 125 Z`} cx={sx(20)} cy={117} h={0.2} />
        {/* طبلة الأذن */}
        <R id="ear_drum" side={side} label="الطبلة" d={`M ${sx(30)} 116 Q ${sx(38)} 125 ${sx(30)} 134 Q ${sx(26)} 125 ${sx(30)} 116 Z`} cx={sx(31)} cy={125} h={0.2} />
        {/* الأذن الوسطى */}
        <R id="ear_middle" side={side} label="الأذن الوسطى" d={`M ${sx(34)} 118 Q ${sx(46)} 114 ${sx(50)} 124 Q ${sx(50)} 136 ${sx(40)} 138 Q ${sx(33)} 134 ${sx(34)} 118 Z`} cx={sx(42)} cy={128} h={0.2} />
        {/* حلزون القوقعة */}
        <R id="ear_cochlea" side={side} label="القوقعة" d={`M ${sx(48)} 130 Q ${sx(60)} 132 ${sx(58)} 144 Q ${sx(54)} 152 ${sx(46)} 146 Q ${sx(44)} 136 ${sx(48)} 130 Z`} cx={sx(52)} cy={143} h={0.2} />
        {/* أنبوب استاكيوس */}
        <R id="ear_eustachian" side={side} label="استاكيوس" d={`M ${sx(42)} 138 Q ${sx(46)} 150 ${sx(40)} 160 L ${sx(34)} 158 Q ${sx(38)} 148 ${sx(36)} 140 Z`} cx={sx(40)} cy={152} h={0.2} />
        <text x={sx(8)} y={165} textAnchor="middle" fontSize={11} fontWeight={800} fill="#475569" style={{ pointerEvents: 'none' }}>
          {side === 'right' ? 'الأذن اليمنى' : 'الأذن اليسرى'}
        </text>
      </g>
    )
  }

  // البلعوم والحنجرة
  const ThroatDiagram = () => (
    <g>
      {/* الرأس والفم */}
      <path d="M 300 210 Q 355 200 410 210 Q 414 250 400 268 Q 380 290 355 290 Q 330 290 310 268 Q 296 250 300 210 Z" fill="#fecdd3" stroke="#94a3b8" strokeWidth={1.4} />
      {/* البلعوم */}
      <R id="throat_pharynx" label="البلعوم" d="M 322 218 Q 355 210 388 218 Q 390 240 380 252 Q 355 260 330 252 Q 320 240 322 218 Z" cx={355} cy={236} />
      {/* اللوزتان */}
      <R id="throat_tonsil" side="right" label="لوزة يمين" d="M 330 224 Q 320 232 326 244 Q 334 250 340 240 Q 340 228 330 224 Z" cx={330} cy={238} h={0.4} />
      <R id="throat_tonsil" side="left" label="لوزة يسار" d="M 380 224 Q 390 232 384 244 Q 376 250 370 240 Q 370 228 380 224 Z" cx={380} cy={238} h={0.4} />
      {/* الحبال الصوتية */}
      <R id="throat_voice" label="الحبال الصوتية" d="M 336 262 Q 345 256 354 262 L 354 268 Q 345 262 336 268 Z M 374 262 Q 365 256 356 262 L 356 268 Q 365 262 374 268 Z" cx={355} cy={266} h={0.2} />
      {/* الحنجرة */}
      <R id="throat_larynx" label="الحنجرة" d="M 332 258 Q 355 250 378 258 Q 380 276 370 284 Q 355 288 340 284 Q 330 276 332 258 Z" cx={355} cy={274} h={0.2} />
      {/* قاعدة اللسان */}
      <R id="throat_tongue" label="قاعدة اللسان" d="M 336 214 Q 355 206 374 214 Q 374 224 355 226 Q 336 224 336 214 Z" cx={355} cy={216} h={0.2} />
      {/* الارتجاع */}
      <R id="throat_reflux" label="الارتجاع" d="M 344 278 Q 355 284 366 278 Q 362 288 355 288 Q 348 288 344 278 Z" cx={355} cy={284} h={0.2} />
    </g>
  )

  const W = 710
  const H = 320

  // لوحة الألوان
  const usedTreatments = useMemo(() => {
    const m = new Map()
    for (const e of entries) m.set(e.treatment, e.color)
    return [...m.entries()]
  }, [entries])

  return (
    <div>
      <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white p-2">
        <p className="mb-1 text-center text-[11px] font-bold text-slate-400">اضغط على أي منطقة لتسجيل التشخيص أو الإجراء — لكل تشخيص لونه على الرسم</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full" role="img" aria-label="مخطط الأنف والأذن والحنجرة">
          {/* خطوط فاصلة خفيفة */}
          <line x1={225} y1={10} x2={225} y2={H - 10} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={485} y1={10} x2={485} y2={H - 10} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
          <NoseDiagram />
          <EarDiagram x={195} side="right" />
          <EarDiagram x={515} side="left" />
          <ThroatDiagram />
        </svg>
      </div>

      {/* لوحة الألوان */}
      <div className="mt-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
        <p className="mb-1 text-[10px] font-bold text-slate-400">دليل الألوان — لكل تشخيص لونه</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-slate-300 bg-slate-100" /> سليم
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-amber-300 bg-amber-100" /> شُخّص سابقاً
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
                {regionDisplayName(e.region, e.side)} — {e.treatment}
                {e.price ? <span className="text-slate-500"> · {Number(e.price).toLocaleString('en-US')} ل.س</span> : null}
                {e.notes ? <span className="font-medium text-slate-500"> · {e.notes}</span> : null}
              </span>
              <button type="button" onClick={() => removeEntryAt(idx)} className="text-rose-500 hover:text-rose-700" aria-label="إزالة">
                إزالة
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* نافذة التشخيص */}
      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? regionDisplayName(active.region, active.side) : ''}
        subtitle={
          active && (stagedByRegion[active.region + (active.side || '')] || []).length
            ? `تشخيصات اليوم: ${(stagedByRegion[active.region + (active.side || '')] || []).map((e) => e.treatment).join(' + ')}`
            : active && historyByRegion[active.region + (active.side || '')]
              ? `شُخّص سابقاً: ${historyByRegion[active.region + (active.side || '')].procedure}${
                  historyByRegion[active.region + (active.side || '')]?.visit?.visit_date
                    ? ` (${formatDateShort(historyByRegion[active.region + (active.side || '')].visit.visit_date)})`
                    : ''
                }`
              : 'لا يوجد سجل سابق — اختر الفئة ثم التشخيص'
        }
        footer={
          <div className="flex justify-start gap-2">
            <Button variant="secondary" onClick={() => setActive(null)}>إنهاء</Button>
          </div>
        }
      >
        {categories.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            لا توجد أسعار محفوظة — تُعرض التشخيصات الافتراضية، ويمكن تثبيت أسعارك من صفحة «أسعاري»
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
              <Field label="التشخيص / الإجراء — والسعر يُحسب تلقائياً على حساب المريض" className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {(pricebook || [])
                    .filter((p) => p.category === cat)
                    .map((p, i) => (
                      <button
                        key={(p.treatment || '') + i}
                        type="button"
                        onClick={() => applyFinding(p)}
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
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: احتقان خفيف في الجيب الأيمن" />
            </Field>
          </>
        )}
      </Modal>
    </div>
  )
}
