// ============================================================
// مكتبة اختصاص النساء والتوليد — لعيادة الدكتورة رنيم النبهان وحدها
//   - مناطق الرسم التشريحي (الرحم والحوض + الثديين) القابلة للنقر
//   - كتالوج افتراضي للفحوصات والإجراءات والتشخيصات بألوانها
//   - حسابات الحمل: آخر دورة → عمر الحمل، تاريخ الولادة المتوقع، BMI
//   - تنبيهات المخاطر والتقييم السريع لمتابعة الحمل
// ============================================================
import { parseDate, toLocalISO, todayStr } from './format'

/* ------------------------------------------------------------
 * مناطق الرسم التشريحي — الرحم والحوض (منظر أمامي)
 * ------------------------------------------------------------ */
export const UTERUS_REGIONS = [
  { id: 'uterus_fundus', label: 'قاع الرحم', group: 'uterus' },
  { id: 'uterus_body', label: 'جسم الرحم', group: 'uterus' },
  { id: 'cervix', label: 'عنق الرحم', group: 'uterus' },
  { id: 'endometrium', label: 'بطانة الرحم', group: 'uterus' },
  { id: 'tube_right', label: 'القناة الناقلة اليمنى', group: 'adnexa' },
  { id: 'tube_left', label: 'القناة الناقلة اليسرى', group: 'adnexa' },
  { id: 'ovary_right', label: 'المبيض الأيمن', group: 'adnexa' },
  { id: 'ovary_left', label: 'المبيض الأيسر', group: 'adnexa' },
  { id: 'vagina', label: 'المهبل', group: 'pelvis' },
  { id: 'vulva', label: 'المدخل (الفرج)', group: 'pelvis' },
  { id: 'bladder', label: 'المثانة', group: 'pelvis' },
  { id: 'rectum', label: 'المستقيم', group: 'pelvis' },
  { id: 'pelvis_abdomen', label: 'الجدار البطني / ارتفاع القاع', group: 'pelvis' },
]

// مناطق الثدي — تُعرض في تبويب منفصل داخل نفس المخطط
export const BREAST_REGIONS = [
  { id: 'breast_outer_upper_right', label: 'الثلث العلوي الخارجي (أيمن)', group: 'breast' },
  { id: 'breast_inner_upper_right', label: 'الثلث العلوي الداخلي (أيمن)', group: 'breast' },
  { id: 'breast_outer_lower_right', label: 'الثلث السفلي الخارجي (أيمن)', group: 'breast' },
  { id: 'breast_inner_lower_right', label: 'الثلث السفلي الداخلي (أيمن)', group: 'breast' },
  { id: 'breast_nipple_right', label: 'الحلمة (أيمن)', group: 'breast' },
  { id: 'breast_axilla_right', label: 'الإبط (أيمن)', group: 'breast' },
  { id: 'breast_outer_upper_left', label: 'الثلث العلوي الخارجي (يسار)', group: 'breast' },
  { id: 'breast_inner_upper_left', label: 'الثلث العلوي الداخلي (يسار)', group: 'breast' },
  { id: 'breast_outer_lower_left', label: 'الثلث السفلي الخارجي (يسار)', group: 'breast' },
  { id: 'breast_inner_lower_left', label: 'الثلث السفلي الداخلي (يسار)', group: 'breast' },
  { id: 'breast_nipple_left', label: 'الحلمة (يسار)', group: 'breast' },
  { id: 'breast_axilla_left', label: 'الإبط (يسار)', group: 'breast' },
]

export const ALL_OBGYN_REGIONS = [...UTERUS_REGIONS, ...BREAST_REGIONS]

export function obgynRegionLabel(id) {
  return ALL_OBGYN_REGIONS.find((r) => r.id === id)?.label || id
}

/* ------------------------------------------------------------
 * الكتالوج الافتراضي — فئات الفحوصات والإجراءات والتشخيصات
 * السعر 0 افتراضياً (تثبّته الطبيبة من صفحة «أسعاري»)
 * ------------------------------------------------------------ */
