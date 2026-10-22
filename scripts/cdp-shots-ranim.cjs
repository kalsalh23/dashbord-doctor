// لقطات شاشة نهائية لواجهات عيادة النساء والتوليد
const fs = require('fs')
const path = require('path')
const OUT = path.resolve('screenshots')

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  const DOCTOR = 'c9e2f4a8-6d31-4b7e-a52c-8f9d1e3b6742'
  const go = async (url) => {
    await evalJs(`(async () => {
      localStorage.setItem('cm_local_session', JSON.stringify({
        user: { id: '${DOCTOR}', email: 'ranim@noor-clinic.com', user_metadata: {} },
        access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000) + 3600,
      }));
      location.href = '${url}'; return true;
    })()`)
    await new Promise((r) => setTimeout(r, 2800))
  }
  const snap = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(s.data, 'base64'))
    console.log('saved', name)
  }

  const patientId = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const visits = await new Promise((res) => { const q = idx.getAll('visits'); q.onsuccess = () => res(q.result) });
    db.close();
    const v = visits.find(x => x.specialty_data?.obgyn?.lmp);
    return v?.patient_id || null;
  })()`)

  await go('http://127.0.0.1:5199/doctor')
  await snap('ranim-1-dashboard.png')
  await go('http://127.0.0.1:5199/doctor/patients')
  await snap('ranim-2-patients.png')
  await go('http://127.0.0.1:5199/doctor/patients/' + patientId)
  await snap('ranim-3-profile.png')
  await go('http://127.0.0.1:5199/doctor/consultation/new/' + patientId)
  await snap('ranim-4-consult-step1.png')

  // الخطوة 3: المخطط
  await evalJs(`(async () => {
    const s = [...document.querySelectorAll('.ob-step')]; s[2].click();
    await new Promise(r => setTimeout(r, 1200)); return true;
  })()`)
  await snap('ranim-5-chart.png')

  // نافذة إضافة نتيجة
  await evalJs(`(async () => {
    const r = [...document.querySelectorAll('[data-region], .ob-region, svg [role="button"], svg g')].find(e => e.getAttribute && (e.getAttribute('data-region')||'').includes('uterus_body'));
    if (r) r.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1000));
    return true;
  })()`)
  await snap('ranim-6-finding-modal.png')
  console.log('DONE')
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
