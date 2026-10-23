const bcrypt = require('bcryptjs');
const TOKEN = 'sbp_v0_e4891d20d629d8dd3e77dbdd1352e55966b5b723';
const REF = 'lucnobmmrqujhgbhmciz';

async function runQuery(sql) {
  const res = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 500));
  return JSON.parse(text || '[]');
}

(async () => {
  const users = await runQuery("select id, email, encrypted_password from auth.users where email = 'rnda@gmail.com'");
  if (!users.length) { console.log('User not found!'); return; }
  const user = users[0];
  console.log('User:', user.email);
  console.log('Has hash:', !!user.encrypted_password);
  
  if (user.encrypted_password) {
    const match = bcrypt.compareSync('rnda@2026', user.encrypted_password);
    console.log('Password matches:', match);
    if (match) { console.log('Password is correct!'); return; }
  }
  
  console.log('Setting password to rnda@2026...');
  const hash = bcrypt.hashSync('rnda@2026', 6);
  const escapedHash = hash.replace(/'/g, "''");
  const sql = "update auth.users set encrypted_password = '" + escapedHash + "', updated_at = now() where email = 'rnda@gmail.com'";
  await runQuery(sql);
  
  const u2 = await runQuery("select encrypted_password from auth.users where email = 'rnda@gmail.com'");
  const match2 = bcrypt.compareSync('rnda@2026', u2[0].encrypted_password);
  console.log('Password now matches:', match2);
})();