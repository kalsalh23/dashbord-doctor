// ============================================================
// اختبار «تبديل الحساب» بين طبيبين في متصفح حقيقي (Chromium عبر CDP)
//   node scripts/cdp-test-switcher.cjs
// المتطلبات: vite preview يعمل على 4173 + Chrome على منفذ 9223
// ============================================================
const fs = require('fs')
const path = require('path')

const APP = 'http://localhost:4173/'
const CDP = 'http://127.0.0.1:9223'

let passed = 0
let failed = 0
const ok = (cond, name) => {
  if (cond) { passed++; console.log('  ✓ ' + name) } else { failed++; console.log('  ✗ FAIL: ' + name) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn, timeout = 20000, step = 300) {
  const t0 = Date.now()
  for (;;) {
    try { const v = await fn(); if (v) return v } catch {}
    if (Date.now() - t0 > timeout) return null
    await sleep(step)
  }
}

async function main() {
  // --- بيانات تجريبية لحسابين على نفس الجهاز (وضع بدون إنترنت) ---
  const bcrypt = require('bcryptjs')
  const hash = bcrypt.hashSync('123456', 10)
  const ARIF_CLINIC = '0015c9f9-c90e-496e-a65b-2ad04a85be8e'
  const RIAM_CLINIC = '9d7fd606-4635-4533-b59c-6a67b3d722ee'
  const ARIF_USER = '1bc8018d-28eb-4cef-a450-1594ed38198e'
  const RIAM_USER = '059d2589-0d5b-48c0-8e1b-4b6db1b6bf2d'
  const days = [[0, '17:00', '21:00'], [1, '17:00', '21:00'], [2, '17:00', '21:00'], [3, '17:00', '21:00'], [4, '17:00', '21:00'], [5, null, null], [6, '17:00', '21:00']]
  const schedules = []
  for (const cid of [ARIF_CLINIC, RIAM_CLINIC]) {
    days.forEach(([d, s, e], i) => schedules.push({ id: `sch-${cid.slice(0, 4)}-${i}`, clinic_id: cid, weekday: d, start_time: s, end_time: e, is_active: !!s }))
  }
  const seed = {
    seed_version: Date.now(),
    tables: {
      clinics: [
        { id: ARIF_CLINIC, name: 'عيادة الدكتور محمد عارف عبد الرحمن', specialty: 'طب الأسنان', specialty_key: 'dentistry', is_active: true },
        { id: RIAM_CLINIC, name: 'عيادة الدكتورة ريام نصر عبد الرحمن', specialty: 'الجراحة العامة', specialty_key: 'general', is_active: true },
      ],
      profiles: [
        { id: ARIF_USER, clinic_id: ARIF_CLINIC, full_name: 'د. محمد عارف عبد الرحمن', role: 'doctor', specialty_key: 'dentistry' },
        { id: RIAM_USER, clinic_id: RIAM_CLINIC, full_name: 'د. ريام نصر عبد الرحمن', role: 'doctor', specialty_key: 'general' },
      ],
      clinic_settings: [
        { id: 'cs-a', clinic_id: ARIF_CLINIC, doctor_name: 'محمد عارف عبد الرحمن', slot_minutes: 10, slots_before_break: 8, break_minutes: 10 },
        { id: 'cs-b', clinic_id: RIAM_CLINIC, doctor_name: 'د. ريام نصر عبد الرحمن', slot_minutes: 10, slots_before_break: 8, break_minutes: 0 },
      ],
      doctor_schedules: schedules,
    },
    users: [
      { id: ARIF_USER, email: 'arif@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. محمد عارف عبد الرحمن', role: 'doctor' } },
      { id: RIAM_USER, email: 'riam@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. ريام نصر عبد الرحمن', role: 'doctor' } },
    ],
  }

  // vite preview يخدم dist/لا public/ — نكتب بيانات الاختبار بجانب المبنى
  const seedPath = path.resolve('dist/seed-data.json')
  const backup = fs.existsSync(seedPath) ? fs.readFileSync(seedPath) : null
  fs.writeFileSync(seedPath, JSON.stringify(seed))

  try {
    const list = await (await fetch(`${CDP}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (!page) throw new Error('لا توجد صفحة Chrome مفتوحة على المنفذ 9223')

    const ws = new WebSocket(page.webSocketDebuggerUrl)
    let id = 0
    const pending = new Map()
    const send = (method, params = {}) => new Promise((resolve, reject) => {
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
      if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
      return r.result.value
    }
    await send('Page.enable')
    const fresh = async () => { await send('Page.navigate', { url: APP + '?t=' + Date.now() }) }

    // بداية نظيفة: امسح الجلسة وقائمة الحسابات ثم أعد التحميل
    await fresh()
    await evalJs(`localStorage.clear()`)
    await fresh()
    await waitFor(() => evalJs(`!!document.querySelector('#email')`), 25000)

    const loginAs = async (email) => {
      const ready = await waitFor(() => evalJs(`!!document.querySelector('#email')`), 25000)
      if (!ready) throw new Error('لم تظهر شاشة الدخول')
      await evalJs(`
        const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
        set(document.querySelector('#email'), ${JSON.stringify(email)})
        set(document.querySelector('input[type=password]'), '123456')
      `)
      await evalJs(`document.querySelector('button[type=submit]').click()`)
    }
    const bodyText = () => evalJs(`document.body.innerText`)

    // 1) دخول حساب الدكتور عارف (تخصص أسنان)
    await loginAs('arif@clinic.test')
    let text = await waitFor(async () => { const t = await bodyText(); return t.includes('محمد عارف') ? t : null }, 25000)
    ok(!!text, 'الدكتور عارف يدخل لوحة عيادته (وضع بدون إنترنت)')
    ok(!!(await waitFor(() => evalJs(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('تبديل الحساب'))`), 10000)), 'زر «تبديل الحساب» ظاهر في لوحة طبيب الأسنان')

    // 2) خروج ثم دخول حساب الدكتورة ريام (تبقى قائمة الحسابات محفوظة)
    await evalJs(`localStorage.removeItem('cm_local_session')`)
    await fresh()
    await loginAs('riam@clinic.test')
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('ريام') ? t : null }, 25000)
    if (!text) console.log('   [تشخيص] بعد محاولة الدخول:', await evalJs('location.pathname'), '|', (await bodyText()).slice(0, 120).replace(/\n+/g, ' | '))
    ok(!!text, 'الدكتورة ريام تدخل لوحة عيادتها')
    ok(!!(await waitFor(() => evalJs(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('تبديل الحساب'))`), 10000)), 'زر «تبديل الحساب» ظاهر في لوحة الدكتورة ريام')

    // 3) فتح قائمة التبديل — يجب أن يعرض حساب الدكتور عارف فقط
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('تبديل الحساب')).click()`)
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('اختر الحساب') ? t : null }, 10000)
    ok(!!text && text.includes('محمد عارف'), 'قائمة التبديل تعرض حساب الدكتور عارف (الحساب الآخر)')
    const rowsText = await evalJs(`[...document.querySelectorAll('li')].map(li => li.textContent).join(' | ')`)
    ok(!rowsText.includes('ريام'), 'قائمة التبديل لا تعرض الحساب الحالي داخل القائمة')

    // 4) التبديل الفعلي إلى حساب الدكتور عارف
    await evalJs(`
      const row = [...document.querySelectorAll('li')].find(li => li.textContent.includes('محمد عارف'))
      if (!row) throw new Error('صف الحساب غير موجود')
      row.querySelector('button').click()
    `)
    // ننتظر تغيّر الجلسة فعلياً (بعد إعادة التحميل) لا مجرد ظهور الاسم في القائمة
    let lastSid = 'لم تُقرأ بعد'
    const switched = await waitFor(async () => {
      const sid = await evalJs(`JSON.parse(localStorage.getItem('cm_local_session') || 'null')?.user?.id`)
      lastSid = String(sid)
      return sid === ARIF_USER ? sid : null
    }, 25000)
    if (!switched) console.log('   [تشخيص] آخر جلسة مقروءة:', lastSid, '| المتوقعة:', ARIF_USER)
    ok(!!switched, 'الجلسة تغيّرت فعلياً إلى حساب الدكتور عارف بعد التبديل')
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('عيادة الدكتور محمد عارف') ? t : null }, 25000)
    ok(!!text, 'بعد التبديل: اللوحة صارت لحساب الدكتور عارف')

    // 5) الحسابان محفوظان في قائمة هذا الجهاز
    const accounts = await evalJs(`(JSON.parse(localStorage.getItem('cm_accounts') || '[]')).length`)
    ok(accounts === 2, 'الحسابان محفوظان في قائمة هذا الجهاز')

    ws.close()
  } finally {
    if (backup) fs.writeFileSync(seedPath, backup)
  }

  console.log(`\nالنتيجة: ${passed} نجح، ${failed} فشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('فشل الاختبار:', e.message); process.exit(1) })
