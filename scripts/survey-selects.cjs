// Catalog every select(...) string and rpc name / storage call / auth call used in src/.
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

const selects = new Set()
const rpcs = new Set()
const other = []

for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  // select('...') calls
  for (const m of t.matchAll(/\.select\(\s*(['"`])([\s\S]*?)\1/g)) selects.add(m[2])
  for (const m of t.matchAll(/\.rpc\(\s*['"]([\w-]+)['"]/g)) rpcs.add(m[1])
  for (const m of t.matchAll(/supabase\.(auth|storage)\.[\w.]+\(/g)) other.push(f + ' => ' + m[0])
  for (const m of t.matchAll(/\.from\(\s*['"]([\w-]+)['"]\s*\)/g))
    other.push(f + ' FROM ' + m[1])
}

console.log('SELECTS (' + selects.size + '):')
for (const s of [...selects].sort()) console.log('  ' + s)
console.log('\nRPCS:')
for (const r of [...rpcs].sort()) console.log('  ' + r)
console.log('\nAUTH/STORAGE/FROM:')
for (const o of [...new Set(other)]) console.log('  ' + o)
