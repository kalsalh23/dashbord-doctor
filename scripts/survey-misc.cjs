// Check for count/head/range options and any other supabase-js features
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
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  t.split(/\r?\n/).forEach((l, i) => {
    if (/\{\s*count|head:\s*true|\.range\(|\.explain\(|abortSignal|\.csv\(|foreignTable|returning:|ignoreDuplicates|defaultToNull|auth\.admin|auth\.signUp|auth\.resetPassword/.test(l))
      console.log(f + ':' + (i + 1) + ': ' + l.trim().slice(0, 200))
  })
}
console.log('done')
