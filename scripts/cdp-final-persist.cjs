// اختبار ثبات مبسّط ومتين: اتصال بمحاولات متكررة + إغلاق لطيف
const { execSync } = require('node:child_process')

const NAME = 'مريض ثبات نهائي ٩٩'

async function fetchJson(url, tries = 20, delay = 1500) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return await r.json()
    } catch {}
    await new Promise((res) => setTimeout(res, delay))
  }
  throw new Error('fetch failed: ' + url)
}

async function connect() {
  const list = await fetchJson('http://127.0.0.1:9223/json/list')
  const page = list.find((t) => t.type === 'page' && t.url.includes('127.0.0.1'))
  if (!page) throw new Error('no page target: ' + JSON.stringify(list).slice(0, 200))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  }
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 200))
    return r.result.value
  }
  return { ws, send, evalJs }
}

function launch() {
  execSync('start "" "release\\ClinicManager.exe" --remote-debugging-port=9223', { shell: 'cmd.exe' })
}
function killAll() {
  execSync('powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -like \'*ClinicManager*\' } | Stop-Process -Force"')
}

const stats = `(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
  const tx = db.transaction('rows', 'readonly');
  const idx = tx.objectStore('rows').index('by-table');
  const all = await new Promise((res) => { const q = idx.getAll('patients'); q.onsuccess = () => res(q.result) });
  db.close();
  return { total: all.length, hasTest: all.some((p) => p.full_name === '${NAME}') };
})()`

async function main() {
  killAll()
  await new Promise((r) => setTimeout(r, 3000))
  launch()
  await new Promise((r) => setTimeout(r, 6000))
  const c1 = await connect()
  const before = await c1.evalJs(stats())
  console.log('قبل الإضافة: مرضى =', before.total, '| الاختبار موجود:', before.hasTest)

  await c1.evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    await new Promise((res, rej) => {
      const tx = db.transaction('rows', 'readwrite');
      tx.objectStore('rows').put({ t: 'patients', id: 'final-persist-99', clinic_id: 'feae3070-7837-4f7d-9353-b7139784d229', full_name: '${NAME}', phone: '099', created_at: new Date().toISOString() });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
    return true;
  })()`)

  // إغلاق لطيف (كما يفعل المستخدم: زر الإغلاق)
  await c1.send('Browser.close').catch((e) => console.log('close:', e.message))
  c1.ws.close().catch(() => {})
  await new Promise((r) => setTimeout(r, 6000))

  killAll()
  await new Promise((r) => setTimeout(r, 2000))
  launch()
  await new Promise((r) => setTimeout(r, 6000))
  const c2 = await connect()
  const after = await c2.evalJs(stats())
  console.log('بعد الإغلاق وإعادة الفتح: مرضى =', after.total, '| الاختبار موجود:', after.hasTest)
  console.log(after.hasTest ? 'PERSISTENCE_OK' : 'PERSISTENCE_FAILED')
  c2.ws.close().catch(() => {})
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
