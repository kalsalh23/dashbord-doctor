// ============================================================
// أسلوب عرض العيادات التي تطلب نفس واجهات الدكتور نizar:
//   - جدول المواعيد (عرض القائمة كاملة والشريط تحتها)
//   - الأرشيف (أوراق المعاينة)
//   - واجهة «أوقات دوامي» مربوطة بالمواعيد
//   - حقل العمر رقمياً عند إضافة مريض
// عيادة د. نizar نفسها يحددها clinic_settings.prescription_template = 'nizar'
// أما العيادات الأخرى فتُضاف بمعرّف عيادتها هنا.
// ============================================================

/* ============================================================
 * لوحة الألوان — لكل عيادة لوحتها (اللون فقط، بلا أي تغيير في الواجهات)
 * الافتراضي: برقوقي/موف أنيق · عيادتا د. عارف ود. نزار تحتفظان بالفيروزي
 * ============================================================ */
const LEGACY_THEME_CLINICS = {
  '0015c9f9-c90e-496e-a65b-2ad04a85be8e': 'عيادة د. محمد عارف عبد الرحمن',
  '7f521b29-25f7-45c0-a3db-1f5146698062': 'عيادة د. نزار عبد الستار الشيخ',
}

/** صنف CSS للّوحة: 'clinic-theme-legacy' للعيادة التي تحتفظ بلونها القديم */
export const clinicThemeClass = (profile) =>
  profile?.clinic_id && LEGACY_THEME_CLINICS[profile.clinic_id] ? 'clinic-theme-legacy' : ''

/* ============================================================
 * لوحة ألوان عيادة الدكتورة فاطمة سالم الجاموس — ألوان فريدة لها وحدها
 * ============================================================ */
export const FATIMA_CLINIC_ID = 'f17b6085-7a49-453a-b4b7-49feb5c6a601'

const FATIMA_THEME_CLINICS = {
  [FATIMA_CLINIC_ID]: 'عيادة الدكتورة فاطمة سالم الجاموس',
}

/** صنف CSS للوحة عيادة الدكتورة فاطمة */
export const clinicFatimaThemeClass = (profile) =>
  profile?.clinic_id && FATIMA_THEME_CLINICS[profile.clinic_id] ? 'clinic-theme-fatima' : ''

/** هل هذه العيادة هي عيادة الدكتورة فاطمة؟ */
export function isFatimaClinic(profile) {
  return !!profile?.clinic_id && FATIMA_THEME_CLINICS[profile.clinic_id]
}

/**
 * الاسم المختصر لعيادة الدكتورة فاطمة — يظهر في الشريط العلوي على الجوال
 * لأن الاسم الكامل («عيادة الدكتورة فاطمة سالم الجاموس») طويل فيملأ
 * الشريط ويقصّ أزرار الإشعارات والحساب على شاشات الجوال.
 */
export const FATIMA_SHORT_CLINIC_NAME = 'د. فاطمة الجاموس'

/* ============================================================
 * لوحة ألوان عيادة الدكتورة فدوى الرحال — لافندر بنفسجي فاتح أنثوي
 * لوحة خاصة بعيادتها وحدها (لا تؤثر على أي عيادة أخرى)
 * ============================================================ */
export const FADWA_CLINIC_ID = 'e0dc2fa8-9fc7-475c-b2e1-2d569f32b2b0'

const FADWA_THEME_CLINICS = {
  [FADWA_CLINIC_ID]: 'عيادة الدكتورة فدوى الرحال',
}

/** صنف CSS للوحة عيادة الدكتورة فدوى */
export const clinicFadwaThemeClass = (profile) =>
  profile?.clinic_id && FADWA_THEME_CLINICS[profile.clinic_id] ? 'clinic-theme-fadwa' : ''

/** هل هذه العيادة هي عيادة الدكتورة فدوى؟ */
export function isFadwaClinic(profile) {
  return !!profile?.clinic_id && !!FADWA_THEME_CLINICS[profile.clinic_id]
}

/* ============================================================
 * ترتيب واجهات عيادة الدكتورة فاطمة — ترتيب فريد لها وحدها
 * (يُطبّق في Layout.jsx مباشرة لأهمية الأيقونات)
 * ============================================================ */