export const OBGYN_DEFAULT_CATALOG = [
  {
    category: 'الفحص والمتابعة',
    items: [
      { treatment: 'كشف نساء وتوليد', price: 50000, color: 'var(--p600)' },
      { treatment: 'متابعة حمل', price: 30000, color: 'var(--p500)' },
      { treatment: 'فحص ما قبل الولادة', price: 40000, color: '#0ea5e9' },
      { treatment: 'فحص سونار', price: 60000, color: '#06b6d4' },
      { treatment: 'استشارة نسائية', price: 25000, color: '#64748b' },
      { treatment: 'فحص ثدي', price: 30000, color: '#ec4899' },
    ],
  },
  {
    category: 'اضطرابات الدورة',
    items: [
      { treatment: 'تكيس المبايض', price: 0, color: '#a855f7' },
      { treatment: 'اضطراب الدورة', price: 0, color: '#9333ea' },
      { treatment: 'ألم أسفل البطن', price: 0, color: '#e879f9' },
      { treatment: 'نزيف رحلي غير طبيعي', price: 0, color: '#db2777' },
      { treatment: 'ألم الحوض المزمن', price: 0, color: '#c026d3' },
      { treatment: 'إفرازات مهبلية', price: 0, color: '#f472b6' },
    ],
  },
  {
    category: 'الحمل والمتابعة',
    items: [
      { treatment: 'تهديد إجهاض', price: 0, color: '#ef4444' },
      { treatment: 'سكري حمل', price: 0, color: '#f97316' },
      { treatment: 'ارتفاع ضغط الحمل', price: 0, color: '#dc2626' },
      { treatment: 'أنيميا الحمل', price: 0, color: '#b91c1c' },
      { treatment: 'المشيمة النازلة', price: 0, color: '#991b1b' },
      { treatment: 'الولادة المبكرة', price: 0, color: '#fb7185' },
      { treatment: 'تمزق الأغشية مبكراً', price: 0, color: '#e11d48' },
      { treatment: 'القيء الحملي', price: 0, color: '#f59e0b' },
    ],
  },
  {
    category: 'الاضطرابات النسائية',
    items: [
      { treatment: 'أورام الرحم الليفية', price: 0, color: '#f43f5e' },
      { treatment: 'تكيس مبيض', price: 0, color: '#fb7185' },
      { treatment: 'التهاب الحوض', price: 0, color: '#e11d48' },
      { treatment: 'تضخم بطانة الرحم', price: 0, color: '#be185d' },
      { treatment: 'هبوط الرحم', price: 0, color: '#9d174d' },
      { treatment: 'عقم الأنابيب', price: 0, color: '#831843' },
    ],
  },
  {
    category: 'ما قبل الولادة',
    items: [
      { treatment: 'لقاح المجموعة B', price: 0, color: '#0891b2' },
      { treatment: 'حديد وحمض الفوليك', price: 0, color: '#059669' },
      { treatment: 'فيتامين د', price: 0, color: '#65a30d' },
      { treatment: 'تخدير نصفي (Epidural)', price: 0, color: '#7c3aed' },
    ],
  },
  {
    category: 'الولادة والإجراءات',
    items: [
      { treatment: 'ولادة قيصرية', price: 1500000, color: '#b91c1c' },
      { treatment: 'ولادة طبيعية', price: 700000, color: '#15803d' },
      { treatment: 'تحريض المخاض', price: 0, color: '#ca8a04' },
      { treatment: 'إدخال وريد وتسريب', price: 0, color: '#0369a1' },
      { treatment: 'كيس ماء', price: 0, color: '#0e7490' },
      { treatment: 'خزعة من الرحم', price: 0, color: '#7e22ce' },
      { treatment: 'منظار الرحم', price: 0, color: '#a21caf' },
    ],
  },
]

/* ------------------------------------------------------------
 * حسابات الحمل
 * ------------------------------------------------------------ */
const DAY_MS = 86400000

/** آخر دورة شهرية → عمر الحمل (أسبوع + يوم) */
export function gestationalAge(lmp, ref = todayStr()) {
  if (!lmp) return null
  const l = parseDate(String(lmp).slice(0, 10)).getTime()
  const r = parseDate(ref).getTime()
  if (Number.isNaN(l) || Number.isNaN(r)) return null
  const days = Math.floor((r - l) / DAY_MS)
  if (days < 0) return { weeks: 0, days: 0, totalDays: days, negative: true }
  const weeks = Math.floor(days / 7)
  return { weeks, days: days % 7, totalDays: days, negative: false }
}

/** تاريخ الولادة المتوقع (آخر دورة + 280 يوماً) */
export function eddFromLmp(lmp) {
  if (!lmp) return null
  const l = parseDate(String(lmp).slice(0, 10))
  if (Number.isNaN(l.getTime())) return null
  l.setDate(l.getDate() + 280)
  return toLocalISO(l)
}

/** تاريخ بعد عدد أسابيع من تاريخ معيّن */
export function addWeeks(dateStr, weeks) {
  if (!dateStr) return null
  const d = parseDate(String(dateStr).slice(0, 10))
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + Math.round(weeks * 7))
  return toLocalISO(d)
}

/** نص عمر الحمل: «24 أسبوعاً و3 أيام» */
export function gaLabel(ga) {
  if (!ga) return '—'
  if (ga.negative) return 'تاريخ آخر دورة في المستقبل'
  if (ga.totalDays === 0) return 'اليوم صفر — بداية الحمل'
  return `${ga.weeks} أسبوعاً${ga.days ? ` و${ga.days} يوماً` : ''}`
}

