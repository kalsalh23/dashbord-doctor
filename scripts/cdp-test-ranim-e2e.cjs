// اختبار شامل لواجهة كشف النساء والتوليد:
//  ينشئ مريضة، يفتح الكشف، يمرّ على الخطوات، يسجّل نتيجة على المخطط، يحفظ،
//  ثم يتحقق من-row الزيارة في قاعدة البيانات المحلية
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

  const CLINIC = 'b7d41c26-9e58-4a3f-8c17-2d6e95f0a741'
  const DOCTOR = 'c9e2f4a8-6d31-4b7e-a52c-8f9d1e3b6742'

  // 1) أنشئ مريضة تجريبية داخل القاعدة المحلية
  const patientId = await evalJs(`(async () => {
    const id = crypto.randomUUID();
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const t = db.transaction('rows', 'readwrite');
    const s = t.objectStore('rows');
    const dob = new Date(1994, 4, 12).toISOString().slice(0, 10);
    s.put({ t: 'patients', id, clinic_id: '${CLINIC}', full_name: 'مريضة اختبار نساء', phone: '0999888777', date_of_birth: dob, gender: 'female', created_by: '${DOCTOR}', created_at: new Date().toISOString() });
    await new Promise((res) => { t.oncomplete = res });
    db.close();
    return id;
  })()`)
  console.log('PATIENT:', patientId)

  // 2) افتح الكشف على هذه المريضة
  await evalJs(`(async () => {
    localStorage.setItem('cm_local_session', JSON.stringify({
      user: { id: '${DOCTOR}', email: 'ranim@noor-clinic.com', user_metadata: {} },
      access_token: 'local', token_type: 'bearer',
      expires_at: Math.floor(Date.now()/1000) + 3600,
    }));
    location.href = 'http://127.0.0.1:5199/doctor/consultation/new/${patientId}';
    return true;
  })()`)
  await new Promise((r) => setTimeout(r, 2800))

  const step1 = await evalJs(`({
    heading: document.querySelector('h1')?.innerText || '',
    steps: document.querySelectorAll('.ob-step').length,
    fields: document.querySelectorAll('.ob-field, .label-base').length,
    err: document.body.innerText.includes('حدث خطأ غير متوقع'),
  })`)
  console.log('STEP-1:', JSON.stringify(step1))

  // 3) املأ تاريخ الحيض (LMP) وتحقق من حساب عمر الحمل
  const gaCalc = await evalJs(`(async () => {
    const inputs = [...document.querySelectorAll('input[type=date]')];
    const lmp = inputs[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(lmp, '2026-05-01');
    lmp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    return document.body.innerText.match(/عمر الحمل:[^\\n]*/)?.[0] || 'لا يوجد';
  })()`)
  console.log('GA:', gaCalc)

  // 4) انتقل إلى خطوة الرسومات واضغط منطقة في الرسم
  const chartInfo = await evalJs(`(async () => {
    const steps = [...document.querySelectorAll('.ob-step')];
    steps[2].click();
    await new Promise(r => setTimeout(r, 900));
    const svg = document.querySelector('svg[aria-label*="تشريحي"]');
    const regions = document.querySelectorAll('svg[aria-label*="تشريحي"] g[style*="cursor"]');
    return { hasSvg: !!svg, regions: regions.length };
  })()`)
  console.log('CHART:', JSON.stringify(chartInfo))

  // اضغط منطقة «جسم الرحم» — نبحث عن المجموعة التي تحمل العنوان
  const clicked = await evalJs(`(async () => {
    const groups = [...document.querySelectorAll('svg[aria-label*="تشريحي"] g')];
    let target = null;
    for (const g of groups) {
      const t = g.querySelector('title')?.textContent || '';
      if (t.includes('جسم الرحم')) { target = g; break; }
    }
    if (!target) return 'لم يُعثر على منطقة جسم الرحم';
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    await new Promise(res => setTimeout(res, 900));
    const modal = document.querySelector('.fixed.z-50');
    return modal ? (modal.innerText || '').slice(0, 90).replace(/\\n/g, ' | ') : 'لا توجد نافذة';
  })()`)
  console.log('REGION-CLICK:', clicked)

  // اختر «تكيس مبيض» من الكتالوج
  const picked = await evalJs(`(async () => {
    const btns = [...document.querySelectorAll('.fixed.z-50 button')];
    const b = btns.find(x => x.innerText.includes('تكيس مبيض'));
    if (!b) return 'لم يُعثر على التشخيص';
    b.click();
    await new Promise(res => setTimeout(res, 700));
    const list = document.body.innerText.includes('تكيس مبيض');
    // أغلق النافذة
    const close = [...document.querySelectorAll('.fixed.z-50 button')].find(x => x.innerText.trim() === 'إغلاق');
    close?.click();
    await new Promise(res => setTimeout(res, 500));
    return 'سُجّل: ' + list;
  })()`)
  console.log('FINDING:', picked)

  // 5) اكتب التشخيص ثم احفظ
  const saved = await evalJs(`(async () => {
    // انتقل لخطوة التشخيص (الخطوة 4)
    const steps = [...document.querySelectorAll('.ob-step')];
    steps[3].click();
    await new Promise(r => setTimeout(r, 700));
    const areas = [...document.querySelectorAll('textarea')];
    const diag = areas[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(diag, 'تكيس مبايض — متابعة');
    diag.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    // خطوة الأدوية ثم الحفظ
    steps[4].click();
    await new Promise(r => setTimeout(r, 600));
    const btn = [...document.querySelectorAll('button')].find(b => b.innerText.includes('إنهاء الكشف وحفظه'));
    if (!btn) return 'زر الحفظ غير موجود';
    btn.click();
    await new Promise(r => setTimeout(r, 2500));
    return document.body.innerText.slice(0, 140).replace(/\\n/g, ' | ');
  })()`)
  console.log('SAVE:', saved)

  // 6) تحقق من سطر الزيارة في قاعدة البيانات
  const check = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const get = (t) => new Promise((res) => { const q = idx.getAll(t); q.onsuccess = () => res(q.result) });
    const visits = await get('visits');
    const payments = await get('payments');
    db.close();
    const v = visits.filter(x => x.patient_id === '${patientId}');
    return {
      visits: v.length,
      diagnosis: v[0]?.diagnosis,
      exam: v[0]?.physical_examination,
      ga: v[0]?.specialty_data?.obgyn?.gestational_age,
      findings: v[0]?.specialty_data?.findings,
      gpa: v[0]?.specialty_data?.gpa,
      payments: payments.filter(p => p.patient_id === '${patientId}').length,
    };
  })()`)
  console.log('DB:', JSON.stringify(check, null, 1))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'ranim-consultation-saved.png'), Buffer.from(shot.data, 'base64'))
  console.log('DONE')
  ws.close()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
