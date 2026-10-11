// اختبار ثبات نظيف: مثيل واحد، إضافة مريض، إغلاق لطيف، إعادة فتح، فحص
const { execSync } = require('node:child_process')

const APP = 'release\\ClinicManager.exe'
const NAME = 'مريض ثبات نظيف ٧٧'

function killAll() {
  execSync('powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -like \'*ClinicManager*\' } | Stop-Process -Force"')
}

async function connect() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json()
  const page = list.find((t) => t.type === 'page' && t.url.includes('127.0.0.1'))
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

const stats = (nameExpr) => `(async () => {
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
  execSync(`start "" "${APP}" --remote-debugging-port=9223`, { shell: 'cmd.exe' })
  await new Promise((r) => setTimeout(r, 14000))

  let { ws, send, evalJs } = await connect()
  let before = await evalJs(stats())
  console.log('قبل الإضافة: مرضى =', before.total)

  await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    await new Promise((res, rej) => {
      const tx = db.transaction('rows', 'readwrite');
      tx.objectStore('rows').put({ t: 'patients', id: 'clean-persist-77', clinic_id: 'feae3070-7837-4f7d-9353-b7139784d229', full_name: '${NAME}', phone: '077', created_at: new Date().toISOString() });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
    return true;
  })()`)
  const mid = await evalJs(stats())
  console.log('بعد الإضافة: مرضى =', mid.total, '| الاختبار موجود:', mid.hasTest)

  // إغلاق لطيف عبر CDP (Browser.close) — مثل ضغط زر الإغلاق
  await send('Browser.close').catch((e) => console.log('browser close:', e.message))
  await new Promise((r) => setTimeout(r, 5000))

  execSync(`start "" "${APP}" --remote-debugging-port=9223`, { shell: 'cmd.exe' })
  await new Promise((r) => setTimeout(r, 14000))

  const c2 = await connect()
  const after = await c2.evalJs(stats())
  console.log('بعد الإغلاق وإعادة الفتح: مرضى =', after.total, '| الاختبار موجود:', after.hasTest)
  console.log(after.hasTest ? 'PERSISTENCE_OK' : 'PERSISTENCE_FAILED')
  c2.ws.close()
  ws.close().catch(() => {})
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
