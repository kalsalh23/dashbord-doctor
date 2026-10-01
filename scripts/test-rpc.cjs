const fs = require('fs');
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y25vYm1tcnF1amhnYmhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzE3ODYsImV4cCI6MjEwNjQ0Nzc4Nn0.frRWMUU5BpN3CdLa_dqFopHJgv4QG3pfp2Tu1VtIF_Y';
const URL_BASE = 'https://lucnobmmrqujhgbhmciz.supabase.co';

async function main() {
  const loginRes = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kosaialsalh1@gmail.com', password: 'Oday2001#' }),
  });
  const login = await loginRes.json();
  if (!login.access_token) return console.log('LOGIN FAILED', JSON.stringify(login).slice(0, 200));
  const token = login.access_token;

  // find عيادة النور id via management? simpler: hardcode from earlier query if needed.
  // First list clinics through the API as the super user:
  const clinicsRes = await fetch(`${URL_BASE}/rest/v1/clinics?select=id,name`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const clinics = await clinicsRes.json();
  const target = (clinics || []).find((c) => c.name === 'عيادة النور');
  if (!target) return console.log('CLINIC NOT FOUND', JSON.stringify(clinics));

  const rpcRes = await fetch(`${URL_BASE}/rest/v1/rpc/super_create_user`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_email: 'samer.alhalabi@noor-clinic.com',
      p_password: 'Noor2026#',
      p_full_name: 'د. سامر الحلبي',
      p_role: 'doctor',
      p_clinic_id: target.id,
      p_phone: '0995556667',
    }),
  });
  const text = await rpcRes.text();
  console.log('RPC HTTP', rpcRes.status, '|', text.slice(0, 500));
}
main().catch((e) => console.log('ERR', e.message));
