const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y25vYm1tcnF1amhnYmhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzE3ODYsImV4cCI6MjEwNjQ0Nzc4Nn0.frRWMUU5BpN3CdLa_dqFopHJgv4QG3pfp2Tu1VtIF_Y';
const BASE = 'https://lucnobmmrqujhgbhmciz.supabase.co';

async function notifsFor(email, password) {
  const login = await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })).json();
  const h = { apikey: ANON, Authorization: `Bearer ${login.access_token}` };
  const notifs = await (await fetch(`${BASE}/rest/v1/notifications?select=title,body,user_id,target_role`, { headers: h })).json();
  return Array.isArray(notifs) ? notifs : notifs;
}

async function main() {
  const mine = await notifsFor('welcome-test@noor-clinic.com', 'Welcome2026#');
  console.log('WELCOME-TEST user sees:', JSON.stringify(mine, null, 1).slice(0, 500));
  const fares = await notifsFor('fares.dentist@noor-clinic.com', 'Fares2026#');
  console.log('FARES sees:', JSON.stringify(fares, null, 1).slice(0, 500));
}
main().catch((e) => console.log('ERR', e.message));
