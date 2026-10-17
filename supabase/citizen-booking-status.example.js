// ============================================================
// ملف جاهز للصق في مشروع منصة دليل طيبة (dalil-altaybeh):
//   hooks/useBookingStatus.js  (أو داخل صفحة «حجوزاتي»)
//
// إشعار المواطن — مجاني 100% داخل المتصفح بلا خدمات خارجية:
//   1) استقصاء ( polling ) كل 15 ثانية لنقطة الحالة في نظام العيادة
//   2) عند تغيّر الحالة (قبول/رفض) يُعرض:
//        • إشعار خارجي: Notification API (يظهر خارج التبويب/سطح المكتب)
//        • إشعار داخلي: قائمة/جرس الإشعارات في التطبيق نفسه
//
// المطلوب من المنصة: استدعاء useBookingStatus(platformRef) في صفحة
// «حجوزاتي» أو «تتبع طلبي»، ثم عرض status في الواجهة.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'

const CLINIC_STATUS_URL = 'https://dashboard-doctor.vercel.app/api/bridge-request-status'
const BRIDGE_SECRET = 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'
const POLL_MS = 15000

// جرس الإشعارات الداخلي — يُحدَّث بالحالة الجديدة (لإظهار شارة داخل التطبيق)
export function useBookingStatus(platformRef) {
  const [status, setStatus] = useState('pending') // pending | new | confirmed | rejected | not_found
  const [data, setData] = useState(null)
  const seenRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    if (!platformRef) return
    try {
      const r = await fetch(
        `${CLINIC_STATUS_URL}?secret=${encodeURIComponent(BRIDGE_SECRET)}&platform_ref=${encodeURIComponent(platformRef)}`,
      )
      const j = await r.json()
      if (!j || j.error) {
        if (j?.error === 'not_found') setStatus('not_found')
        return
      }
      const s = j.status || 'new'
      setData(j)

      // تغيّر الحالة → إشعار مجاني للمواطن
      if (seenRef.current !== null && s !== seenRef.current) {
        if (s === 'confirmed') {
          notifyCitizen(
            'تم تأكيد حجزك ✅',
            j.appointment
              ? `موعدك يوم ${j.appointment.appointment_date} الساعة ${j.appointment.start_time}`
              : 'تم قبول طلب الحجز — تفقّد حجوزاتك',
          )
        } else if (s === 'rejected') {
          notifyCitizen('لم يُقبل طلب الحجز', 'يرجى اختيار وقت آخر أو مراسمة العيادة')
        }
      }
      seenRef.current = s
      setStatus(s)
    } catch {
      /* الشبكة غير متاحة — يُعاد المحاولة في الدورة التالية */
    }
  }, [platformRef])

  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, POLL_MS)
    const onFocus = () => fetchStatus()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchStatus])

  return { status, data }
}

// إشعار خارجي مجاني عبر المتصفح (Web Notifications) — يظهر حتى والتبويب مغلق جزئياً
export async function notifyCitizen(title, body, onClickUrl = '/bookings') {
  // جرس داخلي: يُطلق حدثاً تسمعه الواجهة ليعرض شارة الإشعارات
  window.dispatchEvent(new CustomEvent('citizen-notification', { detail: { title, body } }))

  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') {
      const n = new Notification(title, {
        body,
        dir: 'rtl',
        lang: 'ar',
        icon: '/favicon.svg',
        tag: 'booking-status',
      })
      n.onclick = () => {
        window.focus()
        if (onClickUrl) window.location.href = onClickUrl
      }
      return
    }
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') notifyCitizen(title, body, onClickUrl)
    }
  } catch {
    /* المتصفح لا يدعم إشعارات الويب — الجرس الداخلي يكفي */
  }
}

// استخدم في صفحة حجوزاتي:
//   const { status } = useBookingStatus(platformRef)
//   {status === 'confirmed' && <span className="badge-green">مؤكد</span>}
//   {status === 'rejected'  && <span className="badge-red">مرفوض</span>}
