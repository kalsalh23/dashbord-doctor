// ============================================================
// مكتبة الغدد والسكري — لعيادة الدكتورة رندة مصطفى الشيخ علي وحدها
//   - تصنيف سكر الدم: صائم / عشوائي / بعد الطعام (120 دقيقة)
//   - تصنيف السكر التراكمي HbA1c
//   - مؤشر كتلة الجسم BMI + الوزن
//   - تصنيف ضغط الدم
//   - تنبيهات مضاعفات السكري: الأقدام، الكلى، العين، القلب
// ============================================================
import { todayStr } from './format'

/* ------------------------------------------------------------
   تصنيف سكر الدم (المنظمة الدولية لمرض السكري)
   ------------------------------------------------------------ */
export function glucoseLabel(val) {
  const g = Number(val)
  if (!Number.isFinite(g)) return null
  if (g < 70) return { cls: 'rose', tone: 'rose', label: 'منخفض', text: 'انخفاض سكر الدم' }
  if (g < 100) return { cls: 'emerald', tone: 'emerald', label: 'طبيعي', text: 'سكر الدم طبيعي (صائم)' }
  if (g < 126) return { cls: 'amber', tone: 'amber', label: 'مقدمات السكري', text: 'مقدمات سكري' }
  return { cls: 'rose', tone: 'rose', label: 'مرتفع', text: 'سكر دم مرتفع' }
}

/* ------------------------------------------------------------
   تصنيف السكر التراكمي HbA1c (%)
   ------------------------------------------------------------ */
export function hba1cLabel(val) {
  const g = Number(val)
  if (!Number.isFinite(g)) return null
  if (g < 5.7) return { cls: 'emerald', label: 'طبيعي', text: 'طبيعي' }
  if (g < 6.5) return { cls: 'amber', label: 'مقدمات السكري', text: 'مقدمات سكري' }
  return { cls: 'rose', label: 'مرتفع', text: 'سكري' }
}

/* ------------------------------------------------------------
   مؤشر كتلة الجسم + التقييم
   ------------------------------------------------------------ */
export function bmiOf(weightKg, heightCm) {
  const w = Number(weightKg)
  const h = Number(heightCm)
  if (!w || !h || h <= 0) return null
  const m = h / 100
  return Math.round((w / (m * m)) * 10) / 10
}

export function bmiLabel(bmi) {
  if (bmi == null) return null
  if (bmi < 18.5) return { cls: 'amber', label: 'نقص وزن', text: 'نقص وزن' }
  if (bmi < 25) return { cls: 'emerald', label: 'طبيعي', text: 'وزن طبيعي' }
  if (bmi < 30) return { cls: 'amber', label: 'زيادة وزن', text: 'وزن زائد' }
  return { cls: 'rose', label: 'سمنة', text: 'سمنة' }
}

/* ------------------------------------------------------------
   تصنيف ضغط الدم
   ------------------------------------------------------------ */
export function bpLabel(sys, dia) {
  const s = Number(sys)
  const d = Number(dia)
  if (!Number.isFinite(s) || !Number.isFinite(d)) return null
  if (s < 120 && d < 80) return { cls: 'emerald', label: 'طبيعي', text: 'ضغط طبيعي' }
  if (s < 130 && d < 80) return { cls: 'amber', label: 'مقدمات ارتفاع الضغط', text: 'مقدمات ضغط' }
  return { cls: 'rose', label: 'ارتفاع ضغط الدم', text: 'ضغط مرتفع' }
}

/* ------------------------------------------------------------
   تنبيهات مضاعفات السكري — تُستخرج من بيانات最後 زيارة
   ------------------------------------------------------------ */