export const FATIMA_DOCTOR_NAV_ORDER = [
  '/doctor',
  '/doctor/schedule',
  '/doctor/hours',
  '/doctor/patients',
  '/doctor/archive',
  '/doctor/expenses',
  '/doctor/today-log',
  '/doctor/payments',
  '/doctor/favorites',
  '/doctor/settings',
]

/* ============================================================
 * زر «تبديل الحساب» — لا حاجة له في عيادة د. نزار ولا عيادة د. فاطمة
 * (لكل عيادة حساباتها المنفصلة ولا تنتقل بين practitioners)
 * ============================================================ */
const NO_ACCOUNT_SWITCH_CLINICS = {
  '7f521b29-25f7-45c0-a3db-1f5146698062': 'عيادة د. نزار عبد الستار الشيخ',
  [FATIMA_CLINIC_ID]: 'عيادة الدكتورة فاطمة سالم الجاموس',
}

/** هل يُخفى زر تبديل الحساب في هذه العيادة؟ */
export const hidesAccountSwitcher = (profile) =>
  !!profile?.clinic_id && NO_ACCOUNT_SWITCH_CLINICS[profile.clinic_id]

// عيادة د. ريام نصر عبد الرحمن — نفس أسلوب العرض والطريقة
const NIZAR_STYLE_CLINICS = {
  '9d7fd606-4635-4533-b59c-6a67b3d722ee': 'عيادة د. ريام نصر عبد الرحمن',
  '0015c9f9-c90e-496e-a65b-2ad04a85be8e': 'عيادة د. محمد عارف عبد الرحمن',
}

// عيادات لا تحتاج واجهة «المرضى» — تعتمد على الأرشيف والمواعيد فقط
const NO_PATIENTS_PAGE_CLINICS = {
  '9d7fd606-4635-4533-b59c-6a67b3d722ee': 'عيادة د. ريام نصر عبد الرحمن',
  '0015c9f9-c90e-496e-a65b-2ad04a85be8e': 'عيادة د. محمد عارف عبد الرحمن',
  '7f521b29-25f7-45c0-a3db-1f5146698062': 'عيادة د. نزار عبد الستار الشيخ',
  [FADWA_CLINIC_ID]: 'عيادة الدكتورة فدوى الرحال',
}

/* ============================================================
 * واجهة «مواعيدي» بأسلوب موحّد (مواعيد الجارية فقط — بلا تبويب
 * «قيد الكشف» ولا «المنتهية» — وأزرار مرتبة بمقاس واحد):
 *   عيادة د. فاطمة سالم الجاموس وعيادة د. فدوى الرحال
 * ============================================================ */
export function usesSimpleAppointments(profile) {
  return !!(isFatimaClinic(profile) || isFadwaClinic(profile))
}

/* ============================================================
 * أسلوب عرض الأرشيف
 *   افتراضي: أوراق المعاينة (قالب نزار)
 *   عيادة د. نزار: بطاقات مثل عيادة د. عارف — مع بقاء قالب وصفته كما هو
 * ============================================================ */
const CARD_ARCHIVE_CLINICS = {
  '7f521b29-25f7-45c0-a3db-1f5146698062': 'عيادة د. نزار عبد الستار الشيخ',
}

/** هل يُعرض الأرشيف بطريقة البطاقات (أسلوب عيادة د. عارف)؟ */
export const usesCardArchive = (profile) =>
  !!profile?.clinic_id && CARD_ARCHIVE_CLINICS[profile.clinic_id]

// عيادات يظهر جدول مواعيدها بنفس التصميم (القائمة كاملة والأيام تحتها)
//   — عيادة د. عارف وهي التي اتُّخذت مرجعاً للتصميم، وعيادة د. ريام جُعلت مطابقةً لها
const WIDE_SCHEDULE_CLINICS = {
  '0015c9f9-c90e-496e-a65b-2ad04a85be8e': 'عيادة د. محمد عارف عبد الرحمن',
  '9d7fd606-4635-4533-b59c-6a67b3d722ee': 'عيادة د. ريام نصر عبد الرحمن',
}

// عيادات يُدخل فيها عمر المريض رقماً (بدل تاريخ الميلاد) عند الإضافة
const NUMERIC_AGE_CLINICS = {
  '0015c9f9-c90e-496e-a65b-2ad04a85be8e': 'عيادة الدكتور محمد عارف عبد الرحمن',
}

