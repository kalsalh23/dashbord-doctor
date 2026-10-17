// ============================================================
// دالة جاهزة للصق في مشروع منصة «دليلك الطبي» (dalil-altaybeh)
// تتعامل مع ردّ جسر الحجز وتُظهر رسالة المواطن بدل «حدث خطأ حاول مجدداً»
//
// الرد القادم من نظام العيادة (dashbord-doctor):
//   نجاح:  { ok: true,  inbox: true, notified: 1 }
//   مرفوض: { ok: false, error: "يتعذر الحجز — لديك حجز مسبق في نفس اليوم …",
//             code: "ALREADY_BOOKED", status: "rejected", pending: false }
// ============================================================

const BRIDGE_URL = 'https://dashbord-doctor.vercel.app/api/bridge-appointment'
const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'

/** استخراج رسالة المواطن من أي شكل رد (حتى لو غُيّرت الحقول لاحقاً) */
export function extractBridgeMessage(body) {
  if (!body) return null
  const direct = body.error || body.message || body.msg || body.user_message || body.detail || body.description || body.reason
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  if (typeof body === 'string' && body.trim()) return body.trim()
  return null
}

/** هل الرد نجاح؟ (نعتبره نجاحاً فقط عند ok/success صريح) */
export function isBridgeOk(body) {
  if (!body) return false
  if (body.ok === true || body.success === true || body.booked === true) return true
  if (body.status === 'confirmed' || body.status === 'new' || body.status === 'pending') return true
  return false
}

/**
 * إرسال طلب الحجز — تُستخدم في صفحة/مودال الحجز في المنصة
 * تُرجع { ok, message, code } — والرسالة جاهزة للعرض للمواطن فوراً
 */
export async function submitBookingRequest(payload) {
  let body = null
  try {
    const r = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-secret': BRIDGE_SECRET },
      body: JSON.stringify(payload),
    })
    try { body = await r.json() } catch (e) { body = null }
  } catch (e) {
    return { ok: false, code: 'NETWORK', message: 'تعذّر الاتصال بالخدمة — تحقّق من الإنترنت وحاول مجدداً' }
  }

  if (isBridgeOk(body)) {
    return { ok: true, code: 'BOOKED', message: body?.message || 'تم إرسال طلب الحجز — سيتم تأكيده من العيادة', data: body }
  }
  // رفض: نُظهر رسالة النظام الواضحة (مثل: يتعذر الحجز — لديك حجز مسبق في نفس اليوم)
  return {
    ok: false,
    code: body?.code || 'REJECTED',
    message: extractBridgeMessage(body) || 'تعذّر إتمام الحجز — راجع العيادة',
    pending: !!body?.pending,
    data: body,
  }
}

// ============================================================
// مثال استعمال في صفحة الحجز (React):
//
//   const [busy, setBusy] = useState(false)
//   const [notice, setNotice] = useState(null)
//
//   async function onSubmit(form) {
//     setBusy(true)
//     const res = await submitBookingRequest({
//       platform_ref: crypto.randomUUID(),
//       patient_name: form.name,
//       patient_phone: form.phone,
//       requested_date: form.date,        // YYYY-MM-DD
//       day_label: form.dayLabel,         // «الأحد»
//       preferred_time: form.time,        // «18:00»
//       note: form.note || '',
//       clinic_id: form.clinicId,
//       doctor_name: form.doctorName,
//     })
//     setBusy(false)
//     setNotice({ ok: res.ok, text: res.message })   // ← الرسالة تظهر للمواطن كما هي
//     if (res.ok) { /* انتقل لصفحة «حجوزاتي» */ }
//   }
//
//   {/* عرض الرسالة */}
//   {notice && (
//     <div className={notice.ok ? 'banner-green' : 'banner-red'} dir="rtl">
//       {notice.text}
//     </div>
//   )}
// ============================================================
