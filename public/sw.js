// Service Worker — نظام إدارة العيادة: استقبال إشعارات طلبات المواعيد الواردة
// + تشغيل صوت النظام (إشعار غير صامت) وإعادة التنبيه للعميل إن كان التطبيق مفتوحاً
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'نظام إدارة العيادة', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'نظام إدارة العيادة'
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || undefined,
    // صوت نظام خارجي: الإشعار غير صامت + أولوية عالية
    silent: false,
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/reception/appointments' },
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // إن كان التطبيق مفتوحاً: أبلِغ الصفحة لتشغيل النغمة الداخلية أيضاً
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const client of list) client.postMessage({ type: 'clinic-alert', kind: data.kind || 'new', title, body: data.body || '' })
      }),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/reception/appointments'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
