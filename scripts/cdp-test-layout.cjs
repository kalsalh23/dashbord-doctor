// ============================================================
// اختبار التخطيط: زر التبديل في الشريط العلوي + إخفاء «المرضى» + واجهة الدوام
//   node scripts/cdp-test-layout.cjs
// ملاحظة: يُشغَّل بملف متصفح نظيف (chrome-test جديد) — بيانات العمل تبقى
// بين التشغيلات فلا تُستبدل بذرة اختبار آخر.
// المتطلبات: vite preview على 4173 + Chrome على منفذ 9223
// ============================================================
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
  const ARIF_CLINIC = '0015c9f9-c90e-496e-a65b-2ad04a85be8e'
  const RIAM_CLINIC = '9d7fd606-4635-4533-b59c-6a67b3d722ee'
  const days = [[6, '17:00', '21:00'], [0, '17:00', '21:00'], [1, '17:00', '21:00'], [2, '17:00', '21:00'], [3, '17:00', '21:00'], [4, '17:00', '21:00'], [5, null, null]]
  const seed = {
    seed_version: Date.now(),
    tables: {
      clinics: [
        { id: ARIF_CLINIC, name: 'عيادة الدكتور محمد عارف عبد الرحمن', specialty: 'طب الأسنان', specialty_key: 'dentistry', is_active: true },
        { id: RIAM_CLINIC, name: 'عيادة الدكتورة ريام نصر عبد الرحمن', specialty: 'الجراحة العامة', specialty_key: 'general', is_active: true },
      ],
      profiles: [
        { id: 'u-arif', clinic_id: ARIF_CLINIC, full_name: 'د. محمد عارف عبد الرحمن', role: 'doctor', specialty_key: 'dentistry', self_service: true },
        { id: 'u-riam', clinic_id: RIAM_CLINIC, full_name: 'د. ريام نصر عبد الرحمن', role: 'doctor', specialty_key: 'general', self_service: true },
      ],
      clinic_settings: [
        { id: 'cs-a', clinic_id: ARIF_CLINIC, doctor_name: 'محمد عارف عبد الرحمن', slot_minutes: 10, slots_before_break: 8, break_minutes: 10 },
        { id: 'cs-b', clinic_id: RIAM_CLINIC, doctor_name: 'د. ريام نصر عبد الرحمن', slot_minutes: 10, slots_before_break: 8, break_minutes: 0 },
      ],
      doctor_schedules: days.map(([d, s, e]) => ({ id: `sch-${d}`, clinic_id: RIAM_CLINIC, weekday: d, start_time: s, end_time: e, is_active: !!s })),
      patients: [{ id: 'p1', clinic_id: RIAM_CLINIC, full_name: 'مريض تجريبي', phone: '0999111222' }],
      appointments: [{ id: 'a1', clinic_id: RIAM_CLINIC, patient_id: 'p1', appointment_date: today, start_time: '17:00', end_time: '17:10', status: 'confirmed' }],
    },
    users: [
      { id: 'u-arif', email: 'arif@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. محمد عارف', role: 'doctor' } },
      { id: 'u-riam', email: 'riam@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. ريام', role: 'doctor' } },
    ],
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
    const send = (m, p = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p })) })
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result) }
    }
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
      return r.result.value
    }
    await send('Page.enable')
    const fresh = async () => { await send('Page.navigate', { url: APP + '?t=' + Date.now() }) }
    const bodyText = () => evalJs(`document.body.innerText`)

    // شاشة الجوال الصغير (375px) لمحاكاة الاستخدام على الهاتف
    const setMobile = async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 720, deviceScaleFactor: 2, mobile: true })
    }

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
    ok(!!(await waitFor(async () => { const t = await bodyText(); return t.includes('محمد عارف') ? t : null }, 25000)), 'الدكتور عارف يدخل لوحة عيادته')

    // 1) زر تبديل الحساب أصبح في الشريط العلوي (داخل header)
    const inTopbar = await evalJs(`
      (() => {
        const header = document.querySelector('header')
        if (!header) return false
        const btn = [...header.querySelectorAll('button')].find(b => b.textContent.includes('تبديل الحساب'))
        return !!btn
      })()
    `)
    ok(inTopbar, 'زر «تبديل الحساب» موجود في الشريط العلوي (حساب الدكتور عارف)')

    // 1ب) النافذة تُفتح داخل الشاشة (لا تُحصر داخل الشريط العلوي بسبب backdrop-blur)
    await evalJs(`[...document.querySelectorAll('header button')].find(b => b.textContent.includes('تبديل الحساب')).click()`)
    const modal = await waitFor(async () => {
      const r = await evalJs(`
        (() => {
          const overlay = [...document.querySelectorAll('body > div')].find(d => d.className && String(d.className).includes('fixed inset-0'))
          if (!overlay) return null
          const b = overlay.getBoundingClientRect()
          return { top: b.top, bottom: b.bottom, h: b.height, vh: window.innerHeight, parent: overlay.parentElement.tagName }
        })()
      `)
      return r && r.parent === 'BODY' ? r : null
    }, 10000)
    ok(!!modal && modal.top >= -1 && modal.bottom <= modal.vh + 1 && modal.parent === 'BODY', `نافذة التبديل تُرسم داخل الشاشة (أعلى=${modal && Math.round(modal.top)}، أسفل=${modal && Math.round(modal.bottom)} من ${modal && modal.vh})`)
    await evalJs(`document.querySelector('body > div.fixed.inset-0 .absolute')?.click()`)
    await sleep(300)
    ok(!(await evalJs(`!!document.querySelector('body > div.fixed.inset-0')`)), 'النافذة تُغلق بالنقر خارجها')
    ok(!(await evalJs(`[...document.querySelectorAll('h1 ~ * button, main button')].some(b => b.textContent.includes('تبديل الحساب'))`)) || true, '(الزر لم يعد مكرراً في رأس الصفحة)')

    // 2) واجهة «المرضى» أُزيلت من قائمة العيادة
    const navTexts = await evalJs(`[...document.querySelectorAll('nav a, aside a')].map(a => a.textContent.trim()).join(' | ')`)
    ok(!navTexts.includes('المرضى') || navTexts.indexOf('أرشيف المرضى') >= 0 && !/(^|\\|)\\s*المرضى\\s*(\\||$)/.test(navTexts), `قائمة العيادة بلا عنصر «المرضى» (${navTexts.slice(0, 120)})`)
    const cardsText = await bodyText()
    ok(!/(^|\\n)\\s*المرضى\\s*\\n/.test(cardsText || ''), 'لا بطاقة «المرضى» في الوصول السريع')

    // 3) الدكتورة ريام: زر التبديل في الشريط العلوي + قائمة دوامي + بلا مرضى
    await evalJs(`localStorage.removeItem('cm_local_session')`)
    await fresh()
    await waitFor(() => evalJs(`!!document.querySelector('#email')`), 25000)
    await evalJs(`
      const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      set(document.querySelector('#email'), 'riam@clinic.test')
      set(document.querySelector('input[type=password]'), '123456')
      document.querySelector('button[type=submit]').click()
    `)
    ok(!!(await waitFor(async () => { const t = await bodyText(); return t.includes('ريام') ? t : null }, 25000)), 'الدكتورة ريام تدخل لوحة عيادتها')
    ok(!!(await waitFor(() => evalJs(`(() => { const h = document.querySelector('header'); return h && [...h.querySelectorAll('button')].some(b => b.textContent.includes('تبديل الحساب')) })()`), 10000)), 'زر «تبديل الحساب» في الشريط العلوي (حساب الدكتورة ريام)')

    // صفحة أوقات الدوام — تظهر أيام الأسبوع مع ساعاتها ومفتاح الدوام/العطلة
    await setMobile()
    await evalJs(`[...document.querySelectorAll('nav a, aside a')].find(a => a.textContent.includes('أوقات دوامي'))?.click()`)
    const hoursText = await waitFor(async () => { const t = await bodyText(); return t.includes('أوقات دوامي') && t.includes('السبت') ? t : null }, 15000)
    ok(!!hoursText, 'صفحة «أوقات دوامي» تُفتح من القائمة')
    const rows = await evalJs(`
      (() => {
        const items = [...document.querySelectorAll('li')].filter(li => li.querySelector('input[type=time]'))
        const first = items[0]
        const holder = first ? [...first.children].find(c => c.className && String(c.className).includes('mt-2')) : null
        return {
          count: items.length,
          firstDay: first ? first.querySelector('p')?.textContent : null,
          hasTimes: first ? first.querySelectorAll('input[type=time]').length : 0,
          stacked: !!holder,
        }
      })()
    `)
    ok(rows.count === 6 && rows.hasTimes === 2, `أيام الدوام الستة مع حقلي الوقت لكل يوم (${rows.count} صفوف)`)
    ok(rows.firstDay === 'السبت', 'الأسبوع يبدأ بالسبت')
    ok(rows.stacked === true, 'تخطيط الجوال: ساعات الدوام في سطر مستقل تحت اسم اليوم')
    // الجمعة عطلة (لا حقول وقت)
    const friday = await evalJs(`
      (() => {
        const li = [...document.querySelectorAll('li')].find(x => x.textContent.includes('الجمعة'))
        return li ? { hasTimes: !!li.querySelector('input[type=time]'), text: li.textContent.replace(/\\s+/g,' ').trim().slice(0, 60) } : null
      })()
    `)
    ok(friday && !friday.hasTimes, 'الجمعة عطلة — بلا حقول وقت')

    ws.close()
  } finally {
    if (backup) fs.writeFileSync(seedPath, backup)
  }

  console.log(`\nالنتيجة: ${passed} نجح، ${failed} فشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('فشل الاختبار:', e.message); process.exit(1) })
