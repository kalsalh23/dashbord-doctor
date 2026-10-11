// Survey supabase-js API usage across src/ to size the offline adapter.
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

const methods = {}
const perFile = {}
const re =
  /supabase\s*\.\s*(from|rpc|auth|storage|channel|functions|removeChannel)\b|\.\s*(eq|neq|gt|gte|lt|lte|like|ilike|or|in|is|contains|order|limit|range|single|maybeSingle|select|insert|update|upsert|delete|textSearch)\s*\(/g

for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  let m
  const mine = new Set()
  while ((m = re.exec(t))) {
    if (m[1]) {
      methods[m[1]] = (methods[m[1]] || 0) + 1
      mine.add(m[1])
    } else {
      methods[m[2]] = (methods[m[2]] || 0) + 1
      mine.add(m[2])
    }
  }
  if (mine.size) perFile[f] = [...mine].join(',')
}

console.log('METHOD COUNTS:')
for (const [k, v] of Object.entries(methods).sort((a, b) => b[1] - a[1]))
  console.log(String(v).padStart(4), k)

console.log('\nFILES (' + Object.keys(perFile).length + '):')
for (const [f, v] of Object.entries(perFile)) console.log(f.replace(/\\/g, '/'), '=>', v)
