const fs = require('fs');
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y25vYm1tcnF1amhnYmhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzE3ODYsImV4cCI6MjEwNjQ0Nzc4Nn0.frRWMUU5BpN3CdLa_dqFopHJgv4QG3pfp2Tu1VtIF_Y';
const BASE = 'https://lucnobmmrqujhgbhmciz.supabase.co';

async function main() {
  // what does د. فارس (dentist, عيادة النور) see?
  const login = await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fares.dentist@noor-clinic.com', password: 'Fares2026#' }),
  })).json();
  const h = { apikey: ANON, Authorization: `Bearer ${login.access_token}` };
  const notifs = await (await fetch(`${BASE}/rest/v1/notifications?select=*&order=created_at.desc&limit=10`, { headers: h })).json();
  console.log('FARES sees', Array.isArray(notifs) ? notifs.length : notifs, 'notifications:');
  if (Array.isArray(notifs)) notifs.forEach(n => console.log(' -', n.target_role, '|', n.title, '|', n.body));

  // and the owner for comparison
  const ologin = await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kosaialsalh1@gmail.com', password: 'Oday2001#' }),
  })).json();
  const oh = { apikey: ANON, Authorization: `Bearer ${ologin.access_token}` };
  const onotifs = await (await fetch(`${BASE}/rest/v1/notifications?select=*&order=created_at.desc&limit=10`, { headers: oh })).json();
  console.log('OWNER sees', Array.isArray(onotifs) ? onotifs.length : onotifs, 'notifications:');
  if (Array.isArray(onotifs)) onotifs.slice(0, 10).forEach(n => console.log(' -', n.target_role, '|', n.title));
}
main().catch((e) => console.log('ERR', e.message));
