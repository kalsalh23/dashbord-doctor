// اختبار الثبات: أضف مريضاً → أغلق التطبيق → افتحه → تأكد أن المريض ما زال موجوداً
const NAME = 'مريض اختبار الثبات ١٠٢'
async function connect() {
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
  return { ws, evalJs }
}

async function main() {
  const { ws, evalJs } = await connect()
  // جلسة موظفة عيادة مازن + أضف مريضاً عبر قاعدة التطبيق مباشرة (INSERT عبر محرك التطبيق غير معرّض —
  // نستخدم واجهة IDB نفسها كما يفعل المحرك)
  const added = await evalJs(`(async () => {
    localStorage.setItem('cm_local_session', JSON.stringify({
      user: { id: 'd32341b4-ea86-461f-902c-5828f00a3fa7', email: 'x@y', user_metadata: {} },
      access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
    }));
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    await new Promise((res, rej) => {
      const tx = db.transaction('rows', 'readwrite');
      tx.objectStore('rows').put({ t: 'patients', id: 'test-persist-102', clinic_id: 'feae3070-7837-4f7d-9353-b7139784d229', full_name: '${NAME}', phone: '000000000', created_at: new Date().toISOString() });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
    return true;
  })()`)
  console.log('أضيف مريض الاختبار:', added)
  ws.close()

  // أغلق وافتح التطبيق
  const { execSync } = await import('node:child_process')
  execSync('powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -like \'*ClinicManager*\' } | Stop-Process -Force"')
  await new Promise((r) => setTimeout(r, 3000))
  execSync('start "" "release\\ClinicManager.exe" --remote-debugging-port=9223', { shell: 'cmd.exe' })
  await new Promise((r) => setTimeout(r, 12000))

  const { ws: ws2, evalJs: evalJs2 } = await connect()
  const check = await evalJs2(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const count = (t) => new Promise((res) => { const q = idx.getAll(t); q.onsuccess = () => res(q.result.length) });
    const patients = await count('patients');
    const users = await count('__users');
    const all = await new Promise((res) => { const q = idx.getAll('patients'); q.onsuccess = () => res(q.result) });
    db.close();
    return { patients, users, testPatientExists: all.some((p) => p.id === 'test-persist-102' || p.full_name === '${NAME}') };
  })()`)
  console.log('بعد إعادة التشغيل → مرضى:', check.patients, '| مستخدمون:', check.users, '| مريض الاختبار ما زال موجوداً:', check.testPatientExists)
  ws2.close()
  console.log(check.testPatientExists ? 'PERSISTENCE_OK' : 'PERSISTENCE_FAILED')
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
