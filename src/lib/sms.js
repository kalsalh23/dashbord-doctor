// ============================================================
// إرسال SMS مجاني 100% — بلا أي اشتراك أو بوابة مدفوعة
// الطريقة: فتح تطبيق الرسائل الأصلي في الهاتف عبر رابط sms:
//   • لا تكلفة: تستخدم رصيد/باقة رسائل الهاتف نفسها
//   • بلا إنترنت: خدمة الرسائل تعمل عبر شبكة المشغّل
//   • تعمل على أندرويد و iOS ومن أي هاتف
// ============================================================

/** رقم واحد بصيغة مناسبة لرابط sms: (يُفضّل المحلي ليعمل على نفس الشبكة) */
export function smsNumber(phone) {
  let p = String(phone || '').replace(/[^\d+]/g, '')
  if (!p) return ''
  if (p.startsWith('+')) return p.slice(1)
  if (p.startsWith('00')) p = p.slice(2)
  return p
}

/** رابط رسالة واحدة: يفتح تطبيق الرسائل بالرقم والنص جاهزين */
export function smsHref(phone, body) {
  const n = smsNumber(phone)
  if (!n) return ''
  return `sms:${n}?body=${encodeURIComponent(body || '')}`
}

/** رابط رسالة جماعية: يفتح تطبيق الرسائل بكل الأرقام والنص نفسه (يدعمها أندرويد) */
export function smsBulkHref(phones, body) {
  const nums = (phones || []).map(smsNumber).filter(Boolean)
  if (nums.length === 0) return ''
  return `sms:${nums.join(',')}?body=${encodeURIComponent(body || '')}`
}

/** عدد شرائح الرسالة (160 لاتيني / 70 عربي) — ليعرف الطبيب إن طالت */
export function smsSegments(text) {
  const t = String(text || '')
  if (!t) return 0
  const isUnicode = /[^\x00-\x7F]/.test(t)
  const per = isUnicode ? 70 : 160
  return Math.ceil(t.length / per)
}

/** هل الرسالة داخل شريحة واحدة؟ */
export const isSingleSegment = (text) => smsSegments(text) <= 1
