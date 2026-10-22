// فحص عرض المريضات وملف المريضة + الرسم اليدوي في عيادة النساء والتوليد
const fs = require('fs')
const path = require('path')

const OUT = path.resolve('screenshots')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

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
  await send('Runtime.enable')

  const DOCTOR = 'c9e2f4a8-6d31-4b7e-a52c-8f9d1e3b6742'
  const CLINIC = 'b7d41c26-9e58-4a3f-8c17-2d6e95f0a741'

  // ابحث عن مريضة الاختبار السابقة
  const patientId = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const all = await new Promise((res) => { const q = idx.getAll('patients'); q.onsuccess = () => res(q.result) });
    db.close();
    return all.find(p => p.full_name && p.full_name.includes('مريضة اختبار'))?.id || null;
  })()`)
  console.log('PATIENT:', patientId)
  if (!patientId) throw new Error('لا توجد مريضة اختبار')

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
    await new Promise((r) => setTimeout(r, 2600))
  }

  // 1) صفحة المريضات
  await go('http://127.0.0.1:5199/doctor/patients')
  const patientsPage = await evalJs(`({
    cards: document.querySelectorAll('.ob-card').length,
    chips: [...document.querySelectorAll('.ob-chip')].map(c => c.innerText.replace(/\\n/g,' ')).slice(0, 12),
    body: document.body.innerText.slice(0, 200).replace(/\\n/g, ' | '),
  })`)
  console.log('PATIENTS-PAGE:', JSON.stringify(patientsPage, null, 1))

  // 2) ملف المريضة
  await go('http://127.0.0.1:5199/doctor/patients/' + '${patientId}'.replace('${patientId}', patientId))
  const profile = await evalJs(`({
    h1: document.querySelector('h1')?.innerText,
    cards: document.querySelectorAll('.ob-card').length,
    text: document.body.innerText.slice(0, 420).replace(/\\n/g, ' | '),
  })`)
  console.log('PROFILE:', JSON.stringify(profile, null, 1))

  // 3) الرسم اليدوي — افتح الكشف وابدأ الرسم على المخطط
  await go('http://127.0.0.1:5199/doctor/consultation/new/' + patientId)
  await evalJs(`(async () => {
    const steps = [...document.querySelectorAll('.ob-step')];
    steps[2].click();
    await new Promise(r => setTimeout(r, 800));
    const btn = [...document.querySelectorAll('button')].find(b => b.innerText.includes('رسم على المخطط'));
    btn?.click();
    await new Promise(r => setTimeout(r, 800));
    return true;
  })()`)

  const canvasBox = await evalJs(`(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  })()`)
  console.log('CANVAS:', JSON.stringify(canvasBox))

  if (canvasBox) {
    const cx = canvasBox.x + canvasBox.w / 2
    const cy = canvasBox.y + canvasBox.h / 2
    const mouse = (type, x, y) =>
      send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 })
    await mouse('mousePressed', cx - 60, cy)
    for (let i = 0; i < 12; i++) {
      await mouse('mouseMoved', cx - 60 + i * 10, cy + Math.sin(i / 2) * 18)
    }
    await mouse('mouseReleased', cx + 60, cy)
    await new Promise((r) => setTimeout(r, 1200))
  }

  const sketchState = await evalJs(`(async () => {
    const cv = document.querySelector('canvas');
    const ctx = cv?.getContext('2d');
    let painted = false;
    try {
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { painted = true; break; }
    } catch (e) { painted = 'err:' + e.message }
    return { painted, tools: document.querySelectorAll('canvas').length };
  })()`)
  console.log('SKETCH:', JSON.stringify(sketchState))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'ranim-sketch.png'), Buffer.from(shot.data, 'base64'))

  // 4) احفظ الكشف وتأكد أن الرسم محفوظ في السجل
  const saved = await evalJs(`(async () => {
    const steps = [...document.querySelectorAll('.ob-step')];
    steps[3].click();
    await new Promise(r => setTimeout(r, 600));
    const areas = [...document.querySelectorAll('textarea')];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(areas[0], 'رسم توضيحي للحالب');
    areas[0].dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    steps[4].click();
    await new Promise(r => setTimeout(r, 500));
    const btn = [...document.querySelectorAll('button')].find(b => b.innerText.includes('إنهاء الكشف وحفظه'));
    btn.click();
    await new Promise(r => setTimeout(r, 2500));
    return document.body.innerText.slice(0, 90).replace(/\\n/g, ' | ');
  })()`)
  console.log('SAVE:', saved)

  const check = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const visits = await new Promise((res) => { const q = idx.getAll('visits'); q.onsuccess = () => res(q.result) });
    db.close();
    const v = visits.filter(x => x.patient_id === '${patientId}').sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''))[0];
    const sk = v?.specialty_data?.sketch;
    return { sketchType: typeof sk, sketchLen: sk ? sk.length : 0, isPng: sk ? sk.startsWith('data:image/png') : false };
  })()`)
  console.log('SKETCH-SAVED:', JSON.stringify(check))
  console.log('DONE')
  ws.close()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
