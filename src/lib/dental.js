/**
 * مكتبة طب الأسنان: سنّون حسب العمر (لبنية / مختلطة / دائمة) + كتالوج أسعار افتراضي بألوان العلاجات.
 */

// ترتيب العرض على الشاشة: يمين المريض يظهر يسار الشاشة (كما في المرآة الجراحية)
export const PERM_UPPER_ORDER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
export const PERM_LOWER_ORDER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
export const PRIM_UPPER_ORDER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
export const PRIM_LOWER_ORDER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

export function isWisdom(no) {
  return [18, 28, 38, 48].includes(no)
}

/**
 * أسنان الفك حسب عمر المريض — طفل 8 سنوات ليس كفك رجل 40:
 * أقل من 6: أسنان لبنية (20 سنّاً)
 * 6–11: dentition مختلطة (ضواحك لبنية + قواطع وأرحاء دائمة ظاهرة)
 * 12+: دائمة (28) — أرحاء العقل تظهر من 17
 */
export function teethForAge(age) {
  const a = age == null || Number.isNaN(age) ? 30 : Number(age)
  if (a < 6) {
    return { upper: PRIM_UPPER_ORDER, lower: PRIM_LOWER_ORDER, type: 'primary' }
  }
  if (a >= 12) {
    const perm28 = (order) => order.filter((n) => !isWisdom(n))
    const wisdom = (order) => (a >= 17 ? order : perm28(order))
    return { upper: wisdom(PERM_UPPER_ORDER), lower: wisdom(PERM_LOWER_ORDER), type: 'permanent' }
  }
  // مختلطة 6–11
  const mix = (permOrder, primOrder) => {
    const set = new Set()
    // الأرحاء الأولى الدائمة (من 6) والقواطع المركزية
    for (const n of permOrder) {
      if ([16, 26, 36, 46, 11, 21, 31, 41].includes(n)) set.add(n)
      // القواطع الجانبية من 8
      if (a >= 8 && [12, 22, 32, 42].includes(n)) set.add(n)
      // الأنياب الدائمة من 10
      if (a >= 10 && [13, 23, 33, 43].includes(n)) set.add(n)
    }
    // اللبنية الباقية: الأرحاء اللبنية حتى 11، الأنياب اللبنية حتى 9، القواطع اللبنية الجانبية حتى 8
    for (const n of primOrder) {
      if ([55, 54, 65, 64, 85, 84, 75, 74].includes(n)) set.add(n)
      if (a < 10 && [53, 63, 73, 83].includes(n)) set.add(n)
      if (a < 8 && [52, 62, 82, 81, 51, 61, 71, 72].includes(n)) set.add(n)
    }
    // ترتيب العرض: دائمة خلف اللبنية ثم الأمامية — نرتب حسب قائمة الترتيب الأصلية
    const order = [...permOrder, ...primOrder].filter((n) => set.has(n))
    return order
  }
  return { upper: mix(PERM_UPPER_ORDER, PRIM_UPPER_ORDER), lower: mix(PERM_LOWER_ORDER, PRIM_LOWER_ORDER), type: 'mixed' }
}

export function dentitionLabel(type) {
  if (type === 'primary') return 'أسنان لبنية (20 سنّاً)'
  if (type === 'mixed') return 'فترة تبديل — أسنان مختلطة'
  return 'أسنان دائمة'
}

