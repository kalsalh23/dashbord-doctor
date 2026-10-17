// test-vapid.cjs — اختبار نهائي: هل زوج مفاتيح VAPID يقبله خادم الدفع؟
//   • 404/410/400 على نهاية وهمية => المفاتيح مقبولة ✅ (النطــقة فقط غير موجودة)
//   • 401/403 => المفاتيح مرفوضة ❌ (عدم تطابق الزوج)
// الاستخدام: node scripts/test-vapid.cjs
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const wp = require(path.join(ROOT, 'node_modules', 'web-push'))
const vapid = JSON.parse(fs.readFileSync(path.join(ROOT, 'vapid-keys.json'), 'utf8'))

// اشتراك اختباري بمفاتيح صالحة الشكل (65 بايت مع بادئة 0x04)
const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = publicKey.export({ format: 'jwk' })
const b = (s) => Buffer.from(s, 'base64')

const sub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-probe-' + Date.now(),
  keys: {
    p256dh: Buffer.concat([Buffer.from([4]), b(jwk.x), b(jwk.y)]).toString('base64url'),
    auth: crypto.randomBytes(16).toString('base64url'),
  },
}

const payload = JSON.stringify({ title: 'اختبار', body: 'فحص المفاتيح' })

;(async () => {
  try {
    await wp.sendNotification(sub, payload, {
      vapidDetails: {
        subject: vapid.subject,
        publicKey: vapid.publicKey,
        privateKey: vapid.privateKey,
      },
      TTL: 60,
    })
    console.log('RESULT: sent (unexpected for a fake endpoint)')
  } catch (e) {
    const code = e?.statusCode || 0
    if (code === 401 || code === 403) {
      console.log(`RESULT: REJECTED VAPID (${code}) — المفاتيح غير متطابقة ❌`)
    } else if (code === 404 || code === 410) {
      console.log(`RESULT: VAPID ACCEPTED (${code} = endpoint not found, expected) ✅`)
    } else if (code === 400) {
      console.log(`RESULT: VAPID ACCEPTED (400 = payload rejected, keys signed OK) ✅`)
    } else {
      console.log(`RESULT: inconclusive code=${code} msg=${String(e?.message || e).slice(0, 120)}`)
    }
  }
})()
