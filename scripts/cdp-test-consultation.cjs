// اختبار كشف الأسنان الكامل: اختيار مريض → علاج على سن → إنهاء وحفظ
const fs = require('fs')
const path = require('path')

const APP = 'http://localhost:4173/'
const CDP = 'http://127.0.0.1:9223'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let passed = 0
let failed = 0
const ok = (cond, name) => {
  if (cond) { passed++; console.log('  ✓ ' + name) } else { failed++; console.log('  ✗ FAIL: ' + name) }
}

async function waitFor(fn, timeout = 20000, step = 300) {
  const t0 = Date.now()
  for (;;) {
    try { const v = await fn(); if (v) return v } catch {}
    if (Date.now() - t0 > timeout) return null
    await sleep(step)
  }
}

async function main() {
  const bcrypt = require('bcryptjs')
  const hash = bcrypt.hashSync('123456', 10)
  const _now = new Date()
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const CLINIC = 'cl-arif'
  const seed = {
    seed_version: Date.now(),
    tables: {
      clinics: [{ id: CLINIC, name: 'عيادة الدكتور محمد عارف عبد الرحمن', specialty: 'طب الأسنان', specialty_key: 'dentistry', is_active: true }],
      profiles: [{ id: 'u-arif', clinic_id: CLINIC, full_name: 'د. محمد عارف عبد الرحمن', role: 'doctor', specialty_key: 'dentistry', self_service: true }],
      clinic_settings: [{ id: 'cs1', clinic_id: CLINIC, doctor_name: 'محمد عارف عبد الرحمن', slot_minutes: 10, slots_before_break: 8, break_minutes: 10 }],
      patients: [{ id: 'p1', clinic_id: CLINIC, full_name: 'مريض الكشف', phone: '0999111222', date_of_birth: '1990-01-01' }],
      appointments: [{ id: 'a1', clinic_id: CLINIC, patient_id: 'p1', appointment_date: today, start_time: '17:00', end_time: '17:10', status: 'waiting' }],
      dental_pricebook: [{ id: 'd1', clinic_id: CLINIC, category: 'حشوات', treatment: 'حشو ضوئي', price: 70000, color: '#0d9488' }],
    },
    users: [{ id: 'u-arif', email: 'arif@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. محمد عارف', role: 'doctor' } }],
  }
  const seedPath = path.resolve('dist/seed-data.json')
  const backup = fs.existsSync(seedPath) ? fs.readFileSync(seedPath) : null
  fs.writeFileSync(seedPath, JSON.stringify(seed))

  try {
    const list = await (await fetch(`${CDP}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    let id = 0
    const pending = new Map()
    const errors = []
    const send = (m, p = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p })) })
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(JSON.stringify(msg.params.exceptionDetails.exception || {}).slice(0, 300))
      }
    }
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
      return r.result.value
    }
    await send('Runtime.enable')
    await send('Page.enable')
    const fresh = async () => { await send('Page.navigate', { url: APP + '?t=' + Date.now() }) }
    const bodyText = () => evalJs(`document.body.innerText`)

    await fresh()
    await evalJs(`localStorage.clear()`)
    await fresh()
    await waitFor(() => evalJs(`!!document.querySelector('#email')`), 25000)
    await evalJs(`
      const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      set(document.querySelector('#email'), 'arif@clinic.test')
      set(document.querySelector('input[type=password]'), '123456')
      document.querySelector('button[type=submit]').click()
    `)
    ok(!!(await waitFor(async () => { const t = await bodyText(); return t.includes('محمد عارف') ? t : null }, 25000)), 'الدخول بحساب الدكتور عارف')

    // المسار الأساسي: من قائمة الانتظار → «بدء الكشف» (الموعد مرفق)
    ok(!!(await waitFor(async () => { const t = await bodyText(); return t.includes('مريض الكشف') ? t : null }, 15000)), 'لوحة اليوم تُظهر قائمة الانتظار بالمريض')
    await evalJs(`[...document.querySelectorAll('button')].filter(b => b.textContent.includes('بدء الكشف'))[0]?.click()`)
    let text = await waitFor(async () => { const t = await bodyText(); return t.includes('إنهاء الكشف') ? t : null }, 15000)
    ok(!!text, 'مرحلة العمل على الفك تُفتح من قائمة الانتظار')
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('إنهاء الكشف') ? t : null }, 15000)
    ok(!!text, 'مرحلة العمل على الفك تُفتح')

    // اختر سنّاً (أول مجموعة أسنان في المخطط) ثم طبّق حالة «حشو»
    const toothClicked = await evalJs(`
      (() => {
        const groups = [...document.querySelectorAll('svg g[transform*="translate"]')]
        if (!groups.length) return 'no teeth'
        groups[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
        return groups.length
      })()
    `)
    ok(typeof toothClicked === 'number', `الضغط على السن يفتح شبكة الحالات (${toothClicked} سناً في المخطط)`)
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('اختر حالة السن') ? t : null }, 10000)
    ok(!!text, 'نافذة السن تُفتح')
    await evalJs(`
      (() => {
        const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'حشوة')
        if (btns.length) btns[btns.length - 1].click()
      })()
    `)
    await sleep(800)
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('السن 1') && t.includes('حشوة') ? t : null }, 8000)
    ok(!!text, 'علاج «حشوة» يُطبّق على السن ويظهر في القائمة')

    // إنهاء الكشف وحفظه
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('إنهاء الكشف')).click()`)
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('تم إنهاء كشف') ? t : null }, 20000)
    const toastErr = await evalJs(`document.body.innerText.includes('تعذر') || document.body.innerText.includes('خطأ')`)
    ok(!!text, `حفظ الكشف بعد الانتهاء — ${text ? 'نجح' : 'فشل'}${toastErr ? ' (رسالة خطأ ظاهرة)' : ''}`)
    if (!text) {
      console.log('   [تشخيص] نص الصفحة:', ((await bodyText()) || '').slice(0, 400).replace(/\n+/g, ' | '))
      console.log('   [تشخيص] أخطاء JS:', errors.slice(0, 3).join(' ~~ ') || 'لا شيء')
    }

    // تحقق من قاعدة البيانات المحلية
    const db = await evalJs(`
      new Promise((resolve) => {
        const asP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const open = indexedDB.open('clinic_offline', 1)
        open.onsuccess = () => {
          const tx = open.result.transaction(['rows'], 'readonly')
          Promise.all([
            asP(tx.objectStore('rows').index('by-table').getAll('visits')),
            asP(tx.objectStore('rows').index('by-table').getAll('dental_chart_entries')),
            asP(tx.objectStore('rows').index('by-table').getAll('appointments')),
          ]).then(([v, d, a]) => resolve(JSON.stringify({ visits: v.length, visit_diag: v[0] && v[0].diagnosis, chart: d.length, chart_proc: d[0] && d[0].procedure, appt_status: a[0] && a[0].status })))
        }
        open.onerror = () => resolve('db error')
      })
    `)
    const d = JSON.parse(db)
    ok(d.visits === 1, `الزيارة حُفظت (${d.visits})`)
    ok(d.chart === 1 && d.chart_proc === 'حشو ضوئي', `مدخل المخطط حُفظ (${d.chart}: ${d.chart_proc})`)
    ok(d.appt_status === 'completed', `حالة الموعد صارت مكتملة (${d.appt_status})`)

    // الأرشيف: بطاقة المريض ← الضغط يعرض قائمة المراجعات مع تفاصيل الكشف
    await send('Page.navigate', { url: 'http://localhost:4173/doctor/archive?t=' + Date.now() })
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('مريض الكشف') ? t : null }, 15000)
    ok(!!text, 'الأرشيف يعرض بطاقة المريض مع عدد المراجعات')
    ok(!!text && text.includes('1 مراجعة'), 'البطاقة تحوي عدد المراجعات')
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('مريض الكشف'))?.click()`)
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('حشو ضوئي') && t.includes('كشف أسنان') ? t : null }, 10000)
    ok(!!text, 'الضغط على البطاقة يعرض قائمة المراجعات بتفاصيل العلاج')

    ws.close()
  } finally {
    if (backup) fs.writeFileSync(seedPath, backup)
  }

  console.log(`\nالنتيجة: ${passed} نجح، ${failed} فشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('فشل الاختبار:', e.message); process.exit(1) })
