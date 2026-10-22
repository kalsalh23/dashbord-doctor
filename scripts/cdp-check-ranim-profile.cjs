// فحص ملف المريضة (مريضة لها كشوف) ولوحة اليوم
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
    if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 600))
    return r.result.value
  }
  await send('Page.enable')

  const DOCTOR = 'c9e2f4a8-6d31-4b7e-a52c-8f9d1e3b6742'
  // المريضة التي لها كشوف
  const patientId = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const visits = await new Promise((res) => { const q = idx.getAll('visits'); q.onsuccess = () => res(q.result) });
    db.close();
    return visits.find(v => v.specialty_data && v.specialty_data.obgyn && v.specialty_data.obgyn.lmp)?.patient_id || null;
  })()`)
  console.log('PATIENT WITH VISITS:', patientId)

  const go = async (url) => {
    await evalJs(`(async () => {
      localStorage.setItem('cm_local_session', JSON.stringify({
        user: { id: '${DOCTOR}', email: 'ranim@noor-clinic.com', user_metadata: {} },
        access_token: 'local', token_type: 'bearer',
        expires_at: Math.floor(Date.now()/1000) + 3600,
      }));
      location.href = '${url}';
      return true;
    })()`)
    await new Promise((r) => setTimeout(r, 2800))
  }

  await go('http://127.0.0.1:5199/doctor/patients/' + patientId)
  const profile = await evalJs(`({
    pregnancy: [...document.querySelectorAll('.ob-card p')].map(p=>p.innerText).slice(0,8),
    text: document.body.innerText.replace(/\\n/g,' | ').slice(300, 1100),
  })`)
  console.log('PROFILE:', JSON.stringify(profile, null, 1))

  // افتح تفاصيل أول كشف (الخط الزمني)
  const expanded = await evalJs(`(async () => {
    const btns = [...document.querySelectorAll('button')].filter(b => b.innerText.includes('تكيس') || b.innerText.includes('رسم توضيحي'));
    if (!btns.length) return 'لا يوجد سجل';
    btns[0].click();
    await new Promise(r => setTimeout(r, 900));
    const imgs = document.querySelectorAll('img[alt="رسوم الكشف"]');
    return { opened: true, sketchImages: imgs.length, text: document.body.innerText.includes('نتائج المخطط') };
  })()`)
  console.log('EXPANDED:', JSON.stringify(expanded))

  await go('http://127.0.0.1:5199/doctor')
  const dash = await evalJs(`({
    hero: document.querySelector('.ob-hero')?.innerText.replace(/\\n/g,' | ').slice(0,220),
    pills: [...document.querySelectorAll('.ob-pill')].map(p=>p.innerText.replace(/\\n/g,' ')),
    sections: [...document.querySelectorAll('h2')].map(h=>h.innerText.replace(/\\n/g,' ')),
  })`)
  console.log('DASHBOARD:', JSON.stringify(dash, null, 1))
  console.log('DONE')
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