// فئات التشخيص الافتراضية (مطابقة لبرامج الأسنان المعروفة) مع العلاجات والألوان والأشكال
export const DEFAULT_CATALOG = [
  {
    category: 'فحص وتشخيص',
    items: [
      { treatment: 'فحص وتشخيص', price: 50000, color: '#64748b' },
    ],
  },
  {
    category: 'الصور الخاصة',
    items: [
      { treatment: 'أشعة سنّية', price: 25000, color: '#7dd3fc' },
      { treatment: 'أشعة بانوراما', price: 100000, color: '#38bdf8' },
      { treatment: 'أشعة سيفالومترية', price: 80000, color: '#0ea5e9' },
    ],
  },
  {
    category: 'الحشوات',
    items: [
      { treatment: 'تسوس', price: 0, color: '#dc2626' },
      { treatment: 'حشو ضوئي', price: 150000, color: '#2563eb' },
      { treatment: 'حشو عادي (أملغم)', price: 100000, color: '#475569' },
      { treatment: 'حشو زجاجي', price: 120000, color: '#3b82f6' },
      { treatment: 'حشو مؤقت', price: 50000, color: '#a8a29e' },
    ],
  },
  {
    category: 'علاج العصب',
    items: [
      { treatment: 'علاج عصب سن أمامي', price: 300000, color: '#f97316' },
      { treatment: 'علاج عصب ضرس', price: 400000, color: '#f97316' },
      { treatment: 'إعادة علاج عصب', price: 500000, color: '#ea580c' },
      { treatment: 'فتح قناة إسعافي', price: 100000, color: '#fb923c' },
    ],
  },
  {
    category: 'خلع',
    items: [
      { treatment: 'خلع', price: 100000, color: '#1e293b' },
      { treatment: 'خلع جراحي', price: 250000, color: '#334155' },
      { treatment: 'خلع ضرس عقل مغطى', price: 400000, color: '#0f172a' },
      { treatment: 'قلع جذر', price: 150000, color: '#1f2937' },
    ],
  },
  {
    category: 'معالجة جراحية صغرى',
    items: [
      { treatment: 'بضع خراج', price: 150000, color: '#b91c1c' },
      { treatment: 'استئصال لحم زائد', price: 200000, color: '#991b1b' },
      { treatment: 'بضع سنخ', price: 120000, color: '#7f1d1d' },
      { treatment: 'رأب لثة', price: 300000, color: '#881337' },
    ],
  },
  {
    category: 'معالجات لثوية',
    items: [
      { treatment: 'تنظيف عميق (كحت)', price: 200000, color: '#e11d48' },
      { treatment: 'علاج التهاب لثة', price: 100000, color: '#f43f5e' },
      { treatment: 'تطعيم لثة', price: 400000, color: '#be123c' },
      { treatment: 'تلبيد الأسنان', price: 250000, color: '#9f1239' },
    ],
  },
  {
    category: 'تركيبات خزفية',
    items: [
      { treatment: 'تلبيسة زيركون', price: 800000, color: '#d4a017' },
      { treatment: 'تلبيسة إيماكس', price: 900000, color: '#eab308' },
      { treatment: 'تلبيسة معدنية', price: 400000, color: '#b08d57' },
      { treatment: 'فينير خزفي', price: 700000, color: '#f5d020' },
      { treatment: 'طوق أسنان', price: 350000, color: '#be185d' },
    ],
  },
  {
    category: 'أطفال',
    items: [
      { treatment: 'حشو طفل', price: 80000, color: '#0ea5e9' },
      { treatment: 'خلع سن لبني', price: 50000, color: '#6366f1' },
      { treatment: 'فلورايد وقائي', price: 40000, color: '#14b8a6' },
      { treatment: 'حشو وقائي (سدود)', price: 60000, color: '#22c55e' },
    ],
  },
  {
    category: 'وقائية',
    items: [
      { treatment: 'تنظيف جير', price: 150000, color: '#06b6d4' },
      { treatment: 'تطعيم وقائي', price: 40000, color: '#84cc16' },
    ],
  },
  {
    category: 'تبييض وتجميل',
    items: [
      { treatment: 'تبييض بالليزر', price: 700000, color: '#f472b6' },
      { treatment: 'تبييض منزلي', price: 400000, color: '#f9a8d4' },
    ],
  },
  {
    category: 'زراعة وتقويم',
    items: [
      { treatment: 'زراعة', price: 3000000, color: '#059669' },
      { treatment: 'تقويم ثابت', price: 2500000, color: '#ec4899' },
      { treatment: 'تقويم متحرك', price: 800000, color: '#c026d3' },
      { treatment: 'تركيب براكت', price: 300000, color: '#db2777' },
    ],
  },
  {
    category: 'معالجات أخرى',
    items: [
      { treatment: 'ضماد', price: 30000, color: '#a3a3a3' },
      { treatment: 'إزالة تركيبة', price: 80000, color: '#78716c' },
      { treatment: 'تركيبة مؤقتة', price: 60000, color: '#d6d3d1' },
      { treatment: 'معالجة منزلية', price: 50000, color: '#57534e' },
    ],
  },
]

/**
 * شكل العلاج المميز على السن — يُشتق من اسم العلاج (يعمل مع أي أسعار يضيفها الطبيب):
 * crown تاج فوق السن، implant مسمار زراعة، ortho تقويم، extraction علامة خلع،
 * rct خط عصب، filling نقطة حشو، caries نقطة تسوس، perio علامات لثة،
 * cleaning/whitening نجوم، preventive علامة وقاية، xray شاشة أشعة.
 */
export function treatmentGlyph(treatment = '') {
  const t = String(treatment)
  if (t.includes('تلبيسة') || t.includes('تاج') || t.includes('فينير')) return 'crown'
  if (t.includes('زراعة')) return 'implant'
  if (t.includes('تقويم') || t.includes('براكت')) return 'ortho'
  if (t.includes('خلع') || t.includes('قلع')) return 'extraction'
  if (t.includes('عصب') || t.includes('قناة')) return 'rct'
  if (t.includes('حشو')) return 'filling'
  if (t.includes('تسوس')) return 'caries'
  if (t.includes('لثة') || t.includes('كحت') || t.includes('تلبيد') || t.includes('خراج') || t.includes('سنخ') || t.includes('لحم')) return 'perio'
  if (t.includes('تنظيف') || t.includes('جير')) return 'cleaning'
  if (t.includes('تبييض')) return 'whitening'
  if (t.includes('فلورايد') || t.includes('وقائي') || t.includes('سدود') || t.includes('تطعيم')) return 'preventive'
  if (t.includes('أشعة')) return 'xray'
  if (t.includes('جسر')) return 'bridge'
  return null
}

// الرمز الافتراضي للعلاج في لوحة الألوان عندما لا يوجد لون محفوظ
export const LEGEND_DEFAULTS = [
  { label: 'سليم', color: '#f8fafc', stroke: '#cbd5e1' },
  { label: 'عولج سابقاً', color: '#fef9c3', stroke: '#facc15' },
]

export function fmtPrice(n, currency = 'ل.س') {
  const v = Number(n || 0).toLocaleString('en-US')
  return v + ' ' + currency
}
