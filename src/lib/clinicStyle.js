// ============================================================
// أسلوب عرض العيادات التي تطلب نفس واجهات الدكتور نizar:
//   - جدول المواعيد (عرض القائمة كاملة والشريط تحتها)
//   - الأرشيف (أوراق المعاينة)
//   - واجهة «أوقات دوامي» مربوطة بالمواعيد
//   - حقل العمر رقمياً عند إضافة مريض
// عيادة د. نizar نفسها يحددها clinic_settings.prescription_template = 'nizar'
// أما العيادات الأخرى فتُضاف بمعرّف عيادتها هنا.
// ============================================================

// عيادة د. ريام نصر عبد الرحمن — نفس أسلوب العرض والطريقة
const NIZAR_STYLE_CLINICS = {
  '9d7fd606-4635-4533-b59c-6a67b3d722ee': 'عيادة د. ريام نصر عبد الرحمن',
}

export const clinicIdOf = (profile) => profile?.clinic_id || profile?.clinic?.id || null

// هل هذه العيادة تُعرض بأسلوب الدكتور نizar؟
export function isNizarStyle(profile, settings) {
  if (settings?.prescription_template === 'nizar') return true
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && NIZAR_STYLE_CLINICS[clinicId])
}
