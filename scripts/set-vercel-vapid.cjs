// set-vercel-vapid.cjs — يُزامن أسرار VAPID في Vercel مع زوج المفاتيح
// المستخدم في المتصفح (vapid-keys.json). كان زوج Vercel مختلفاً عن زوج
// المتصفح/الدالة الحافّة، فترفض خدمة الدفع الإشعار (400/401).
// الاستخدام: node scripts/set-vercel-vapid.cjs
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const vapid = JSON.parse(fs.readFileSync(path.join(ROOT, 'vapid-keys.json'), 'utf8'))

const run = (args, input) =>
  execFileSync('cmd', ['/c', 'vercel', ...args], {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()

const pair = {
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_PUBLIC_KEY_CLIENT: vapid.publicKey,
  VAPID_SUBJECT: vapid.subject,
};

for (const [name, value] of Object.entries(pair)) {
  try {
    run(['env', 'rm', name, 'production', '--yes'])
  } catch {
    /* قد لا يكون معرّفاً — لا مشكلة */
  }
  try {
    run(['env', 'add', name, 'production'], value)
    console.log(`OK: ${name} set (prefix ${value.slice(0, 12)}…)`)
  } catch (e) {
    console.error(`FAILED ${name}:`, e.stderr || e.message)
    process.exitCode = 1
  }
}
