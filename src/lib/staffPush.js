import { supabase } from '../lib/supabase'

const VAPID_PUBLIC = import.meta.env.VAPID_PUBLIC_KEY_CLIENT || 'BERjrZV05Z5fDHC62Q5uTnuOQxbNzjwTlQa29gU97KIEsuJ68bwAS-HxJIkvu3YO_v6idMDN-v2zS1wAdSND7Wc'

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** تفعيل الإشعارات الخارجية لموظف العيادة: طلب الإذن + تسجيل الاشتراك في قاعدة العيادة */
export async function subscribeStaffPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    }))
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return 'error'

    const { data, error } = await supabase.rpc('staff_push_register', {
      p_endpoint: j.endpoint,
      p_p256dh: j.keys.p256dh,
      p_auth: j.keys.auth,
    })
    if (error || !data?.ok) return 'error'
    return 'ok'
  } catch {
    return 'error'
  }
}
