const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const git = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'pipe' }).toString().trim();

// 1) untrack the secret files (they remain on disk, now gitignored)
for (const f of ['vapid-keys.json', 'push-secret.txt']) {
  try { console.log('rm --cached:', git(`git rm --cached ${f}`).trim()); } catch (e) { console.log('rm failed:', f); }
}

// 2) rotate VAPID
delete require.cache[require.resolve(path.join(ROOT, 'vapid-keys.json'))];
const wp = require('web-push');
const newKeys = wp.generateVAPIDKeys();
fs.writeFileSync(path.join(ROOT, 'vapid-keys.json'), JSON.stringify({ ...newKeys, subject: 'mailto:kosaialsalh1@gmail.com' }, null, 1));
const newSecret = 'PUSH_SECRET_' + require('crypto').randomBytes(12).toString('hex');
fs.writeFileSync(path.join(ROOT, 'push-secret.txt'), newSecret);
console.log('VAPID + PUSH_SECRET rotated');

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
  console.log('supabase secrets:', t.slice(0, 80) || 'OK');

  // 4) update the staff push trigger SQL with the new secret and apply it
  const trigPath = path.join(ROOT, 'supabase', 'staff-webpush-trigger.sql');
  let sql = fs.readFileSync(trigPath, 'utf8');
  sql = sql.replace(/'PUSH_SECRET_[A-Za-z0-9]*'/, `'${newSecret}'`);
  fs.writeFileSync(trigPath, sql);
  fs.writeFileSync(path.join(ROOT, 'scripts', 'apply-trigger.cjs'), `
const fs = require('fs');
const sql = fs.readFileSync('supabase/staff-webpush-trigger.sql', 'utf8');
fs.writeFileSync('apply-trigger.query', sql);
`);
  console.log('trigger SQL updated with new secret');
});
