import { regionDisplayName } from '../lib/ent'
import { fmtPrice } from '../lib/dental'

// أسماء عربية لأقسام بيانات التخصص المخزّنة في الزيارة
export const SECTION_LABELS = {
  treatments: 'علاجات على مخطط الأسنان',
  findings: 'تشخيصات على المخطط',
  face_points: 'نقاط علاج الوجه',
}

function priceSuffix(price) {
  const n = Number(price || 0)
  return n > 0 ? ` · ${fmtPrice(n)}` : ''
}

function renderTreatment(t) {
  if (t && t.bridge) {
    const from = t.teeth?.[0] ?? '—'
    const to = t.teeth?.[1] ?? '—'
    const span = t.span?.length ? ` (يشمل ${t.span.length} أسنان)` : ''
    return `جسر من السن ${from} إلى ${to}${span}${priceSuffix(t.price)}${t.category ? ` · ${t.category}` : ''}`
  }
  if (t && t.tooth_no) {
    return `سن ${t.tooth_no} — ${t.treatment || 'علاج'}${priceSuffix(t.price)}${t.category ? ` · ${t.category}` : ''}`
  }
  return String(t)
}

function renderFinding(f) {
  if (f && f.region) {
    return `${regionDisplayName(f.region, f.side)} — ${f.treatment || 'تشخيص'}${priceSuffix(f.price)}${f.category ? ` · ${f.category}` : ''}`
  }
  return String(f)
}

const FACE_TREATMENT_LABELS = {
  botox: 'بوتوكس',
  filler: 'فلير',
  peeling: 'تقشير',
  laser: 'ليزر',
  meso: 'ميزوثيرابي',
  thread: 'خيوط',
  other: 'أخرى',
}

function renderFacePoint(p) {
  const label = p && p.treatment ? (FACE_TREATMENT_LABELS[p.treatment] || p.treatment) : 'علاج'
  const sub = p && p.subtype ? ` (${p.subtype})` : ''
  const price = p && p.price > 0 ? ` · ${Number(p.price)} ر.س` : ''
  return `${label}${sub}${price}`
}

function renderValue(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v))).join(' · ')
    }
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${renderValue(v)}`)
      .join(' · ')
  }
  return String(value)
}

/**
 * نص مقروء لقسم واحد من بيانات التخصص (للطباعة والأماكن الضيقة)
 * — يعيد المعالَج نفسه المطبوع في الواجهات بأسماء مفهومة بدل الكود.
 */
export function specialtyText(key, value) {
  if (key === 'treatments' && Array.isArray(value)) return value.map(renderTreatment).join(' · ')
  if (key === 'findings' && Array.isArray(value)) return value.map(renderFinding).join(' · ')
  if (key === 'face_points' && Array.isArray(value)) return value.map(renderFacePoint).join(' · ')
  return renderValue(value)
}

/**
 * عرض بيانات التخصص المخزّنة في الزيارة بأسماء مقروءة:
 * علاجات الأسنان (سن + علاج + سعر) وتشخيصات الأنف والأذن والحنجرة،
 * وحقول التخصص العامة (اسم: قيمة) — لا كود ولا [object Object].
 */
export default function SpecialtyData({ data }) {
  const entries = Object.entries(data || {}).filter(
    ([, v]) => v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0)
  )
  if (entries.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-slate-400">بيانات التخصص</p>
      <div className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
            <b className="text-slate-500">{SECTION_LABELS[key] || key}:</b>{' '}
            {key === 'treatments' && Array.isArray(value)
              ? value.map((t, i) => (
                  <span key={i} className="block">
                    {renderTreatment(t)}
                  </span>
                ))
              : key === 'findings' && Array.isArray(value)
              ? value.map((f, i) => (
                  <span key={i} className="block">
                    {renderFinding(f)}
                  </span>
                ))
              : key === 'face_points' && Array.isArray(value)
              ? value.map((p, i) => (
                  <span key={i} className="block">
                    {renderFacePoint(p)}
                  </span>
                ))
              : renderValue(value)}
          </div>
        ))}
      </div>
    </div>
  )
}
