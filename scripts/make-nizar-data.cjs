// توليد ملف بيانات عيادة د. نزار من النسخة الكاملة — للتوزيع مع التطبيق العام
// يمرر معرف العيادة (ASCII) لسكربت make-clinic-build لتجنب مشاكل ترميز العربية في سطر الأوامر
const fs = require('fs')
const path = require('path')
const { execSync } = require('node:child_process')

// 1) ابحث عن ملف النسخة الكاملة في release (الذي يحوي إعدادات قالب نزار)
const releaseDir = 'release'
const files = fs.readdirSync(releaseDir).filter((f) => f.startsWith('clinic-data') && f.endsWith('.json'))
let fullFile = null
let nizarClinic = null
for (const f of files) {
  const p = path.join(releaseDir, f)
  const seed = JSON.parse(fs.readFileSync(p, 'utf8'))
  const settings = seed.tables.clinic_settings || []
  if (settings.some((s) => s.prescription_template === 'nizar')) {
    fullFile = p
    const clinics = seed.tables.clinics || []
    // العيادة التي يقابلها إعدادات قالب نزار — عبر doctor_name في الإعدادات
    const nizarSettings = settings.find((s) => s.prescription_template === 'nizar')
    nizarClinic = clinics.find((c) => c.name && nizarSettings.doctor_name && c.name.includes(nizarSettings.doctor_name.replace(/^د\s*\.?\s*/, '').trim())) ||
      clinics.find((c) => (c.name || '').includes('نزار'))
    break
  }
}
if (!fullFile || !nizarClinic) {
  console.error('لم أجد ملف النسخة الكاملة أو عيادة نزار فيه')
  process.exit(1)
}
console.log('الملف المصدر:', fullFile)
console.log('عيادة نزار:', nizarClinic.name, '|', nizarClinic.id)

// 2) ضع النسخة الكاملة في مسارها الافتراضي ثم مرر المعرف
fs.copyFileSync(fullFile, path.join('data', 'full-seed.json'))

// 3) احتياط ملف البذر العام ثم نفّذ وضع ملف-البيانات-فقط
const pubSeed = 'public/seed-data.json'
const backup = fs.readFileSync(pubSeed, 'utf8')
try {
  execSync(`node scripts/make-clinic-build.mjs ${nizarClinic.id} --file-only`, { stdio: 'inherit' })
} finally {
  // 4) أعده فوراً — الملف العام يبقى فارغاً (بيانات نزار تُوزع كملف خارجي منفصل)
  fs.writeFileSync(pubSeed, backup)
  console.log('أعيد public/seed-data.json إلى النسخة الفارغة')
}
