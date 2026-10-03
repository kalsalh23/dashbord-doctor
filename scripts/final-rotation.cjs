const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GIT = 'C:/Users/DELL/tools/cmd/git.exe';
const exec = (cmd) => { try { return execSync(cmd, { cwd: ROOT, stdio: 'pipe' }).toString().trim(); } catch { return 'ERR'; } };

// 1) untrack secret files permanently
for (const f of ['vapid-keys.json', 'push-secret.txt']) {
  console.log('untrack:', exec(`"${GIT}" rm --cached ${f}`).slice(0, 40));
}

// 2) rotate VAPID + PUSH_SECRET (final values, kept untracked on disk)
const wp = require('web-push');
const newKeys = wp.generateVAPIDKeys();
const newSecret = 'PUSH_SECRET_' + require('crypto').randomBytes(12).toString('hex');
fs.writeFileSync(path.join(ROOT, 'vapid-keys.json'), JSON.stringify({ ...newKeys, subject: 'mailto:kosaialsalh1@gmail.com' }, null, 1));
fs.writeFileSync(path.join(ROOT, 'push-secret.txt'), newSecret);

// 3) push new secrets to Supabase
const SUB_TOKEN = 'sbp_v0_f3099853ff02e3d278e32c89099a7b4462614fe2';
fetch('https://api.supabase.com/v1/projects/lucnobmmrqujhgbhmciz/secrets', {
  method: 'POST',
  headers: { Authorization: `Bearer ${SUB_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify([
    { name: 'VAPID_PUBLIC_KEY', value: newKeys.publicKey },
    { name: 'VAPID_PRIVATE_KEY', value: newKeys.privateKey },
    { name: 'VAPID_SUBJECT', value: 'mailto:kosaialsalh1@gmail.com' },
    { name: 'PUSH_SECRET', value: newSecret },
  ]),
}).then(r => r.text()).then(t => {
  console.log('supabase secrets:', t.slice(0, 60) || 'OK');

  // 4) update the trigger SQL with the new secret (tracked file, secret is ok to keep? NO —
  //    the trigger needs it; it's a functional constant. Keep in untracked override instead:
  fs.writeFileSync(path.join(ROOT, 'apply-trigger.query'),
    fs.readFileSync(path.join(ROOT, 'supabase', 'staff-webpush-trigger.sql'), 'utf8').replace(/'PUSH_SECRET_[A-Za-z0-9]*'/, `'${newSecret}'`));
  console.log('apply-trigger.query ready');
});

// 5) reset owner password to the known strong value + verify
const NEW_PW = 'Oda347470Sa#';
fs.writeFileSync(path.join(ROOT, 'apply-pw.query'),
  `update auth.users set encrypted_password = crypt('${NEW_PW}', gen_salt('bf')), updated_at = now() where email = 'kosaialsalh1@gmail.com';\n` +
  `select encrypted_password = crypt('${NEW_PW}', encrypted_password) as pw_ok from auth.users where email = 'kosaialsalh1@gmail.com';`);

// 6) update frontend public key
let sp = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'staffPush.js'), 'utf8');
sp = sp.replace(/const VAPID_PUBLIC = [^\n]+/, 'const VAPID_PUBLIC = ' + JSON.stringify(newKeys.publicKey) + ' || import.meta.env.VAPID_PUBLIC_KEY_CLIENT');
fs.writeFileSync(path.join(ROOT, 'src', 'lib', 'staffPush.js'), sp);
console.log('frontend key updated');
