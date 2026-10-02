const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const keys = JSON.parse(fs.readFileSync(path.join(ROOT, 'vapid-keys.json'), 'utf8'));
const secret = fs.readFileSync(path.join(ROOT, 'push-secret.txt'), 'utf8');
const NEW_PW = 'Kosaia' + Math.floor(100000 + Math.random() * 900000) + '#';

fs.writeFileSync(path.join(ROOT, 'apply-pw.query'),
  `update auth.users set encrypted_password = crypt('${NEW_PW}', gen_salt('bf')), updated_at = now() where email = 'kosaialsalh1@gmail.com';`);

// keep a local (untracked) recovery file for the owner
fs.writeFileSync(path.join(ROOT, 'credentials-private.txt'),
  `حساب مالك النظام\nالبريد: kosaialsalh1@gmail.com\nكلمة المرور الجديدة: ${NEW_PW}\n\n(VAPID public): ${keys.publicKey}\n(PUSH_SECRET): ${secret}\n`);

// also print it so it lands in this conversation
console.log('NEW_OWNER_PASSWORD:', NEW_PW);
console.log('NEW_VAPID_PUBLIC:', keys.publicKey.slice(0, 24) + '...');