export function endocrineAlerts(data) {
  const d = data || {}
  const out = []
  const hba1c = Number(d.hba1c)
  const glucose = Number(d.blood_glucose)
  const foot = String(d.foot_exam || '').trim()
  const vision = String(d.vision || '').trim()
  const kidney = String(d.kidney || '').trim()
  const bp = bpLabel(d.blood_pressure)

  if (hba1c >= 7) {
    out.push({ key: 'hba1c', tone: 'rose', text: `السكر التراكمي ${hba1c}% مرتفع — ضرورة ضبط النظام الدوائي والنظام الغذائي` })
  }
  if (glucose > 250) {
    out.push({ key: 'glucose-high', tone: 'rose', text: 'سكر الدم مرتفع جداً — متابعة عاجلة' })
  }
  if (glucose < 70) {
    out.push({ key: 'glucose-low', tone: 'rose', text: 'سكر الدم منخفض — خطر انخفاض سكر' })
  }
  if (/نقص|ضعف|تقرح|تورم|تليف/.test(foot)) {
    out.push({ key: 'foot', tone: 'rose', text: 'فحص الأقدام يشير إلى مشكلة — فحص القدم السكري ضروري' })
  }
  if (/ضعف|تدهور|غشاوة|شبكية/.test(vision)) {
    out.push({ key: 'vision', tone: 'rose', text: 'مشكلة في الرؤية — مراجعة طب العيون ضرورية' })
  }
  if (/فشل|مؤشر|عالي|مرتفع/.test(kidney)) {
    out.push({ key: 'kidney', tone: 'rose', text: 'وظائف الكلى تحتاج متابعة — تحاليل الكرياتينين' })
  }
  if (bp && bp.cls === 'rose') {
    out.push({ key: 'bp', tone: 'amber', text: 'ضغط الدم مرتفع — متابعة الضغط مع السكري' })
  }
  return out
}

/* ------------------------------------------------------------
   مستوى الخطورة الإجمالي للمريض السكري
   ------------------------------------------------------------ */
export function endocrineRiskLevel(data) {
  const alerts = endocrineAlerts(data)
  if (alerts.some((a) => a.tone === 'rose')) return { level: 'high', label: 'خطورة عالية', cls: 'rose' }
  if (alerts.length > 0) return { level: 'mid', label: 'خطورة متوسطة', cls: 'amber' }
  return { level: 'low', label: 'مستقر', cls: 'emerald' }
}

/* ------------------------------------------------------------
   تحويل السكر التراكمي إلى متوسط سكر تقريبي (eAG)
   ------------------------------------------------------------ */
export function hba1cToGlucose(hba1c) {
  const h = Number(hba1c)
  if (!Number.isFinite(h)) return null
  return Math.round(28.7 * h - 46.7)
}

/* ------------------------------------------------------------
   تصفح تاريخ قراءات السكر — آخر قراءة لكل مريض
   ------------------------------------------------------------ */
export function latestGlucose(visits) {
  for (const v of (visits || []).slice()) {
    const sd = v.specialty_data?.endocrine
    if (sd && sd.blood_glucose) return { ...sd, _visit: v }
  }
  return null
}

/* ------------------------------------------------------------
   كتالوج افتراضي لإجراءات الغدد والسكري (Defaut catalog)
   ------------------------------------------------------------ */
export const ENDOCRINE_DEFAULT_CATALOG = [
  {
    category: 'الفحص والمتابعة',
    items: [
      { treatment: 'كشف سكري وغدد', price: 0, color: 'var(--p600)' },
      { treatment: 'متابعة سكر الدم', price: 0, color: 'var(--p500)' },
      { treatment: 'فحص الغدة الدرقية', price: 0, color: '#0ea5e9' },
      { treatment: 'فحص الأقدام السكري', price: 0, color: '#f97316' },
      { treatment: 'استشارة سكري', price: 0, color: '#64748b' },
    ],
  },
  {
    category: 'الفحوصات المعملية',
    items: [
      { treatment: 'سكر الصيام', price: 0, color: '#10b981' },
      { treatment: 'السكر التراكمي HbA1c', price: 0, color: '#f59e0b' },
      { treatment: 'كرياتينين/BUN', price: 0, color: '#06b6d4' },
      { treatment: 'ملف الدهون', price: 0, color: '#ec4899' },
      { treatment: 'فحص وظائف الغدة الدرقية', price: 0, color: '#6366f1' },
    ],
  },
  {
    category: 'الأدوية الشائعة',
    items: [
      { treatment: 'مترفورمين', price: 0, color: '#16a34a' },
      { treatment: 'إنسولين', price: 0, color: '#dc2626' },
      { treatment: 'غلوكوفاج', price: 0, color: '#2563eb' },
      { treatment: 'ليفيتيروكسين', price: 0, color: '#7c3aed' },
    ],
  },
]

export const ENDOCRINE_CLINIC_ID = 'a3f8c210-4b67-4e9a-b3d1-5c7e9f2a8b14'

export const ENDOCRINE_SHORT_CLINIC_NAME = 'د. رندة الشيخ علي'

export function isEndocrineClinic(profile) {
  return !!profile?.clinic_id && profile.clinic_id === ENDOCRINE_CLINIC_ID
}
