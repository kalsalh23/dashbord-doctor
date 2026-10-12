// ============================================================
// اختبار «حالة إسعافية» + ترتيب «أسعاري» في متصفح حقيقي (Chromium عبر CDP)
//   node scripts/cdp-test-emergency.cjs
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
  // تاريخ اليوم بالتوقيت المحلي — نفس ما يستخدمه التطبيق (todayStr)
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const CLINIC = 'cl-arif'
  const seed = {
    seed_version: Date.now(),
    tables: {
      clinics: [{ id: CLINIC, name: 'عيادة الدكتور محمد عارف عبد الرحمن', specialty: 'طب الأسنان', specialty_key: 'dentistry', is_active: true }],
      profiles: [{ id: 'u-arif', clinic_id: CLINIC, full_name: 'د. محمد عارف عبد الرحمن', role: 'doctor', specialty_key: 'dentistry', self_service: true }],
      clinic_settings: [{ id: 'cs1', clinic_id: CLINIC, doctor_name: 'محمد عارف عبد الرحمن', slot_minutes: 10, slots_before_break: 8, break_minutes: 10 }],
      patients: [
        { id: 'p1', clinic_id: CLINIC, full_name: 'أحمد الز paciente', phone: '0999111222', date_of_birth: '1990-05-01' },
        { id: 'p2', clinic_id: CLINIC, full_name: 'سارة علي', phone: '0999333444', date_of_birth: '1985-09-15' },
      ],
      appointments: [
        { id: 'a1', clinic_id: CLINIC, patient_id: 'p1', appointment_date: today, start_time: '17:00', end_time: '17:10', status: 'confirmed' },
        { id: 'a2', clinic_id: CLINIC, patient_id: 'p2', appointment_date: today, start_time: '17:10', end_time: '17:20', status: 'confirmed' },
      ],
      dental_pricebook: [
        { id: 'd1', clinic_id: CLINIC, category: 'حشوات', treatment: 'حشوة عادية', price: 50000, color: '#0d9488', created_at: '2026-10-01T10:00:00Z' },
        { id: 'd2', clinic_id: CLINIC, category: 'حشوات', treatment: 'حشوة ضوئية', price: 70000, color: '#0d9488', created_at: '2026-10-01T10:00:01Z' },
      ],
    },
    users: [
      { id: 'u-arif', email: 'arif@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. محمد عارف', role: 'doctor' } },
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

    // بداية نظيفة: امسح الجلسة + صفّر إصدار البذرة (يجبر إعادة التحميل من بيانات الاختبار)
    await fresh()
    await evalJs(`localStorage.clear()`)
    await evalJs(`
      new Promise((res) => {
        const open = indexedDB.open('clinic_offline', 1)
        open.onsuccess = () => {
          const tx = open.result.transaction('kv', 'readwrite')
          tx.objectStore('kv').put(0, 'seed_version')
          tx.oncomplete = () => res('reset')
        }
        open.onerror = () => res('error')
      })
    `)
    await fresh()
    await waitFor(() => evalJs(`!!document.querySelector('#email')`), 25000)
    await evalJs(`
      const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
      set(document.querySelector('#email'), 'arif@clinic.test')
      set(document.querySelector('input[type=password]'), '123456')
    `)
    await evalJs(`document.querySelector('button[type=submit]').click()`)
    ok(!!(await waitFor(async () => { const t = await bodyText(); return t.includes('محمد عارف') ? t : null }, 25000)), 'الدكتور عارف يدخل لوحة طبيب الأسنان')

    // زر «حالة إسعافية» ظاهر ومفعّل (يوجد مواعيد اليوم)
    ok(!!(await waitFor(() => evalJs(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('حالة إسعافية') && !b.disabled)`), 10000)), 'زر «حالة إسعافية» ظاهر ومفعّل')

    // فتح نافذة الحالة الإسعافية والاعتماد
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('حالة إسعافية')).click()`)
    ok(!!(await waitFor(async () => { const t = await bodyText(); return t.includes('حالة إسعافية طارئة') ? t : null }, 10000)), 'تفتح نافذة الحالة الإسعافية')
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('إرسال الاعتذار الجماعي')).click()`)

    // شاشة الاعتذار الجماعي تعرض كل مرضى اليوم المتأثرين
    let text = await waitFor(async () => { const t = await bodyText(); return t.includes('أحمد') && t.includes('سارة') ? t : null }, 20000)
    ok(!!text, 'شاشة الاعتذار تعرض قائمة مرضى اليوم (كل الحجوزات)')
    ok(!!text && text.includes('اعتذار') && (text.includes('واتساب') || text.includes('إرسال')), 'نص الاعتذار الجماعي معروض مع إمكانية الإرسال')

    // المواعيد أُلغيت بعد الاعتماد
    const dbCount = await evalJs(`
      new Promise((resolve) => {
        const asP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const open = indexedDB.open('clinic_offline', 1)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(['rows'], 'readonly')
          Promise.all([
            asP(tx.objectStore('rows').index('by-table').getAll('appointments')),
            asP(tx.objectStore('rows').index('by-table').getAll('notifications')),
          ]).then(([a, n]) => resolve(JSON.stringify({ appts: a.map(x => x.status), notifs: n.length })))
        }
        open.onerror = () => resolve('db error')
      })
    `)
    const db = JSON.parse(dbCount)
    ok(db.appts && db.appts.every((s) => s === 'cancelled'), 'مواعيد اليوم أُلغيت بعد الحالة الإسعافية')
    ok(db.notifs >= 1, 'أُنشئ إشعار داخلي للاستقبال')

    // صفحة «أسعاري»: العلاج الجديد يظهر في أعلى الفئة لا في الأسفل
    await evalJs(`[...document.querySelectorAll('a,button')].find(x => x.textContent.includes('أسعاري'))?.click()`)
    await waitFor(async () => { const t = await bodyText(); return t.includes('أسعاري') && t.includes('حشوة') ? t : null }, 15000)
    // اختر فئة موجودة واكتب علاجاً جديداً
    await evalJs(`
      (() => {
        const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
        const cat = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'حشوات'))
        if (!cat) throw new Error('فئة حشوات غير موجودة')
        cat.value = 'حشوات'
        cat.dispatchEvent(new Event('change', { bubbles: true }))
        const nameInput = [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes('حشو ضوئي'))
        set(nameInput, 'حشوة testing جديد')
        const numInput = document.querySelector('input[type=number]')
        set(numInput, '95000')
      })()
    `)
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'إضافة العلاج').click()`)
    await sleep(2500)
    text = await waitFor(async () => { const t = await bodyText(); return t.includes('تمت إضافة العلاج') ? t : null }, 15000)
    ok(!!text, 'تمت إضافة علاج جديد بنجاح')

    // التحقق من الترتيب: العلاج الجديد أول صف في فئة «حشوات»
    const order = await evalJs(`
      (() => {
        // كل فئة بطاقة عنوانها اسم الفئة وتحتها قائمة ul>li
        const cards = [...document.querySelectorAll('div')].filter((el) => {
          const h = el.querySelector('h2, h3')
          return h && h.textContent.trim() === 'حشوات'
        })
        const items = cards.length ? [...cards[0].querySelectorAll('li')] : []
        const texts = items.map((li) => li.textContent.replace(/\\s+/g, ' ').trim())
        return JSON.stringify({ iNew: texts.findIndex((t) => t.includes('testing')), iOld: texts.findIndex((t) => t.includes('حشوة ضوئية')), order: texts })
      })()
    `)
    const o = JSON.parse(order)
    ok(o.iNew >= 0 && o.iOld >= 0 && o.iNew < o.iOld, `العلاج الجديد يظهر فوق العلاجات الأقدم (جديد=${o.iNew}، أقدم=${o.iOld}) — الترتيب: ${(o.order || []).slice(0, 3).map((t) => t.slice(0, 22)).join(' ← ')}`)

    ws.close()
  } finally {
    if (backup) fs.writeFileSync(seedPath, backup)
  }

  console.log(`\nالنتيجة: ${passed} نجح، ${failed} فشل`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('فشل الاختبار:', e.message); process.exit(1) })
