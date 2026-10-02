const fs = require('fs');
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y25vYm1tcnF1amhnYmhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzE3ODYsImV4cCI6MjEwNjQ0Nzc4Nn0.frRWMUU5BpN3CdLa_dqFopHJgv4QG3pfp2Tu1VtIF_Y';
const BASE = 'https://lucnobmmrqujhgbhmciz.supabase.co';

async function main() {
  const login = await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kosaialsalh1@gmail.com', password: 'Oday2001#' }),
  })).json();
  const h = { apikey: ANON, Authorization: `Bearer ${login.access_token}`, 'Content-Type': 'application/json' };

  const clinics = await (await fetch(`${BASE}/rest/v1/clinics?select=id,name`, { headers: h })).json();
  const target = clinics.find((c) => c.name === 'عيادة النور');

  // exact call the deployed UI makes (6 params, no specialty)
  let r = await fetch(`${BASE}/rest/v1/rpc/super_create_user`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      p_email: 'fares.dentist@noor-clinic.com', p_password: 'Fares2026#',
      p_full_name: 'د. فارس المهندس', p_role: 'doctor', p_clinic_id: target.id,
      p_phone: null,
    }),
  });
  console.log('old-shape call ->', r.status, (await r.text()).slice(0, 300));

  // with specialty param
  r = await fetch(`${BASE}/rest/v1/rpc/super_create_user`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      p_email: 'fares.dentist@noor-clinic.com', p_password: 'Fares2026#',
      p_full_name: 'د. فارس المهندس', p_role: 'doctor', p_clinic_id: target.id,
      p_phone: null, p_specialty_key: 'dentistry',
    }),
  });
  console.log('new-shape call ->', r.status, (await r.text()).slice(0, 300));
}
main().catch((e) => console.log('ERR', e.message));
