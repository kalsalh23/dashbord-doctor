// بيانات تجريبية لعيادة د. سليمان محمد الحسين: 10 مرضى + 10 أدوية شائعة
// يعمل بأمان مرات متعددة — لا يكرر المرضى ولا الأدوية
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('sl-auth.json', 'utf8'));
const TOKEN = j.access_token;
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y25vYm1tcnF1amhnYmhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzE3ODYsImV4cCI6MjEwNjQ0Nzc4Nn0.frRWMUU5BpN3CdLa_dqFopHJgv4QG3pfp2Tu1VtIF_Y';
const BASE = 'https://lucnobmmrqujhgbhmciz.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
const CLINIC = 'f0d1e425-3e9c-40dd-8e9d-3d7deaf9b1ae';
const DOCTOR = '11e55e3e-02d3-45db-a4ab-b48c22424901';

async function get(path) {
  const r = await fetch(BASE + path, { headers: H });
  const t = await r.text();
  if (!r.ok) throw new Error('GET ' + r.status + ' ' + t.slice(0, 200));
  return t ? JSON.parse(t) : [];
}
async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error('POST ' + path + ' -> ' + r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : [];
}

(async () => {
  // 10 مرضى تجريبيين (يُضاف الناقص فقط)
  const people = [
    ['أحمد المبارك', '0955200001', 'male', '1970-03-11'],
    ['فاطمة العلي', '0955200002', 'female', '1982-07-22'],
    ['محمد الصالح', '0955200003', 'male', '1965-01-05'],
    ['هدى الشامي', '0955200004', 'female', '1990-11-30'],
    ['عبدالله النعيمي', '0955200005', 'male', '1958-06-17'],
    ['سارة الحلبي', '0955200006', 'female', '1975-04-08'],
    ['ياسر الكيلاني', '0955200007', 'male', '1988-09-14'],
    ['نور الهدى', '0955200008', 'female', '1995-12-02'],
    ['قاسم العمري', '0955200009', 'male', '1962-02-26'],
    ['رند الحسين', '0955200010', 'female', '1980-05-19'],
  ];
  const existing = await get('/patients?select=id,full_name,phone&clinic_id=eq.' + CLINIC);
  const known = new Set(existing.map((p) => p.phone));
  const toAdd = people.filter(([, phone]) => !known.has(phone));
  if (toAdd.length) {
    const added = await post('/patients', toAdd.map(([full_name, phone, gender, dob]) => ({
      clinic_id: CLINIC, full_name, phone, gender, date_of_birth: dob,
    })));
    console.log('PATIENTS added:', added.length);
  } else console.log('PATIENTS: كلهم موجودون');
  console.log('PATIENTS total:', existing.length + toAdd.length);

  // 10 أدوية شائعة (قلب/عام) في أدويتي الشائعة — بدون تكرار
  const favCount = (await get('/doctor_favorite_medications?select=id&doctor_id=eq.' + DOCTOR)).length;
  if (favCount === 0) {
    const meds = [
      ['أسبرين', '81 ملغ', 'مستمر', 'قرص واحد صباحاً بعد الأكل'],
      ['أتورفاستاتين', '20 ملغ', 'مستمر', 'قرص واحد ليلاً'],
      ['أملوديبين', '5 ملغ', 'مستمر', 'قرص واحد صباحاً'],
      ['فالسارتان', '160 ملغ', 'مستمر', 'قرص واحد صباحاً'],
      ['ميتوبولول', '50 ملغ', 'حسب الوصف', 'قرص واحد بعد الأكل'],
      ['باراسيتامول', '500 ملغ', 'عند الحاجة', 'قرص عند الألم بحد أقصى 3 مرات يومياً'],
      ['أوميبرازول', '20 ملغ', 'أسبوعان', 'كبسولة قبل الفطور'],
      ['كلوبيدوغريل', '75 ملغ', 'حسب الوصف', 'قرص واحد يومياً بعد الأكل'],
      ['فوروسيميد', '40 ملغ', 'حسب الوصف', 'قرص صباحاً'],
      ['بوتاسيوم', '600 ملغ', 'حسب الوصف', 'كبسولة بعد الغداء'],
    ];
    const favs = await post('/doctor_favorite_medications', meds.map(([name, dosage, duration, instructions]) => ({
      clinic_id: CLINIC, doctor_id: DOCTOR, name, dosage, duration, instructions,
    })));
    console.log('MEDS added:', favs.length);
  } else console.log('MEDS: توجد', favCount, 'أدوية أصلاً — لن يُكرر');

  console.log('=== DONE: عيادة د. سليمان جاهزة ===');
})().catch((e) => console.error('FAILED:', e.message));
