// بيانات تجريبية لعيادة د. مازن احمد العوض (أسنان):
// إعدادات + جدول دوام + 10 مرضى + 10 مواعيد اليوم + 20 دواء شائع
// يعمل مرة واحدة — يتوقف إن وُجدت مواعيد سابقة لتفادي التكرار
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('mazen-auth.json', 'utf8'));
const TOKEN = j.access_token;
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Y25vYm1tcnF1amhnYmhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzE3ODYsImV4cCI6MjEwNjQ0Nzc4Nn0.frRWMUU5BpN3CdLa_dqFopHJgv4QG3pfp2Tu1VtIF_Y';
const BASE = 'https://lucnobmmrqujhgbhmciz.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

const CLINIC = 'feae3070-7837-4f7d-9353-b7139784d229';
const DOCTOR = 'dd262335-4f9a-4071-95b7-29b2cb8e1775';

async function get(path) {
  const r = await fetch(BASE + path, { headers: H });
  const t = await r.text();
  if (!r.ok) throw new Error('GET ' + r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : [];
}
async function post(path, body, prefer) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { ...H, Prefer: prefer || 'return=representation' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('POST ' + path + ' -> ' + r.status + ' ' + t.slice(0, 400));
  return t ? JSON.parse(t) : [];
}

async function tryPost(path, body, prefer, label) {
  try {
    const out = await post(path, body, prefer);
    console.log(label + ' ok:', Array.isArray(out) ? out.length : 1);
    return out;
  } catch (e) {
    console.log(label + ' SKIPPED:', e.message.slice(0, 140));
    return null;
  }
}

(async () => {
  // حماية من التكرار
  const existing = await get('/appointments?select=id&clinic_id=eq.' + CLINIC);
  if (existing.length > 0) return console.log('STOP: العيادة لديها', existing.length, 'مواعيد أصلاً — لن يُدرج شيء');

  // 1) إعدادات العيادة (تتطلب صلاحية مدير — تتجاوز إن رُفضت)
  await tryPost(
    '/clinic_settings?on_conflict=clinic_id',
    [{ clinic_id: CLINIC, doctor_name: 'د. مازن العوض', consultation_price: 150000, currency: 'ل.س', whatsapp_country_code: '963' }],
    'return=representation,resolution=merge-duplicates',
    'SETTINGS'
  );

  // 2) جدول الدوام (تتطلب صلاحية مدير — تتجاوز إن رُفضت)
  const days = [
    [0, '16:00', '21:00', true], [1, '16:00', '21:00', true], [2, '16:00', '21:00', true],
    [3, '16:00', '21:00', true], [4, '16:00', '21:00', true],
    [5, '00:00', '00:00', false], [6, '11:00', '14:00', true],
  ];
  await tryPost(
    '/doctor_schedules',
    days.map(([w, st, en, act]) => ({ clinic_id: CLINIC, weekday: w, start_time: st, end_time: en, is_active: act })),
    undefined,
    'SCHEDULES'
  );

  // 3) 10 مرضى تجريبيين (يُدرج فقط الناقص منهم)
  const people = [
    ['أحمد الخطيب', '0955100001', 'male', '1988-06-03'],
    ['مريم الحلبي', '0955100002', 'female', '1994-02-11'],
    ['عمر الشامي', '0955100003', 'male', '1991-04-30'],
    ['رنا الأسعد', '0955100004', 'female', '1997-09-17'],
    ['خالد المصري', '0955100005', 'male', '1979-01-25'],
    ['لينا حداد', '0955100006', 'female', '2000-08-19'],
    ['يوسف النقدي', '0955100007', 'male', '1985-03-14'],
    ['سلمى برهان', '0955100008', 'female', '1999-07-07'],
    ['فراس الديب', '0955100009', 'male', '1975-11-21'],
    ['هبة الزين', '0955100010', 'female', '2002-10-01'],
  ];
  const existingPatients = await get('/patients?select=id,full_name,phone&clinic_id=eq.' + CLINIC);
  const known = new Set(existingPatients.map((p) => p.phone));
  const toAdd = people.filter(([, phone]) => !known.has(phone));
  let patients = existingPatients;
  if (toAdd.length) {
    const added = await post('/patients', toAdd.map(([full_name, phone, gender, dob]) => ({
      clinic_id: CLINIC, full_name, phone, gender, date_of_birth: dob,
    })));
    patients = patients.concat(added);
  }
  console.log('PATIENTS total:', patients.length, '(added now:', toAdd.length + ')');

  // 4) معلومات طبية توضيحية لمريضين (حساسية بنسلين + ضغط وسكري)
  const byName = Object.fromEntries(patients.map((p) => [p.full_name, p.id]));
  await tryPost('/medical_information', [{ clinic_id: CLINIC, patient_id: byName['أحمد الخطيب'], allergies: 'حساسية البنسلين', important_notes: 'يُفضَّل تجنب مجموعة البنسلينات واللجوء للماكروليدات' }], undefined, 'MEDINFO 1');
  await tryPost('/medical_information', [{ clinic_id: CLINIC, patient_id: byName['خالد المصري'], chronic_diseases: 'ارتفاع ضغط الدم، داء سكري نمط 2', current_medications: 'أملوديبين 5 ملغ يومياً، ميتفورمين 850 ملغ مرتين يومياً' }], undefined, 'MEDINFO 2');

  // 5) 10 مواعيد اليوم من 17:00 حتى 18:30 (حالات متنوعة لعرض التدفق)
  const byPhone = Object.fromEntries(patients.map((p) => [p.phone, p.id]));
  const today = new Date();
  const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
  const dateStr = y + '-' + m + '-' + d;
  const statuses = ['confirmed', 'confirmed', 'arrived', 'confirmed', 'waiting', 'confirmed', 'confirmed', 'confirmed', 'arrived', 'confirmed'];
  const appts = await post('/appointments', people.map(([full_name, phone], i) => {
    const mins = 17 * 60 + i * 10;
    const st = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    const enMins = mins + 20;
    const en = String(Math.floor(enMins / 60)).padStart(2, '0') + ':' + String(enMins % 60).padStart(2, '0');
    return {
      clinic_id: CLINIC, patient_id: byPhone[phone], doctor_id: DOCTOR,
      appointment_date: dateStr, start_time: st, end_time: en,
      status: statuses[i], price: 150000,
      notes: i === 4 ? 'مراجعة بعد خلع ضرس العقل' : i === 8 ? 'جلسة تنظيف جير' : null,
    };
  }));
  console.log('APPOINTMENTS ok:', appts.length);

  // 6) 20 دواء شائع في أدويتي الشائعة (يُدرج مرة واحدة فقط)
  const favCount = (await get('/doctor_favorite_medications?select=id&clinic_id=eq.' + CLINIC)).length;
  if (favCount > 0) return console.log('SKIP MEDS: توجد', favCount, 'أدوية مفضلة أصلاً');
  const meds = [
    ['أموكسيسيلين', '500 ملغ', '5 أيام', 'كبسولة كل 8 ساعات بعد الأكل'],
    ['أوغمنتين', '1 غرام', '6 أيام', 'قرص كل 12 ساعة بعد الأكل'],
    ['ميترونيدازول', '500 ملغ', '5 أيام', 'قرص كل 8 ساعات بعد الأكل — ممنوع الكحول'],
    ['أزيثروميسين', '500 ملغ', '3 أيام', 'قرص واحد يومياً قبل الأكل'],
    ['كلندامايسين', '300 ملغ', '5 أيام', 'كبسولة كل 6 ساعات'],
    ['سيفالكسين', '500 ملغ', '5 أيام', 'كبسولة كل 8 ساعات'],
    ['إيبوبروفين', '400 ملغ', 'عند الحاجة', 'قرص كل 8 ساعات بعد الأكل'],
    ['ديكلوفيناك بوتاسيوم', '50 ملغ', '3 أيام', 'قرص كل 8 ساعات بعد الأكل'],
    ['باراسيتامول', '1 غرام', 'عند الحاجة', 'قرص كل 8 ساعات — بحد أقصى 3 غرام يومياً'],
    ['كيتورولاك', '10 ملغ', '3 أيام', 'قرص كل 6 ساعات بعد الأكل'],
    ['دكساميثازون', '0.5 ملغ', '3 أيام', 'صباحاً بعد الفطور — للوذمة الشديدة فقط'],
    ['أسيكلوفير', '400 ملغ', '5 أيام', 'قرص كل 8 ساعات — للهربس الشفوي'],
    ['فليكونازول', '150 ملغ', 'حسب الحالة', 'قرص واحد أسبوعياً — لفطريات الفم'],
    ['كلورهيكسيدين غسول فم', '0.2%', 'أسبوع', 'غسلة 30 ثانية مرتين يومياً بعد التفريش'],
    ['بنزيدامين غسول فم', '0.15%', 'عند الحاجة', 'غسلة كل 3 ساعات عند الألم'],
    ['ميكونازول جل', '2%', 'أسبوعان', 'دهان موضعي على المناطق المصابة 3 مرات يومياً'],
    ['جل ليدوكايين', '2%', 'عند الحاجة', 'دهان موضعي قبل الأكل بربع ساعة'],
    ['فيتامين ب مركب', '—', 'شهر', 'قرص يومياً بعد الفطور — لتقرحات الفم'],
    ['كالسيوم + فيتامين د', '—', 'شهر', 'قرص يومياً بعد الغداء'],
    ['سيتيريزين', '10 ملغ', 'عند الحاجة', 'قرص واحد ليلاً'],
  ];
  const favs = await post('/doctor_favorite_medications', meds.map(([name, dosage, duration, instructions]) => ({
    clinic_id: CLINIC, doctor_id: DOCTOR, name, dosage, duration, instructions,
  })));
  console.log('FAVORITE MEDS ok:', favs.length);

  console.log('=== DONE: عيادة د. مازن جاهزة للعرض ===');
})().catch((e) => console.error('FAILED:', e.message));
