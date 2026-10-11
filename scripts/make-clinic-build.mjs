// ============================================================
// بناء نسخة تطبيق مخصصة لعيادة واحدة — بياناتها هي فقط
// الاستخدام:
//   node scripts/make-clinic-build.mjs "اسم العيادة"
//   node scripts/make-clinic-build.mjs --list          (عرض العيادات المتاحة)
//   node scripts/make-clinic-build.mjs "اسم العيادة" --build   (بناء exe كامل)
// المصدر: data/full-seed.json (التصدير الكامل من Supabase)
// الناتج: public/seed-data.json (المفلترة) + exe باسم ClinicManager-<العيادة>.exe
// ============================================================
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const FULL = path.resolve('data/full-seed.json')
const args = process.argv.slice(2)
const listOnly = args.includes('--list')
const doBuild = args.includes('--build')
const fileOnly = args.includes('--file-only')
const fromIdx = args.indexOf('--from')
const fromFile = fromIdx >= 0 ? args[fromIdx + 1] : null
const clinicArg = args.find((a, i) => !a.startsWith('--') && !(fromIdx >= 0 && (i === fromIdx || i === fromIdx + 1)))

const sourceFile = fromFile || FULL
if (!fs.existsSync(sourceFile)) {
  console.error('ملف البيانات غير موجود: ' + sourceFile)
  console.error('الخيارات:')
  console.error('  1) SUPA_MGMT_TOKEN=... npm run export:data   ثم move public\\seed-data.json data\\full-seed.json')
  console.error('  2) صدّر «نسخة احتياطية كاملة» من لوحة إدارة النظام في التطبيق، ثم مررها هنا بـ --from <الملف>')
  process.exit(1)
}

const seed = JSON.parse(fs.readFileSync(sourceFile, 'utf8'))
console.log('المصدر: ' + sourceFile)
const clinics = seed.tables.clinics || []

if (listOnly || !clinicArg) {
  console.log('العيادات المتاحة (' + clinics.length + '):')
  for (const c of clinics) {
    const staff = (seed.tables.profiles || []).filter((p) => p.clinic_id === c.id).length
    const patients = (seed.tables.patients || []).filter((p) => p.clinic_id === c.id).length
    console.log(`  • ${c.name}  (مستخدمون: ${staff}، مرضى: ${patients})`)
  }
  process.exit(0)
}

// مطابقة بالاسم (جزئي) أو بالمعرف
const q = clinicArg.trim().toLowerCase()
const clinic = clinics.find((c) => c.id.toLowerCase() === q) ||
  clinics.find((c) => String(c.name || '').toLowerCase().includes(q))
if (!clinic) {
  console.error('لم أجد عيادة تطابق: ' + clinicArg + ' — استخدم --list لعرض الأسماء')
  process.exit(1)
}
console.log('العيادة المختارة: ' + clinic.name + ' (' + clinic.id + ')')

const TABLES = Object.keys(seed.tables)
const filtered = {}
for (const t of TABLES) {
  const rows = seed.tables[t] || []
  filtered[t] = rows.filter((r) => r.clinic_id === clinic.id)
}
// clinics: صف العيادة نفسها فقط
filtered.clinics = [clinic]

// المستخدمون: فقط من يعمل في هذه العيادة
const staffIds = new Set((filtered.profiles || []).map((p) => p.id))
const users = (seed.users || []).filter((u) => staffIds.has(u.id))

const out = {
  seed_version: Date.now(),
  exported_at: new Date().toISOString(),
  clinic_only: clinic.name,
  tables: filtered,
  users,
}

const slug = String(clinic.name || 'clinic')
  .replace(/[\\/:*?"<>|]/g, '')
  .replace(/\s+/g, '-')
  .slice(0, 40)

fs.mkdirSync('data', { recursive: true })
fs.writeFileSync('public/seed-data.json', JSON.stringify(out))

const counts = Object.entries(filtered)
  .filter(([, rows]) => rows.length)
  .map(([t, rows]) => `${t}:${rows.length}`)
  .join('، ')
console.log('البيانات المفلترة: ' + counts)
console.log('المستخدمون: ' + users.length + ' (بريدهم وكلمات مرورهم كما هي)')
console.log('تم كتابة public/seed-data.json')

// ===== وضع ملف البيانات فقط: يوزَّع مع التطبيق العام (تطبيق واحد + ملف لكل عيادة) =====
if (fileOnly) {
  fs.mkdirSync('release', { recursive: true })
  const outFile = path.resolve(`release/clinic-data-${slug}.json`)
  fs.writeFileSync(outFile, JSON.stringify(out))
  const kb = (fs.statSync(outFile).size / 1024).toFixed(0)
  console.log(`\nملف بيانات العيادة جاهز للإرسال: ${outFile} (${kb} KB)`)
  console.log('يضعه الطبيب بجانب التطبيق باسم clinic-data.json ثم يفتح التطبيق مرة واحدة.')
  process.exit(0)
}

if (doBuild) {
  console.log('\n— بناء exe مخصص للعيادة —')
  execSync('npm run build', { stdio: 'inherit' })
  execSync('npx electron-builder --win portable -c.electronDist=node_modules/electron/dist', { stdio: 'inherit' })
  const src = path.resolve('release/ClinicManager 1.0.0.exe')
  const dest = path.resolve(`release/ClinicManager-${slug}.exe`)
  if (fs.existsSync(src)) fs.renameSync(src, dest)
  console.log('\nالملف الجاهز للإرسال: ' + dest)
}
