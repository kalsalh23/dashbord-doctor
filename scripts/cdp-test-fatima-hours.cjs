// ============================================================
// اختبار واجهة «أوقات دوامي» — عيادة الدكتورة فاطمة سالم الجاموس
//   node scripts/cdp-test-fatima-hours.cjs
// المتطلبات: vite preview يعمل على 4173 + Chrome على منفذ 9223
// ============================================================
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')

const APP = 'http://localhost:4173/'
const CDP = 'http://127.0.0.1:9223'
const FATIMA_CLINIC = 'f17b6085-7a49-453a-b4b7-49feb5c6a601'
const FATIMA_USER = 'a1f9c0de-1111-4a44-9a01-000000000001'

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

function nextWeekday(target) {
  const d = new Date()
  for (let i = 0; i < 8; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    if (x.getDay() === target) return x.toISOString().slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

async function main() {
  const hash = bcrypt.hashSync('123456', 10)
  const sat = nextWeekday(6)
  const sun = nextWeekday(0)
  const fri = nextWeekday(5)

  // أيام الدوام: السبت..الخميس 17:00-21:00 والجمعة عطلة (كالمحفوظ في قاعدة البيانات)
  const days = [[0, '17:00', '21:00'], [1, '17:00', '21:00'], [2, '17:00', '21:00'], [3, '17:00', '21:00'], [4, '17:00', '21:00'], [5, null, null], [6, '17:00', '21:00']]
  const seed = {
    seed_version: Date.now(),
    tables: {
      clinics: [
        { id: FATIMA_CLINIC, name: 'عيادة الدكتورة فاطمة سالم الجاموس', specialty: 'طب عام', specialty_key: 'general', is_active: true },
      ],
      profiles: [
        { id: FATIMA_USER, clinic_id: FATIMA_CLINIC, full_name: 'د. فاطمة سالم الجاموس', role: 'doctor', specialty_key: 'general', is_active: true },
      ],
      clinic_settings: [
        { id: 'cs-fatima', clinic_id: FATIMA_CLINIC, doctor_name: 'فاطمة سالم الجاموس', consultation_price: 50000, currency: 'ل.س', slot_minutes: 20, examination_minutes: 20, consultation_minutes: 20, slots_before_break: 8, break_minutes: 10 },
      ],
      doctor_schedules: days.map(([d, s, e], i) => ({
        id: 'sch-fatima-' + i, clinic_id: FATIMA_CLINIC, weekday: d, start_time: s || '17:00', end_time: e || '21:00', is_active: !!s,
      })),
      patients: [
        { id: 'pt-1', clinic_id: FATIMA_CLINIC, full_name: 'سارة أحمد', phone: '0999000001' },
        { id: 'pt-2', clinic_id: FATIMA_CLINIC, full_name: 'محمد علي', phone: '0999000002' },
      ],
      appointments: [
        { id: 'ap-1', clinic_id: FATIMA_CLINIC, patient_id: 'pt-1', appointment_date: sat, start_time: '18:00', end_time: '18:20', status: 'confirmed' },
        { id: 'ap-2', clinic_id: FATIMA_CLINIC, patient_id: 'pt-2', appointment_date: sun, start_time: '19:00', end_time: '19:20', status: 'confirmed' },
      ],
    },
    users: [
      { id: FATIMA_USER, email: 'fatima@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. فاطمة سالم الجاموس', role: 'doctor' } },
    ],
  }

  // vite preview يخدم dist/ — نكتب بيانات الاختبار بجانب المبنى
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
      if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
      return r.result.value
    }
    await send('Page.enable')
    const fresh = async () => { await send('Page.navigate', { url: APP + '?t=' + Date.now() }) }
    const bodyText = () => evalJs(`document.body.innerText`)

    // 0) بداية نظيفة
    await fresh()
    await evalJs(`localStorage.clear()`)
    await fresh()
    await waitFor(() => evalJs(`!!document.querySelector('#email')`), 25000)

    // 1) دخول حساب الدكتورة فاطمة
    await evalJs(`
      const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      set(document.querySelector('#email'), 'fatima@clinic.test')
      set(document.querySelector('input[type=password]'), '123456')
    `)
    await evalJs(`document.querySelector('button[type=submit]').click()`)
    let text = await waitFor(async () => { const t = await bodyText(); return t.includes('فاطمة') ? t : null }, 25000)
    ok(!!text, 'دخول حساب الدكتورة فاطمة إلى عيادتها')
    if (!text) console.log('   [تشخيص]', await evalJs('location.pathname'), '|', (await bodyText()).slice(0, 160).replace(/\n+/g, ' | '))

    // 2) زر «أوقات دوامي» في القائمة
    const hasHoursNav = await waitFor(
      () => evalJs(`[...document.querySelectorAll('a,button')].some(n => n.textContent.trim() === 'أوقات دوامي')`),
      15000
    )
    ok(!!hasHoursNav, 'واجهة «أوقات دوامي» ظاهرة في قائمة عيادة فاطمة')

    // 3) فتح الواجهة
    await evalJs(`
      const n = [...document.querySelectorAll('a,button')].find(n => n.textContent.trim() === 'أوقات دوامي')
      if (!n) throw new Error('لا يوجد عنصر القائمة')
      n.click()
    `)
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('أوقات دوامي') && t.includes('السبت') ? t : null }, 20000)
    ok(!!text, 'فتح صفحة «أوقات دوامي» وظهور أيام الأسبوع')
    if (text) {
      for (const d of ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']) {
        ok(text.includes(d), 'اليوم «' + d + '» موجود في الواجهة')
      }
      ok(/6\s*\/\s*7/.test(text.replace(/\s+/g, ' ')), 'الملخّص: 6 أيام دوام من 7')
      ok(/66/.test(text), 'الملخّص: 66 موعداً أسبوعياً (11 موعداً × 6 أيام)')
      ok(text.includes('أوقات الحجز'), 'معاينة أوقات الحجز داخل اليوم')
      ok(text.includes('17:00'), 'أول وقت حجز ظاهر (17:00)')
      ok(text.includes('عطلة'), 'الجمعة تظهر كعطلة')
      ok(text.includes('حجوزات قادمة'), 'عدّاد الحجوزات القادمة ظاهر')
    }

    // 4) تحويل السبت إلى عطلة ثم الحفظ — والتحقق من قاعدة البيانات
    await evalJs(`(() => {
      const row = [...document.querySelectorAll('li')].find(li => li.textContent.includes('السبت') && li.textContent.includes('موعداً'))
      if (!row) throw new Error('صف السبت غير موجود')
      const btn = row.querySelector('button[aria-pressed]')
      if (!btn) throw new Error('زر التبديل غير موجود')
      btn.click()
    })()`)
    await sleep(400)
    await evalJs(`(() => {
      const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('حفظ أوقات الدوام') || b.textContent.trim() === 'حفظ')
      if (!b) throw new Error('زر الحفظ غير موجود')
      b.click()
    })()`)
    // الموعد المحجوز في يوم السبت صار خارج الدوام → يظهر التنبيه
    const warnedFirst = await waitFor(async () => {
      const t = await bodyText()
      return t.includes('مواعيد أصبحت خارج أوقات الدوام') ? t : null
    }, 15000)
    ok(!!warnedFirst, 'تنبيه المواعيد خارج أوقات الدوام يظهر قبل الحفظ')
    if (warnedFirst) {
      await evalJs(`(() => {
        const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('حفظ على أي حال'))
        if (!b) throw new Error('زر الحفظ على أي حال غير موجود')
        b.click()
      })()`)
    }
    const savedToast = await waitFor(async () => {
      const t = await bodyText()
      return t.includes('تم حفظ أوقات الدوام') ? t : null
    }, 20000)
    ok(!!savedToast, 'رسالة نجاح الحفظ تظهر')

    const rowAfter = await evalJs(`(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
      const tx = db.transaction('rows', 'readonly')
      const idx = tx.objectStore('rows').index('by-table')
      const get = (t) => new Promise((res) => { const q = idx.getAll(t); q.onsuccess = () => res(q.result) })
      const rows = await get('doctor_schedules')
      db.close()
      return rows.filter(r => r.clinic_id === '${FATIMA_CLINIC}').map(r => ({ weekday: r.weekday, active: r.is_active, start: r.start_time, end: r.end_time }))
    })()`)
    const satRow = (rowAfter || []).find((r) => r.weekday === 6)
    ok(!!satRow && satRow.active === false, 'السبت أصبح عطلة في قاعدة البيانات بعد الحفظ')

    // 5) تنبيه المواعيد خارج أوقات الدوام: الأحد ينتهي 18:30 وحجز الأحد 19:00
    await evalJs(`(() => {
      const row = [...document.querySelectorAll('li')].find(li => li.textContent.includes('الأحد') && li.textContent.includes('موعداً'))
      if (!row) throw new Error('صف الأحد غير موجود')
      const inputs = row.querySelectorAll('input[type=time]')
      const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      set(inputs[1], '18:30')
    })()`)
    await sleep(300)
    await evalJs(`(() => {
      const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('حفظ أوقات الدوام') || b.textContent.trim() === 'حفظ')
      b.click()
    })()`)
    const warned = await waitFor(async () => {
      const t = await bodyText()
      return t.includes('مواعيد أصبحت خارج أوقات الدوام') && t.includes('محمد علي') ? t : null
    }, 15000)
    ok(!!warned, 'تنبيه المواعيد خارج أوقات الدوام يظهر باسم المريض')

    if (warned) {
      await evalJs(`(() => {
        const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('حفظ على أي حال'))
        if (!b) throw new Error('زر الحفظ على أي حال غير موجود')
        b.click()
      })()`)
      const done = await waitFor(async () => {
        const t = await bodyText()
        return t.includes('تم حفظ أوقات الدوام') ? t : null
      }, 20000)
      ok(!!done, 'الحفظ رغم التحذير ينجح')
      const sundayRow = await evalJs(`(async () => {
        const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const tx = db.transaction('rows', 'readonly')
        const idx = tx.objectStore('rows').index('by-table')
        const get = (t) => new Promise((res) => { const q = idx.getAll(t); q.onsuccess = () => res(q.result) })
        const rows = await get('doctor_schedules')
        db.close()
        const r = rows.find(x => x.clinic_id === '${FATIMA_CLINIC}' && x.weekday === 0)
        return r ? { start: r.start_time, end: r.end_time, active: r.is_active } : null
      })()`)
      ok(!!sundayRow && String(sundayRow.end).slice(0, 5) === '18:30', 'نهاية دوام الأحد حُفظت 18:30')
    }

    // 6) الربط مع جدول المواعيد: يوم العطلة يظهر مغلقاً مع زر العودة لواجهة الدوام
    await evalJs(`(() => {
      history.pushState({}, '', '/doctor/schedule')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })()`)
    await sleep(600)
    await evalJs(`(() => {
      const el = document.querySelector('input[type=date]')
      if (!el) throw new Error('لا يوجد حقل التاريخ')
      const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')
      d.set.call(el, '${fri}')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await sleep(900)
    const closedTxt = await waitFor(async () => {
      const t = await bodyText()
      return t.includes('العيادة مغلقة في هذا اليوم') ? t : null
    }, 15000)
    if (!closedTxt) {
      console.log('   [تشخيص] path=', await evalJs('location.pathname'), '|', (await bodyText()).slice(0, 300).replace(/\n+/g, ' | '))
    }
    ok(!!closedTxt, 'جدول المواعيد يعرض اليوم المغلق كعطلة')
    ok(!!closedTxt && closedTxt.includes('تعديل أوقات دوامي'), 'زر «تعديل أوقات دوامي» يظهر في يوم العطلة')

    ws.close()
  } finally {
    if (backup) fs.writeFileSync(seedPath, backup)
  }

  console.log(`\nالنتيجة: ${passed} نجح، ${failed} فشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('فشل الاختبار:', e.message); process.exit(1) })
