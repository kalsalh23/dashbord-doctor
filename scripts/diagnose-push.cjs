// الاختبار المحكم — مفاتيح P-256 صحيحة (65 بايت مع بادئة 0x04)
const fs = require('fs');
const crypto = require('crypto');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y25vYm1tcnF1amhnYmhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzE3ODYsImV4cCI6MjEwNjQ0Nzc4Nn0.frRWMUU5BpN3CdLa_dqFopHJgv4QG3pfp2Tu1VtIF_Y';
const BASE = 'https://lucnobmmrqujhgbhmciz.supabase.co';
const FN = BASE + '/functions/v1/send-push';
const CLINIC = 'feae3070-7837-4f7d-9353-b7139784d229';
const SECRET = 'PUSH_SECRET_3710e77462498c88717aa769';
const j = JSON.parse(fs.readFileSync('mazen-auth.json', 'utf8'));
const H = { apikey: KEY, Authorization: 'Bearer ' + j.access_token, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function validKeys() {
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const b = (s) => Buffer.from(s, 'base64');
  return {
    p256dh: Buffer.concat([Buffer.from([4]), b(jwk.x), b(jwk.y)]).toString('base64url'),
    auth: crypto.randomBytes(16).toString('base64url'),
  };
}
async function plant(tag) {
  const r = await fetch(BASE + '/rest/v1/push_subscriptions', {
    method: 'POST', headers: H,
    body: JSON.stringify({ user_id: j.user.id, clinic_id: CLINIC, role: 'doctor', endpoint: 'https://fcm.googleapis.com/fcm/send/deadprobe' + tag, ...validKeys() }),
  });
  if (!r.ok) throw new Error('plant ' + tag + ': ' + (await r.text()).slice(0, 200));
}
async function exists(tag) {
  const rows = await (await fetch(BASE + '/rest/v1/push_subscriptions?select=id&endpoint=eq.' + encodeURIComponent('https://fcm.googleapis.com/fcm/send/deadprobe' + tag), { headers: H })).json();
  return rows.length > 0;
}

(async () => {
  // ب) الدالة مباشرة بالسر الصحيح
  await plant('B3');
  const d = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-push-secret': SECRET },
    body: JSON.stringify({ clinicId: CLINIC, targetRole: 'doctor', title: 't', body: 'x' }),
  });
  console.log('B) DIRECT fn ->', d.status, await d.text());
  await sleep(2500);
  console.log('B) row:', (await exists('B3')) ? 'BAQI => VAPID al-damla mukhtalif/an violated' : 'HOTHIFA => damla + VAPID shaghlin');

  // ج) المشغل عبر إدراج إشعار
  await plant('C3');
  const n = await fetch(BASE + '/rest/v1/notifications', {
    method: 'POST', headers: H,
    body: JSON.stringify({ clinic_id: CLINIC, target_role: 'doctor', title: 'probe trigger', body: 'x' }),
  });
  console.log('C) NOTIFICATION ->', n.status);
  await sleep(8000);
  console.log('C) row:', (await exists('C3')) ? 'BAQI => AL-TRIGGER LA YAAMAL' : 'HOTHIFA => al-trigger yaamal w al-sir sahih');
})().catch((e) => console.error('ERR', e.message));
