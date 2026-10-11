// فحص: هل clinic-data.json موجود؟ وماذا يقدّم الخادم الداخلي في /seed-data.json؟
async function main() {
  const fs = require('fs')
  const release = 'release'
  console.log('ملفات release:', fs.readdirSync(release).join(', '))

  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json()
  const page = list.find((t) => t.type === 'page')
  const url = new URL(page.url)
  console.log('منفذ الخادم الداخلي:', url.port)

  const res = await fetch(url.origin + '/seed-data.json')
  const seed = await res.json()
  console.log('seed-version:', seed.seed_version, '| public_empty:', seed.public_empty || false)
  console.log('عدد العيادات في المقدَّم:', (seed.tables?.clinics || []).length)
  console.log('عدد المستخدمين في المقدَّم:', (seed.users || []).length)
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
