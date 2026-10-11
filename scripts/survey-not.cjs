// بحث شامل عن أي دالة فلترة postgrest في أي مكان بالملف (حتى داخل سلاسل متعددة الأسطر)
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

const methods = ['not', 'range', 'contains', 'containedBy', 'match', 'filter', 'overlaps', 'textSearch', 'throwOnError', 'explain', 'csv', 'abortSignal', 'head', 'count']
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  for (const m of methods) {
    const re = new RegExp('\\.' + m + '\\s*\\(', 'g')
    let mm
    while ((mm = re.exec(t))) {
      const lineNo = t.slice(0, mm.index).split(/\r?\n/).length
      const line = t.split(/\r?\n/)[lineNo - 1].trim()
      // تجاهل دوال JS العادية الشائعة (not نادر، filter شائع على المصفوفات)
      if (m === 'filter' && !/supabase|from\(/.test(line)) continue
      console.log(`.${m}()  ${f}:${lineNo}: ${line.slice(0, 160)}`)
    }
  }
}
console.log('done')
