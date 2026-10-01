// Execute a SQL file against the Supabase project via the Management API.
// Usage: node scripts/run-sql.js <file.sql>
const fs = require('fs');

const REF = 'lucnobmmrqujhgbhmciz';
const TOKEN = process.env.SUPA_MGMT_TOKEN;
const file = process.argv[2];
if (!TOKEN || !file) {
  console.error('usage: node scripts/run-sql.js <file.sql>  (env SUPA_MGMT_TOKEN required)');
  process.exit(1);
}
const sql = fs.readFileSync(file, 'utf8');

async function main() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text.slice(0, 3000)}`);
    process.exit(1);
  }
  console.log(text.slice(0, 5000) || 'OK (no rows)');
}
main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