// عيادات لا تحتاج واجهة «أدويتي الشائعة» — تستبدلها بـ«أوقات دوامي»
const NO_FAVORITES_CLINICS = {
  '0015c9f9-c90e-496e-a65b-2ad04a85be8e': 'عيادة د. محمد عارف عبد الرحمن',
}

export const clinicIdOf = (profile) => profile?.clinic_id || profile?.clinic?.id || null

// هل هذه العيادة تُعرض بأسلوب الدكتور نizar؟
export function isNizarStyle(profile, settings) {
  if (settings?.prescription_template === 'nizar') return true
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && NIZAR_STYLE_CLINICS[clinicId])
}

// هل يُخفى واجهة «المرضى» من قائمة هذه العيادة؟
export function hidesPatientsPage(profile) {
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && NO_PATIENTS_PAGE_CLINICS[clinicId])
}

// هل يظهر جدول المواعيد بأسلوب «القائمة كاملة + الأيام تحتها» (نفس واجهة د. ريام)؟
export function usesWideSchedule(profile, settings) {
  if (settings?.prescription_template === 'nizar') return true
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && WIDE_SCHEDULE_CLINICS[clinicId])
}

// هل يُدخل عمر المريض رقماً في هذه العيادة؟ (نفس سلوك عيادة د. نزار)
export function usesNumericAge(profile, settings) {
  if (isNizarStyle(profile, settings)) return true
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && NUMERIC_AGE_CLINICS[clinicId])
}

// هل تُخفى واجهة «أدويتي الشائعة» من هذه العيادة؟ (تُستبدل بـ«أوقات دوامي»)
export function hidesFavorites(profile) {
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && NO_FAVORITES_CLINICS[clinicId])
}

/* ============================================================
 * عيادات تُثبّت فيها أشكال العلاجات والمشكلات السابقة على الأسنان:
 * الشكل يبقى مرسوماً على السن في كل زيارة قادمة (حتى يعرف الطبيب
 * الأسنان التي عولجت)، ويمكن إزالة العلامة لاحقاً من نافذة السن.
 * ============================================================
 */
const PERSIST_DENTAL_SHAPES_CLINICS = {
  '0015c9f9-c90e-496e-a65b-2ad04a85be8e': 'عيادة الدكتور محمد عارف عبد الرحمن',
}

/** هل تبقى أشكال العلاجات السابقة مرسومة على الأسنان في هذه العيادة؟ (عيادة د. عارف) */
export function persistsDentalShapes(profile) {
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && PERSIST_DENTAL_SHAPES_CLINICS[clinicId])
}

/* ============================================================
 * عيادات تنبيهاتها الصوتية عالية وطويلة — تصلح لصالات العيادات الصاخبة:
 * نغمة أطول حجماً وأمداً عند وصول أي إشعار (حجز موعد، رسالة، حالة إسعافية).
 * ============================================================
 */
const LOUD_ALERT_CLINICS = {
  '0015c9f9-c90e-496e-a65b-2ad04a85be8e': 'عيادة الدكتور محمد عارف عبد الرحمن',
  '9d7fd606-4635-4533-b59c-6a67b3d722ee': 'عيادة الدكتورة ريام نصر عبد الرحمن',
}

/** هل نغمة التنبيه في هذه العيادة عالية وطويلة؟ */
export function usesLoudAlerts(profile) {
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && LOUD_ALERT_CLINICS[clinicId])
}

/* ============================================================
 * عيادات تُطلب فيها الدفعة مباشرة عند حفظ الكشف:
 * تظهر بطاقة الدفعة بعد الضغط على «حفظ الكشف» — يُدخل المبلغ بين صفر
 * وسعر الكشفية من الإعدادات، ويُحفظ باسم المريض كدفعة على حسابه.
 * ============================================================
 */
const PROMPT_PAYMENT_CLINICS = {
  '9d7fd606-4635-4533-b59c-6a67b3d722ee': 'عيادة الدكتورة ريام نصر عبد الرحمن',
}

/** هل تظهر بطاقة الدفعة عند حفظ الكشف في هذه العيادة؟ */
export function requiresPaymentPrompt(profile) {
  const clinicId = clinicIdOf(profile)
  return !!(clinicId && PROMPT_PAYMENT_CLINICS[clinicId])
}
