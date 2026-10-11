// الفحص النهائي: هل بيانات مريض الاختبار باقية بعد إعادة تشغيل التطبيق؟
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
    if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 200))
    return r.result.value
  }
  const check = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const count = (t) => new Promise((res) => { const q = idx.getAll(t); q.onsuccess = () => res(q.result.length) });
    const patients = await count('patients');
    const users = await count('__users');
    const clinics = await count('clinics');
    const all = await new Promise((res) => { const q = idx.getAll('patients'); q.onsuccess = () => res(q.result) });
    db.close();
    return {
      patients, users, clinics,
      testPatientExists: all.some((p) => p.full_name.includes('ثبات نهائي ٩٩')),
    };
  })()`)
  console.log('مرضى:', check.patients, '| مستخدمون:', check.users, '| عيادات:', check.clinics)
  console.log('مريض الاختبار (أُدخل قبل الإغلاق) موجود بعد إعادة التشغيل:', check.testPatientExists)
  console.log(check.testPatientExists ? 'PERSISTENCE_OK' : 'PERSISTENCE_FAILED')
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
