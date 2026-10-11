// خطوة ١: أضف مريض اختبار وسجّل النتيجة في ملف (بلا اعتماد على stdout)
const fs = require('fs')
const log = (m) => fs.appendFileSync('persist-log.txt', m + '\n')
async function main() {
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
  const r = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    await new Promise((res, rej) => {
      const tx = db.transaction('rows', 'readwrite');
      tx.objectStore('rows').put({ t: 'patients', id: 'persist-final-99', clinic_id: 'feae3070-7837-4f7d-9353-b7139784d229', full_name: 'مريض ثبات نهائي ٩٩', phone: '099', created_at: new Date().toISOString() });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
    return true;
  })()`)
  log('ADD_OK=' + r)
  ws.close()
}
main().catch((e) => { log('ADD_FAILED=' + e.message); process.exit(1) })
