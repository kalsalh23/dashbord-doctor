// فحص حالة التطبيق العام: هل تظهر رسالة عدم وجود حسابات؟ وهل القاعدة فارغة؟
async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json()
  const page = list.find((t) => t.type === 'page')
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
    return r.result.value
  }
  const st = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const count = (t) => new Promise((res) => { const q = idx.getAll(t); q.onsuccess = () => res(q.result.length) });
    const users = await count('__users');
    const clinics = await count('clinics');
    db.close();
    return {
      users,
      clinics,
      hintShown: document.body.innerText.includes('clinic-data.json'),
      bodyText: document.body.innerText.slice(0, 250),
    };
  })()`)
  console.log('مستخدمون في القاعدة:', st.users, '| عيادات:', st.clinics)
  console.log('رسالة الإرشاد ظاهرة:', st.hintShown)
  console.log('نص الشاشة:', st.bodyText.replace(/\n/g, ' | ').slice(0, 200))
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
