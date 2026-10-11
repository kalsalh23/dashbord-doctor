// البحث عن توكن إدارة Supabase في ملفات المشروع والمجلدات الشائعة
const fs = require('fs')
const path = require('path')
const os = require('os')

const roots = ['.', path.join(os.homedir(), '.zcode'), path.resolve('..')].filter((r) => {
  try { fs.statSync(r); return true } catch { return false }
})
const hits = []
const skip = new Set(['node_modules', '.git', 'dist', 'release', '.vercel', 'Cache', 'cache'])

function scan(dir, depth) {
  if (depth > 3 || hits.length > 10) return
  let items = []
  try { items = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of items) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (skip.has(e.name)) continue
      scan(p, depth + 1)
    } else if (e.size > 0 && e.size < 500000) {
      try {
        const t = fs.readFileSync(p, 'utf8')
        const m = t.match(/SUPA_MGMT_TOKEN[=:][^\s"']+/i) || t.match(/sbp_[a-f0-9]{20,}/i)
        if (m) hits.push(p + '  =>  ' + m[0].slice(0, 90))
      } catch {}
    }
  }
}
for (const r of roots) scan(r, 0)
console.log(hits.length ? hits.join('\n') : 'NO_TOKEN_FOUND')