/** مؤشر كتلة الجسم */
export function bmiOf(weightKg, heightCm) {
  const w = Number(weightKg)
  const h = Number(heightCm)
  if (!w || !h || h <= 0) return null
  const m = h / 100
  return Math.round((w / (m * m)) * 10) / 10
}

export function bmiLabel(bmi) {
  if (bmi == null) return null
  if (bmi < 18.5) return { text: 'نقص وزن', tone: 'amber' }
  if (bmi < 25) return { text: 'وزن مثالي', tone: 'emerald' }
  if (bmi < 30) return { text: 'زيادة وزن', tone: 'amber' }
  return { text: 'سمنة', tone: 'rose' }
}

/** وصف الحمل G-P-A */
export function gpaLabel(g, p, a) {
  const G = Number(g) || 0
  const P = Number(p) || 0
  const A = Number(a) || 0
  return `${G}-${P}-${A}`
}

/* ------------------------------------------------------------
 * تنبيهات المخاطر — تُعرض في لوحة اليوم وفي ملف المريضة
 * ------------------------------------------------------------ */
export function obgynAlerts(data) {
  const d = data || {}
  const out = []
  const sys = Number(d.bp_systolic)
  const dia = Number(d.bp_diastolic)
  const ga = d.gestational_age || gestationalAge(d.lmp)

  if (sys >= 140 || dia >= 90) {
    out.push({ tone: 'rose', text: `ارتفاع ضغط الدم (${sys || '—'}/${dia || '—'}) — يحتاج متابعة`, key: 'bp' })
  }
  if (d.rh && String(d.rh).toUpperCase() === 'NEGATIVE') {
    out.push({ tone: 'amber', text: 'ال Rh سلبي — تحتاج حقن مضاد D ومتابعة مستوى المضاد', key: 'rh' })
  }
  if (ga && ga.weeks >= 37) {
    out.push({ tone: 'emerald', text: `عمر الحمل ${ga.weeks} أسبوع — موعد الولادة وشيك`, key: 'term' })
  }
  if (ga && ga.weeks >= 28 && ga.weeks < 37) {
    out.push({ tone: 'amber', text: 'ولادة مبكرة محتملة — متابعة أسبوعية', key: 'preterm' })
  }
  if (d.gdm) out.push({ tone: 'rose', text: 'سكري حمل — متابعة سكر الدم ومتابعة الولادة', key: 'gdm' })
  if (d.threatened_abortion) out.push({ tone: 'rose', text: 'تهديد إجهاض — متابعة سونار', key: 'threat' })
  if (d.preeclampsia) out.push({ tone: 'rose', text: 'تسمم حمل — متابعة الضغط والألبومين', key: 'pree' })
  if (d.placenta_previa) out.push({ tone: 'rose', text: 'المشيمة النازلة — مراجعة السونار قبل الولادة', key: 'previa' })
  if (d.cervix_dilation && Number(d.cervix_dilation) >= 4) {
    out.push({ tone: 'amber', text: `اتساع عنق الرحم ${d.cervix_dilation} سم — متابعة مخاض`, key: 'cervix' })
  }
  const bmi = bmiOf(d.weight, d.height)
  if (bmi != null && bmi >= 30) {
    out.push({ tone: 'amber', text: `سمنة (BMI ${bmi}) — تقييد زيادة الوزن أثناء الحمل`, key: 'bmi' })
  }
  if (d.pap_due) out.push({ tone: 'slate', text: 'مستحقة لفحص المسحة (Pap Smear)', key: 'pap' })
  return out
}

/* ------------------------------------------------------------
 * متابعة الحمل — متى次回 المتابعة
 * ------------------------------------------------------------ */
export function nextFollowupWeeks(ga) {
  if (!ga) return null
  const w = ga.weeks
  if (w < 12) return 4
  if (w < 28) return 4
  if (w < 34) return 2
  if (w < 37) return 1
  return 1
}

/** حالة حمل المريضة في سطر واحد (للعرض في البطاقات) */
export function pregnancyStatus(data) {
  const d = data || {}
  if (!d.lmp) return { pregnant: false, label: 'غير حامل' }
  const ga = gestationalAge(d.lmp)
  if (!ga || ga.negative) return { pregnant: false, label: 'غير حامل' }
  return {
    pregnant: true,
    ga,
    label: `حامل — ${gaLabel(ga)}`,
    edd: eddFromLmp(d.lmp),
    weeks: ga.weeks,
  }
}

/** مستوى الخطورة: مرتفع / متوسط / مستقر */
export function riskLevel(data) {
  const alerts = obgynAlerts(data)
  if (alerts.some((a) => a.tone === 'rose')) return { level: 'high', label: 'خطورة عالية', cls: 'rose' }
  if (alerts.some((a) => a.tone === 'amber')) return { level: 'mid', label: 'خطورة متوسطة', cls: 'amber' }
  return { level: 'low', label: 'مستقر', cls: 'emerald' }
}
