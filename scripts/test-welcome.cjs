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

  // create a fresh account with a specialty -> welcome notification should be auto-created
  const r = await fetch(`${BASE}/rest/v1/rpc/super_create_user`, {
    method: 'POST', headers: h,
    body: JSON.stringify({
      p_email: 'welcome-test@noor-clinic.com', p_password: 'Welcome2026#',
      p_full_name: 'د. ترحيب', p_role: 'doctor', p_clinic_id: target.id,
      p_phone: null, p_specialty_key: 'dentistry',
    }),
  });
  const created = await r.json();
  console.log('create ->', r.status, JSON.stringify(created).slice(0, 120));

  if (!created.id) return;

  // log in AS the new user and read his notifications
  const ulogin = await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'welcome-test@noor-clinic.com', password: 'Welcome2026#' }),
  })).json();
  const uh = { apikey: ANON, Authorization: `Bearer ${ulogin.access_token}` };
  const notifs = await (await fetch(`${BASE}/rest/v1/notifications?select=*`, { headers: uh })).json();
  console.log('new user sees', Array.isArray(notifs) ? notifs.length : notifs, 'notification(s):');
  if (Array.isArray(notifs)) notifs.forEach((n) => console.log('  -', n.title, '|', (n.body || '').slice(0, 80)));

  // backfill a welcome for the existing dentist (د. فارس)
  const fares = await (await fetch(`${BASE}/rest/v1/profiles?select=id,clinic_id&email=eq.fares.dentist@noor-clinic.com`, { headers: h })).json();
  if (fares[0]) {
    const ins = await fetch(`${BASE}/rest/v1/notifications`, {
      method: 'POST', headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify({
        clinic_id: fares[0].clinic_id, target_role: 'doctor', user_id: fares[0].id,
        title: 'مرحبًا بك في نظام إدارة العيادة 👋',
        body: 'تم إنشاء حسابك بنجاح — مخطط الأسنان متاح لك داخل شاشة الكشف. نتمنى لك تجربة موفقة، ولأي استفسار تواصل مع إدارة النظام.',
        type: 'info',
      }),
    });
    console.log('backfill fares welcome ->', ins.status);
  }
}
main().catch((e) => console.log('ERR', e.message));
