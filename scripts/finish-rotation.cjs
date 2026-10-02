const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GIT = 'C:/Users/DELL/tools/cmd/git.exe';
const git = (cmd) => execSync(`"${GIT}" ${cmd}`, { cwd: ROOT, stdio: 'pipe' }).toString().trim();

// 1) untrack secret files
for (const f of ['vapid-keys.json', 'push-secret.txt']) {
  try { console.log('rm --cached:', git(`rm --cached ${f}`).trim()); } catch (e) { console.log('rm err:', f, e.stderr?.toString().slice(0, 80)); }
}

// 2) update frontend public key
const keys = JSON.parse(fs.readFileSync(path.join(ROOT, 'vapid-keys.json'), 'utf8'));
let sp = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'staffPush.js'), 'utf8');
sp = sp.replace(/const VAPID_PUBLIC = [^\n]+/, 'const VAPID_PUBLIC = ' + JSON.stringify(keys.publicKey) + ' || import.meta.env.VAPID_PUBLIC_KEY_CLIENT');
fs.writeFileSync(path.join(ROOT, 'src', 'lib', 'staffPush.js'), sp);
console.log('frontend key updated:', sp.includes(keys.publicKey.slice(0, 20)));

// 3) rotate owner password
const NEW_PW = 'Kosaia' + Math.floor(100000 + Math.random() * 900000) + '#';
fs.writeFileSync(path.join(ROOT, 'scripts', 'owner-pw.txt'), NEW_PW);
const sql = `update auth.users set encrypted_password = crypt('${NEW_PW}', gen_salt('bf')), updated_at = now() where email = 'kosaialsalh1@gmail.com';`;
fs.writeFileSync(path.join(ROOT, 'apply-pw.query'), sql);
console.log('owner password rotated (written to apply-pw.query)');
