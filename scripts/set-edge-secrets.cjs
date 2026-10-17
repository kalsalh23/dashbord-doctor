// set-edge-secrets.cjs — يُزامن أسرار دوال Supabase الحافّة (send-push)
// مع مفاتيح VAPID المخزّنة في vapid-keys.json و push-secret.txt
// حتى يطابق المفتاح ما يستخدمه المتصفح في staffPush.js.
// الاستخدام: SUPA_MGT_TOKEN=<token> node scripts/set-edge-secrets.cjs
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const REF = 'lucnobmmrqujhgbhmciz'
const TOKEN = process.env.SUPA_MGMT_TOKEN
if (!TOKEN) {
  console.error('usage: SUPA_MGMT_TOKEN=<token> node scripts/set-edge-secrets.cjs')
  process.exit(1)
}

const vapid = JSON.parse(fs.readFileSync(path.join(ROOT, 'vapid-keys.json'), 'utf8'))
const pushSecret = fs.readFileSync(path.join(ROOT, 'push-secret.txt'), 'utf8').trim()

const secrets = [
  { name: 'VAPID_PUBLIC_KEY', value: vapid.publicKey },
  { name: 'VAPID_PRIVATE_KEY', value: vapid.privateKey },
  { name: 'VAPID_SUBJECT', value: vapid.subject },
  { name: 'PUSH_SECRET', value: pushSecret },
];

(async () => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(secrets),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text.slice(0, 500)}`)
    process.exit(1)
  }
  console.log('OK: edge secrets set =', secrets.map((s) => s.name).join(', '))
  console.log('   VAPID_PUBLIC_KEY prefix =', vapid.publicKey.slice(0, 12) + '…')
})().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
