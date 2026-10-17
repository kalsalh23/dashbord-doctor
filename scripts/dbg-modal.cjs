// تحقق: بعد فتح نافذة «تبديل الحساب» من الشريط العلوي — هل هي داخل الشاشة؟
const fs = require('fs')
const path = require('path')
const CDP = 'http://127.0.0.1:9223'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const bcrypt = require('bcryptjs')
  const hash = bcrypt.hashSync('123456', 10)
  const seed = {
    seed_version: Date.now(),
    tables: {
      clinics: [
        { id: 'cl-a', name: 'عيادة الدكتور محمد عارف عبد الرحمن', specialty: 'طب الأسنان', specialty_key: 'dentistry', is_active: true },
        { id: 'cl-b', name: 'عيادة الدكتورة ريام نصر عبد الرحمن', specialty: 'الجراحة العامة', specialty_key: 'general', is_active: true },
      ],
      profiles: [
        { id: 'u-arif', clinic_id: 'cl-a', full_name: 'د. محمد عارف عبد الرحمن', role: 'doctor', specialty_key: 'dentistry', self_service: true },
        { id: 'u-riam', clinic_id: 'cl-b', full_name: 'د. ريام نصر عبد الرحمن', role: 'doctor', specialty_key: 'general', self_service: true },
      ],
      clinic_settings: [
        { id: 'cs-a', clinic_id: 'cl-a', doctor_name: 'محمد عارف عبد الرحمن', slot_minutes: 10, slots_before_break: 8, break_minutes: 10 },
        { id: 'cs-b', clinic_id: 'cl-b', doctor_name: 'د. ريام نصر عبد الرحمن', slot_minutes: 10, slots_before_break: 8, break_minutes: 0 },
      ],
    },
    users: [
      { id: 'u-arif', email: 'arif@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. محمد عارف', role: 'doctor' } },
      { id: 'u-riam', email: 'riam@clinic.test', password_hash: hash, raw_user_meta_data: { full_name: 'د. ريام', role: 'doctor' } },
    ],
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
    const v = r.result?.value
    console.log(label, '=>', r.exceptionDetails ? 'ERR ' + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 200) : JSON.stringify(v === undefined ? '(undefined)' : v).slice(0, 400))
  }
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 720, deviceScaleFactor: 2, mobile: true })

  await send('Page.navigate', { url: 'http://localhost:4173/?t=' + Date.now() })
  await sleep(1500)
  await evalJs('clear', `localStorage.clear()`)
  // سجّل الدخول بحسابين حتى تظهر القائمة
  await send('Page.navigate', { url: 'http://localhost:4173/?t=' + Date.now() })
  await sleep(6000)
  const login = async (email) => {
    const expr = [
      '(async () => {',
      "  const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }",
      "  set(document.querySelector('#email'), " + JSON.stringify(email) + ')',
      "  set(document.querySelector('input[type=password]'), '123456')",
      "  document.querySelector('button[type=submit]').click()",
      '  await new Promise(r => setTimeout(r, 4000))',
      '})()',
    ].join('\n')
    await evalJs('login ' + email, expr)
  }
  await login('arif@clinic.test')
  await evalJs('session after arif', `localStorage.getItem('cm_local_session') ? 'ok' : 'none'`)
  await evalJs('logout', `localStorage.removeItem('cm_local_session')`)
  await send('Page.navigate', { url: 'http://localhost:4173/?t=' + Date.now() })
  await sleep(5000)
  await login('riam@clinic.test')

  // افتح قائمة التبديل من الشريط العلوي وقِس موضع النافذة
  await evalJs('click switch', `[...document.querySelectorAll('header button')].find(b => b.textContent.includes('تبديل الحساب')).click()`)
  await sleep(1500)
  await evalJs('modal rect', `
    (() => {
      const overlay = [...document.querySelectorAll('body > div')].find(d => d.className && String(d.className).includes('fixed inset-0'))
      if (!overlay) return 'no overlay found'
      const r = overlay.getBoundingClientRect()
      const box = overlay.querySelector('.relative')
      const b = box ? box.getBoundingClientRect() : null
      return {
        viewport: { w: innerWidth, h: innerHeight },
        overlay: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
        box: b ? { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) } : null,
        insideViewport: r.top >= 0 && r.bottom <= innerHeight + 1,
        parent: overlay.parentElement.tagName,
      }
    })()
  `)
  await evalJs('list visible', `(() => { const t = document.body.innerText; return { hasTitle: t.includes('اختر الحساب'), hasArif: t.includes('محمد عارف') } })()`)
  ws.close()
}
main()
