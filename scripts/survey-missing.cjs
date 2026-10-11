// اكتشاف كل الدوال المستخدمة على سلاسل استعلام supabase والمفقودة من المحرك المحلي
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

const implemented = new Set([
  'from', 'rpc', 'auth', 'storage', 'channel', 'removeChannel',
  'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
  'or', 'order', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'upsert', 'delete',
  'then', 'catch', 'finally', 'range', 'contains', 'abortSignal', 'csv', 'explain', 'textSearch',
  // supabase-js auth/storage calls
  'getSession', 'getUser', 'signInWithPassword', 'signOut', 'onAuthStateChange',
  'upload', 'getPublicUrl', 'createSignedUrl', 'remove',
])
const unknown = new Map()
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  // التقاط السلاسل: .from('x').method(...).method(...)
  const chains = t.match(/supabase\s*\.\s*from\([\s\S]*?\)(?=\s*[\n\r]|;|\))/g) || []
  for (const line of t.split(/\r?\n/)) {
    if (!/supabase/.test(line)) continue
    for (const m of line.matchAll(/\.(\w+)\s*\(/g)) {
      const name = m[1]
      if (!implemented.has(name)) {
        const key = name
        if (!unknown.has(key)) unknown.set(key, [])
        unknown.get(key).push(f + ': ' + line.trim().slice(0, 160))
      }
    }
  }
}
if (!unknown.size) console.log('ALL METHODS IMPLEMENTED')
for (const [name, locs] of unknown) {
  console.log('\nMISSING .' + name + '():')
  for (const l of [...new Set(locs)].slice(0, 5)) console.log('   ' + l)
}
