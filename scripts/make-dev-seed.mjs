// ============================================================
// توليد بيانات تجريبية (dev seed) للنسخة المحلية — لأغراض الاختبار فقط
//   node scripts/make-dev-seed.mjs
// المستخدمون: admin@demo.com / doctor@demo.com / reception@demo.com — كلمة المرور 123456
// ============================================================
import fs from 'node:fs'
import bcrypt from 'bcryptjs'

const hash = bcrypt.hashSync('123456', 10)
const now = new Date().toISOString()
const today = new Date().toISOString().slice(0, 10)
const CLINIC = '11111111-1111-1111-1111-111111111111'
const ADMIN = '22222222-2222-2222-2222-222222222221'
const DOC = '22222222-2222-2222-2222-222222222222'
const REC = '22222222-2222-2222-2222-222222222223'
const P1 = '33333333-3333-3333-3333-333333333331'
const P2 = '33333333-3333-3333-3333-333333333332'
const A1 = '44444444-4444-4444-4444-444444444441'
const A2 = '44444444-4444-4444-4444-444444444442'
const V1 = '55555555-5555-5555-5555-555555555551'

const seed = {
  seed_version: Date.now(),
  exported_at: now,
  dev_seed: true,
  tables: {
    clinics: [
      {
        id: CLINIC, name: 'عيادة النور التجريبية', specialty: 'باطنية', specialty_key: 'general',
        phone: '0952639157', address: 'دمشق', is_active: true, created_at: now, updated_at: now,
      },
    ],
    profiles: [
      { id: ADMIN, clinic_id: CLINIC, full_name: 'مدير النظام', role: 'admin', phone: null, is_active: true, created_at: now, updated_at: now },
      { id: DOC, clinic_id: CLINIC, full_name: 'د. أحمد التجريبي', role: 'doctor', phone: null, is_active: true, created_at: now, updated_at: now },
      { id: REC, clinic_id: CLINIC, full_name: 'موظفة الاستقبال', role: 'reception', phone: null, is_active: true, created_at: now, updated_at: now },
    ],
    clinic_settings: [
      { id: '66666666-6666-6666-6666-666666666661', clinic_id: CLINIC, doctor_name: 'د. أحمد التجريبي', consultation_price: 50, currency: 'ر.س', created_at: now, updated_at: now },
    ],
    doctor_schedules: [0, 1, 2, 3, 4, 6].map((d) => ({
      id: `77777777-7777-7777-7777-77777777770${d}`,
      clinic_id: CLINIC, doctor_id: null, weekday: d, start_time: '17:00', end_time: '21:00',
      is_active: true, created_at: now, updated_at: now,
    })),
    patients: [
      { id: P1, clinic_id: CLINIC, full_name: 'محمد التجريبي', phone: '0999111222', date_of_birth: '1990-05-01', gender: 'male', created_at: now, updated_at: now },
      { id: P2, clinic_id: CLINIC, full_name: 'سارة التجريبية', phone: '0999333444', date_of_birth: '1985-09-15', gender: 'female', created_at: now, updated_at: now },
    ],
    medical_information: [
      { id: '88888888-8888-8888-8888-888888888881', clinic_id: CLINIC, patient_id: P1, chronic_diseases: 'سكري نوع ٢', allergies: 'البنسلين', created_at: now, updated_at: now },
    ],
    appointments: [
      { id: A1, clinic_id: CLINIC, patient_id: P1, doctor_id: DOC, appointment_date: today, start_time: '17:00', end_time: '17:30', status: 'confirmed', price: 50, created_at: now, updated_at: now },
      { id: A2, clinic_id: CLINIC, patient_id: P2, doctor_id: DOC, appointment_date: today, start_time: '17:30', end_time: '18:00', status: 'waiting', price: 50, created_at: now, updated_at: now },
    ],
    visits: [
      { id: V1, clinic_id: CLINIC, patient_id: P1, appointment_id: A1, doctor_id: DOC, visit_date: today, chief_complaint: 'صداع مستمر', diagnosis: 'توتر', treatment_plan: 'راحة', created_at: now, updated_at: now },
    ],
    medications: [
      { id: '99999999-9999-9999-9999-999999999991', clinic_id: CLINIC, visit_id: V1, patient_id: P1, name: 'باراسيتامول', dosage: '500mg', duration: '5 أيام', created_at: now },
    ],
    payments: [
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', clinic_id: CLINIC, patient_id: P1, appointment_id: A1, total_amount: 50, amount: 50, remaining: 0, method: 'cash', status: 'paid', paid_at: now, created_at: now, updated_at: now },
    ],
    follow_up_requests: [],
    notifications: [],
    audit_logs: [],
    dental_chart_entries: [],
    ent_chart_entries: [],
    platform_requests: [],
    expenses: [],
    push_subscriptions: [],
    staff_push_subscriptions: [],
    dental_pricebook: [],
    medication_catalog: [],
    doctor_favorite_medications: [],
  },
  users: [
    { id: ADMIN, email: 'admin@demo.com', password_hash: hash, raw_user_meta_data: { full_name: 'مدير النظام', role: 'admin' }, created_at: now },
    { id: DOC, email: 'doctor@demo.com', password_hash: hash, raw_user_meta_data: { full_name: 'د. أحمد التجريبي', role: 'doctor' }, created_at: now },
    { id: REC, email: 'reception@demo.com', password_hash: hash, raw_user_meta_data: { full_name: 'موظفة الاستقبال', role: 'reception' }, created_at: now },
  ],
}

fs.writeFileSync('public/seed-data.json', JSON.stringify(seed))
console.log('تم توليد public/seed-data.json (بيانات تجريبية — كلمة مرور الجميع 123456)')
