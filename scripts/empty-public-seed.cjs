// تجهيز بناء التطبيق العام: تفريغ النسخة المدمجة من البيانات
// (البيانات الكاملة تبقى في data/full-seed.json)
const fs = require('fs')

if (!fs.existsSync('data/full-seed.json')) {
  console.error('data/full-seed.json غير موجود — صدّر البيانات أولاً')
  process.exit(1)
}
const size = fs.statSync('data/full-seed.json').size
fs.writeFileSync(
  'public/seed-data.json',
  JSON.stringify({
    seed_version: 0,
    exported_at: new Date().toISOString(),
    public_empty: true,
    tables: {},
    users: [],
  })
)
console.log(`تم: النسخة المدمجة فارغة الآن، والتصدير الكامل محفوظ في data/full-seed.json (${(size / 1024).toFixed(0)} KB)`)
