// هل الـ join (patient:patients(*)) يعمل في الوضع المحلي؟
const fs = require('fs')
const path = require('path')
const CDP = 'http://127.0.0.1:9223'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
  fs.writeFileSync(path.resolve('dist/seed-data.json'), JSON.stringify(seed))

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
  const evalJs = async (label, expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    console.log(label, '=>', r.exceptionDetails ? 'ERR ' + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 250) : JSON.stringify(r.result?.value ?? '(undefined)').slice(0, 400))
  }
  await send('Page.enable')
  const fresh = async () => { await send('Page.navigate', { url: 'http://localhost:4173/?t=' + Date.now() }) }

  await fresh(); await evalJs('clear', `localStorage.clear()`); await fresh()
  await sleep(6000)
  await evalJs('login', `(async () => {
    const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    set(document.querySelector('#email'), 'arif@clinic.test')
    set(document.querySelector('input[type=password]'), '123456')
    document.querySelector('button[type=submit]').click()
    await new Promise(r => setTimeout(r, 4000))
  })()`)

  // انتقل مباشرة لصفحة الكشف بالمعرّف — المسار الذي يفتحه «بدء الكشف»
  await send('Page.navigate', { url: 'http://localhost:4173/doctor/consultation/a1?t=' + Date.now() })
  await sleep(5000)
  await evalJs('url', 'location.pathname')
  await evalJs('stage', `document.body.innerText.includes('إنهاء الكشف') ? 'work' : (document.body.innerText.includes('كشف الأسنان') ? 'pick' : 'other')`)
  await evalJs('body', `document.body.innerText.slice(0, 250).replace(/\\n+/g, ' | ')`)

  // اختبر الاستعلام ذاته (مع join) على الوضع المحلي عبر صفحة بسيطة
  await fresh()
  await sleep(3000)
  ws.close()
}
main()
