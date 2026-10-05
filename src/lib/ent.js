/**
 * مكتبة اختصاص الأنف والأذن والحنجرة (ENT):
 * مناطق الرسم التشريحي القابلة للنقر + كتالوج افتراضي للفئات والتشخيصات بألوانها.
 */

// مناطق الأنف (رسم أمامي بمقطع)
export const NOSE_REGIONS = [
  { id: 'nose_vestibule', label: 'مدخل الأنف', shape: 'nose-vestibule' },
  { id: 'nose_septum', label: 'حاجز الأنف', shape: 'nose-septum' },
  { id: 'nose_turbinates', label: 'القرينات', shape: 'nose-turbinates' },
  { id: 'nose_polyp', label: 'لحم الأنف (بوليب)', shape: 'nose-polyp' },
  { id: 'sinus_frontal', label: 'الجيب الجبهي', shape: 'nose-frontal' },
  { id: 'sinus_maxillary', label: 'الجيب الفكي', shape: 'nose-maxillary' },
  { id: 'nose_adenoid', label: 'اللحم الخشائي (أدينويد)', shape: 'nose-adenoid' },
]

// الأذن — لكل جانب (يمين/يسار)
export const EAR_REGIONS = [
  { id: 'ear_canal', label: 'قناة الأذن', shape: 'ear-canal' },
  { id: 'ear_drum', label: 'طبلة الأذن', shape: 'ear-drum' },
  { id: 'ear_middle', label: 'الأذن الوسطى (عظيمات)', shape: 'ear-middle' },
  { id: 'ear_cochlea', label: 'الحلزون (السمع)', shape: 'ear-cochlea' },
  { id: 'ear_eustachian', label: 'أنبوب استاكيوس', shape: 'ear-eustachian' },
  { id: 'ear_wax', label: 'شمع الأذن', shape: 'ear-wax' },
]

// الحنجرة والبلعوم
export const THROAT_REGIONS = [
  { id: 'throat_pharynx', label: 'البلعوم', shape: 'throat-pharynx' },
  { id: 'throat_tonsil', label: 'اللوزتان', shape: 'throat-tonsil' },
  { id: 'throat_voice', label: 'الحبال الصوتية', shape: 'throat-voice' },
  { id: 'throat_larynx', label: 'الحنجرة', shape: 'throat-larynx' },
  { id: 'throat_tongue', label: 'قاعدة اللسان', shape: 'throat-tongue' },
  { id: 'throat_reflux', label: 'منطقة الارتجاع', shape: 'throat-reflux' },
]

// الفئات الافتراضية — أشهر التشخيصات والإجراءات بأسعار مبدئية وألوان مميزة
export const ENT_DEFAULT_CATALOG = [
  {
    category: 'الأنف والجيوب',
    items: [
      { treatment: 'التهاب جيوب أنفية', price: 100000, color: '#dc2626' },
      { treatment: 'انسداد أنف', price: 0, color: '#f97316' },
      { treatment: 'انحراف حاجز أنف', price: 0, color: '#ea580c' },
      { treatment: 'رعاف (نزيف)', price: 0, color: '#b91c1c' },
      { treatment: 'زوائد لحمية', price: 0, color: '#a855f7' },
      { treatment: 'حساسية أنف', price: 0, color: '#eab308' },
      { treatment: 'غسول أنف', price: 50000, color: '#0ea5e9' },
      { treatment: 'كي رعاف', price: 200000, color: '#ef4444' },
    ],
  },
  {
    category: 'الأذن والسمع',
    items: [
      { treatment: 'التهاب أذن وسطى', price: 100000, color: '#dc2626' },
      { treatment: 'التهاب أذن خارجية', price: 80000, color: '#f97316' },
      { treatment: 'انسداد شمع', price: 0, color: '#78716c' },
      { treatment: 'شفط وغسيل أذن', price: 50000, color: '#06b6d4' },
      { treatment: 'ضعف سمع', price: 0, color: '#6366f1' },
      { treatment: 'طنين', price: 0, color: '#8b5cf6' },
      { treatment: 'ثقب طبلة', price: 0, color: '#be123c' },
      { treatment: 'انسداد أنبوب استاكيوس', price: 0, color: '#0891b2' },
    ],
  },
  {
    category: 'الحنجرة والبلعوم',
    items: [
      { treatment: 'التهاب بلعوم', price: 60000, color: '#dc2626' },
      { treatment: 'التهاب لوزتين', price: 80000, color: '#e11d48' },
      { treatment: 'بحة صوت', price: 0, color: '#f59e0b' },
      { treatment: 'ارتجاع حنجري', price: 0, color: '#d97706' },
      { treatment: 'تضخم لحم اللوزة', price: 0, color: '#a21caf' },
      { treatment: 'خراج لوزتي', price: 0, color: '#9f1239' },
    ],
  },
  {
    category: 'إجراءات وجراحة',
    items: [
      { treatment: 'تنظير أنفي', price: 150000, color: '#0d9488' },
      { treatment: 'غسيل وأنفوس', price: 100000, color: '#14b8a6' },
      { treatment: 'استئصال لوزتين', price: 800000, color: '#7c3aed' },
      { treatment: 'ترميم طبلة', price: 1000000, color: '#2563eb' },
      { treatment: 'تركيب أنبوب تهوية', price: 600000, color: '#059669' },
      { treatment: 'تنظير حنجرة', price: 150000, color: '#0284c7' },
    ],
  },
  {
    category: 'فحص وتشخيص',
    items: [
      { treatment: 'فحص وتشخيص', price: 50000, color: '#64748b' },
      { treatment: 'قياس سمع', price: 80000, color: '#94a3b8' },
      { treatment: 'فحص توازن', price: 100000, color: '#cbd5e1' },
    ],
  },
]

// هل المنطقة مزدوجة (تظهر مرة لكل جانب)؟
export function regionSideLabel(side) {
  if (side === 'right') return 'يمين'
  if (side === 'left') return 'يسار'
  return ''
}

export function regionDisplayName(region, side) {
  const r = [...NOSE_REGIONS, ...EAR_REGIONS, ...THROAT_REGIONS].find((x) => x.id === region)
  const base = r ? r.label : region
  const s = regionSideLabel(side)
  return s ? base + ' — ' + s : base
}
