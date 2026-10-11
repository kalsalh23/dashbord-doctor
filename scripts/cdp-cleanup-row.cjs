// حذف مريض الاختبار من قاعدة بيانات تطبيق المالك
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
  const r = await send('Runtime.evaluate', {
    expression: `(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
      await new Promise((res, rej) => {
        const tx = db.transaction('rows', 'readwrite');
        tx.objectStore('rows').delete(['patients', 'persist-final-99']);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
      db.close();
      return true;
    })()`,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200))
  console.log('حذف مريض الاختبار:', r.result.value)
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
