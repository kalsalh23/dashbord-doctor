// فحص: هل كل استعلامات التطبيق مربوطة بـ clinic_id الخاص بالمستخدم المسجل؟
const fs = require('fs')
const path = require('path')

const files = []
;(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    const s = fs.statSync(p)
    if (s.isDirectory()) walk(p)
    else if (/\.(jsx?|js)$/.test(f)) files.push(p)
  }
})('src')

// لكل from('table'): هل يظهر clinic_id ضمن 15 سطراً تالية؟
let unfiltered = 0
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (/supabase\s*\.\s*from\(/.test(lines[i]) || (/\.\s*from\(\s*['"]/.test(lines[i]) && /supabase|await|return/i.test(lines.slice(Math.max(0, i - 3), i).join(' ')))) {
      const chunk = lines.slice(i, i + 18).join('\n')
      const hasClinicFilter = /clinic_id/.test(chunk)
      const table = (lines[i].match(/from\(\s*['"]([\w-]+)['"]/) || [])[1] || '?'
      // جداول لا تحتاج فلترة عيادة (تُقرأ عامة أو تُدار من لوحة المالك)
      const exempt = ['clinic_settings', 'medication_catalog', 'dental_pricebook', 'clinics', '__users', 'audit_logs', 'profiles']
      if (!hasClinicFilter && !exempt.includes(table)) {
        unfiltered++
        console.log(`NO clinic_id FILTER: ${f}:${i + 1} table=${table}`)
      }
    }
  }
}
console.log(unfiltered === 0 ? 'OK: كل الاستعلامات الحساسة مربوطة بـ clinic_id' : `\nعدد الاستعلامات غير المفلترة: ${unfiltered}`)
