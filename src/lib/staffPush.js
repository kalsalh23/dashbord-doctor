import { supabase } from '../lib/supabase'

const VAPID_PUBLIC = "BDjrzN-LXGS6IPdDzik3QocWZWqSnJPucfY7Z0wtKjdUXFbpOjiB8jiVsQYAa47jQ8hFHiJi_61N2IYfNHn0MPQ" || import.meta.env.VAPID_PUBLIC_KEY_CLIENT

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
    if (existing) await existing.unsubscribe()
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return 'error'

    // من هذا الجهاز نحتاج معرفة المستخدم وعيادته ودوره لتوجيه الإشعارات
    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('id, role, clinic_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single()
    if (pErr || !prof) return 'error'

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: prof.id,
          clinic_id: prof.clinic_id,
          role: prof.role,
          endpoint: j.endpoint,
          p256dh: j.keys.p256dh,
          auth: j.keys.auth,
        },
        { onConflict: 'endpoint' }
      )
    if (error) return 'error'
    return 'ok'
  } catch {
    return 'error'
  }
}
