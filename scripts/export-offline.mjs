// ============================================================
// تصدير بيانات Supabase إلى ملف seed محلي (public/seed-data.json)
// الاستخدام:
//   SUPA_MGMT_TOKEN=<token> node scripts/export-offline.mjs
// يصدر كل الجداول + مستخدمي auth (مع هاشات كلمات المرور كما هي،
// لذلك تبقى كلمات المرور الحالية تعمل في النسخة المحلية).
// ملاحظة: الملف يحتوي بيانات مرضى حساسة — لا ترفعه إلى أي مستودع.
// ============================================================
import fs from 'node:fs'
import path from 'node:path'

const REF = 'lucnobmmrqujhgbhmciz'
const TOKEN = process.env.SUPA_MGMT_TOKEN
if (!TOKEN) {
  console.error('SUPA_MGMT_TOKEN مطلوب:  SUPA_MGMT_TOKEN=... node scripts/export-offline.mjs')
  process.exit(1)
}

const TABLES = [
  'clinics', 'profiles', 'clinic_settings', 'doctor_schedules', 'patients',
  'medical_information', 'appointments', 'visits', 'medications', 'attachments',
  'payments', 'follow_up_requests', 'notifications', 'audit_logs',
  'dental_chart_entries', 'ent_chart_entries', 'platform_requests', 'expenses',
  'push_subscriptions', 'staff_push_subscriptions', 'dental_pricebook',
  'medication_catalog', 'doctor_favorite_medications',
]

async function runQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`)
  return JSON.parse(text || '[]')
}

async function main() {
  const tables = {}
  for (const t of TABLES) {
    try {
      tables[t] = await runQuery(`select * from public."${t}"`)
      console.log(`${t}: ${tables[t].length} صف`)
    } catch (e) {
      console.warn(`${t}: فشل (${e.message}) — سيُترك فارغاً`)
      tables[t] = []
    }
  }

  const authUsers = await runQuery(
    `select id, email, encrypted_password, raw_user_meta_data, created_at from auth.users`
  )
  console.log(`auth.users: ${authUsers.length} مستخدم`)

  // avatar_url يشير لروابط supabase سحابية — تُصفّر لأن الملفات لا تنتقل
  for (const p of tables.profiles || []) {
    if (p.avatar_url && /^https?:/i.test(p.avatar_url)) p.avatar_url = null
  }

  const seed = {
    seed_version: Date.now(),
    exported_at: new Date().toISOString(),
    tables,
    users: authUsers.map((u) => ({
      id: u.id,
      email: u.email,
      password_hash: u.encrypted_password,
      raw_user_meta_data: u.raw_user_meta_data,
      created_at: u.created_at,
    })),
  }

  const out = path.resolve('public/seed-data.json')
  fs.writeFileSync(out, JSON.stringify(seed))
  const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(2)
  console.log(`\nتم الحفظ: ${out} (${mb} MB)`)
  console.log('ملاحظة: مرفقات التخزين (patient-attachments) لا تنتقل — الملفات الجديدة فقط تُحفظ محلياً.')
}

main().catch((e) => {
  console.error('فشل التصدير:', e.message)
  process.exit(1)
})
