// ============================================================
// إضافة عيادة الدكتورة رنيم النبهان (النساء والتوليد) إلى بيانات البذور
//   node scripts/add-ranim-clinic.mjs
// يضيف: العيادة + حساب الطبيبة + حساب الاستقبال + الإعدادات + أوقات الدوام
// إلى: data/full-seed.json (المصدر الكامل) و public/seed-data.json (بذور التشغيل)
// آمن للتكرار: لا يضيف صفاً مكرراً إن كان موجوداً.
// ============================================================
import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'

const CLINIC_ID = 'b7d41c26-9e58-4a3f-8c17-2d6e95f0a741'
const DOCTOR_ID = 'c9e2f4a8-6d31-4b7e-a52c-8f9d1e3b6742'
const RECEPTION_ID = 'd1a7b3c5-2e64-4f98-b0a3-6c7d5e9f1823'
const SETTINGS_ID = 'e5b2c9f4-7a61-4d83-9f20-1b8c4a6e0d35'
const PASSWORD = 'ranim1234'

const NOW = new Date().toISOString()

const CLINIC = {
  id: CLINIC_ID,
  name: 'عيادة الدكتورة رنيم النبهان',
  specialty: 'النساء والتوليد',
  phone: '',
  address: null,
  is_active: true,
  created_at: NOW,
  updated_at: NOW,
  specialty_key: 'obgyn',
}

const DOCTOR = {
  id: DOCTOR_ID,
  clinic_id: CLINIC_ID,
  full_name: 'د. رنيم النبهان',
  role: 'doctor',
  phone: '',
  is_active: true,
  created_at: NOW,
  updated_at: NOW,
  avatar_url: null,
  specialty_key: 'obgyn',
  self_service: false,
}

const RECEPTION = {
  id: RECEPTION_ID,
  clinic_id: CLINIC_ID,
  full_name: 'استقبال عيادة د. رنيم',
  role: 'reception',
  phone: '',
  is_active: true,
  created_at: NOW,
  updated_at: NOW,
  avatar_url: null,
  specialty_key: 'general',
  self_service: false,
}

const SETTINGS = {
  id: SETTINGS_ID,
  clinic_id: CLINIC_ID,
  doctor_name: 'د. رنيم النبهان',
  consultation_price: '50000.00',
  currency: 'ل.س',
  reminder_template:
    'مرحبًا {patient}،\nنذكركم بأن لديكم موعدًا مع {doctor} {when} الساعة {time}.\nنتمنى لكم السلامة.',
  whatsapp_country_code: '963',
  created_at: NOW,
  updated_at: NOW,
  slot_minutes: 15,
  slots_before_break: 8,
  break_minutes: 0,
  prescription_footer1: 'يرجى عرض العلاج قبل الاستعمال',
  prescription_footer2: 'المراجعة المعلنية خلال أسبوع فقط',
  prescription_template: 'rose',
}

// أوقات الدوام: الأحد–الخميس 16:00–20:00 · السبت 10:00–14:00 (الجمعة عطعة)
const SCHEDULES = [
  ...[0, 1, 2, 3, 4].map((weekday, i) => ({
    id: `f${i + 1}0a1c2b3-4d5e-6f70-8192-a3b4c5d6e7${weekday}`,
    clinic_id: CLINIC_ID,
    doctor_id: DOCTOR_ID,
    weekday,
    start_time: '16:00:00',
    end_time: '20:00:00',
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
  })),
  {
    id: 'f9a1c2b3-4d5e-6f70-8192-a3b4c5d6e7f9',
    clinic_id: CLINIC_ID,
    doctor_id: DOCTOR_ID,
    weekday: 6,
    start_time: '10:00:00',
    end_time: '14:00:00',
    is_active: true,
    created_at: NOW,
    updated_at: NOW,
  },
]

const USERS = [
  {
    id: DOCTOR_ID,
    email: 'ranim@noor-clinic.com',
    password_hash: bcrypt.hashSync(PASSWORD, 6),
    raw_user_meta_data: { role: 'doctor', full_name: 'د. رنيم النبهان' },
    created_at: NOW,
  },
  {
    id: RECEPTION_ID,
    email: 'ranim.reception@noor-clinic.com',
    password_hash: bcrypt.hashSync(PASSWORD, 6),
    raw_user_meta_data: { role: 'reception', full_name: 'استقبال عيادة د. رنيم' },
    created_at: NOW,
  },
]

function upsert(rows, row, key = 'id') {
  const i = rows.findIndex((r) => r[key] === row[key])
  if (i >= 0) rows[i] = { ...rows[i], ...row }
  else rows.push(row)
  return rows
}

function patchFile(file) {
  const full = path.resolve(file)
  if (!fs.existsSync(full)) {
    console.log('تخطّي (غير موجود): ' + file)
    return
  }
  const seed = JSON.parse(fs.readFileSync(full, 'utf8'))
  seed.tables = seed.tables || {}
  seed.users = seed.users || []

  upsert(seed.tables.clinics || (seed.tables.clinics = []), CLINIC)
  upsert(seed.tables.profiles || (seed.tables.profiles = []), DOCTOR)
  upsert(seed.tables.profiles, RECEPTION)
  upsert(seed.tables.clinic_settings || (seed.tables.clinic_settings = []), SETTINGS)

  seed.tables.doctor_schedules = seed.tables.doctor_schedules || []
  for (const s of SCHEDULES) {
    const i = seed.tables.doctor_schedules.findIndex((r) => r.id === s.id)
    if (i >= 0) seed.tables.doctor_schedules[i] = { ...seed.tables.doctor_schedules[i], ...s }
    else seed.tables.doctor_schedules.push(s)
  }

  for (const u of USERS) {
    const i = seed.users.findIndex((r) => r.id === u.id)
    if (i >= 0) seed.users[i] = { ...seed.users[i], ...u }
    else seed.users.push(u)
  }

  seed.seed_version = Date.now()
  fs.writeFileSync(full, JSON.stringify(seed, null, 1))
  console.log(
    'تم التحديث: ' + file +
    ` (عيادات: ${seed.tables.clinics.length} · حسابات: ${seed.users.length})`
  )
}

patchFile('data/full-seed.json')
patchFile('public/seed-data.json')
console.log('\nحسابات عيادة د. رنيم النبهان:')
console.log('  الطبيبة : ranim@noor-clinic.com / ' + PASSWORD)
console.log('  الاستقبال: ranim.reception@noor-clinic.com / ' + PASSWORD)
