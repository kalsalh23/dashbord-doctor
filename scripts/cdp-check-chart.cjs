// فحص محتوى خطوة المخطط Anatomic عبر DOM
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
    if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 700))
    return r.result.value
  }
  await send('Page.enable')
  const DOCTOR = 'c9e2f4a8-6d31-4b7e-a52c-8f9d1e3b6742'
  const patientId = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const visits = await new Promise((res) => { const q = idx.getAll('visits'); q.onsuccess = () => res(q.result) });
    db.close();
    return visits.find(x => x.specialty_data?.obgyn?.lmp)?.patient_id || null;
  })()`)
  await evalJs(`(async () => {
    localStorage.setItem('cm_local_session', JSON.stringify({
      user: { id: '${DOCTOR}', email: 'ranim@noor-clinic.com', user_metadata: {} },
      access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000) + 3600 }));
    location.href = 'http://127.0.0.1:5199/doctor/consultation/new/${patientId}'; return true;
  })()`)
  await new Promise((r) => setTimeout(r, 3000))
  await evalJs(`(async () => { const s=[...document.querySelectorAll('.ob-step')]; s[2].click(); await new Promise(r=>setTimeout(r,1200)); return true })()`)

  const chart = await evalJs(`({
    tabs: [...document.querySelectorAll('.ob-card button')].map(b=>b.innerText.trim()).filter(Boolean).slice(0,16),
    regionLabels: [...document.querySelectorAll('svg text')].map(t=>t.textContent).slice(0,16),
    hasLegend: document.body.innerText.includes('اضغطي على المنطقة'),
    toolbar: [...document.querySelectorAll('button')].map(b=>b.title||b.innerText.trim()).filter(Boolean).slice(0,18),
  })`)
  console.log('CHART-STEP:', JSON.stringify(chart, null, 1))

  // نافذة إضافة النتيجة
  const modal = await evalJs(`(async () => {
    const g = [...document.querySelectorAll('svg [data-region]')];
    if (!g.length) return 'no data-region elements';
    g.find(x => x.getAttribute('data-region') === 'uterus_body')?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    await new Promise(r=>setTimeout(r,1000));
    const ov = document.querySelector('.fixed.inset-0.z-50');
    return { open: !!ov, text: ov?.innerText.replace(/\\n/g,' | ').slice(0,400) };
  })()`)
  console.log('FINDING-MODAL:', JSON.stringify(modal, null, 1))
  console.log('DONE')
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
