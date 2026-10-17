// تشخيص: الضغط على السن ثم على حالة «حشو» — ماذا يحدث بالتفصيل؟
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
      appointments: [{ id: 'a1', clinic_id: CLINIC, patient_id: 'p1', appointment_date: today, start_time: '17:00', end_time: '17:10', status: 'confirmed' }],
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
    console.log(label, '=>', r.exceptionDetails ? 'ERR ' + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 200) : JSON.stringify(r.result?.value ?? '(undefined)').slice(0, 500))
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
  await evalJs('open consult', `(async () => {
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('كشف أسنان جديد')).click()
    await new Promise(r => setTimeout(r, 1500))
    const set = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    set(document.querySelector('input[placeholder*="اكتب الاسم"]'), 'مريض')
    await new Promise(r => setTimeout(r, 1200))
    [...document.querySelectorAll('li button')].find(x => x.textContent.includes('مريض الكشف')).click()
    await new Promise(r => setTimeout(r, 1500))
    return location.pathname
  })()`)
  await evalJs('tooth groups', `
    (() => {
      const groups = [...document.querySelectorAll('svg g[transform*="translate"]')]
      const first = groups[0]
      return { count: groups.length, firstTransform: first && first.getAttribute('transform'), title: first && first.querySelector('title')?.textContent }
    })()
  `)
  await evalJs('click tooth', `
    (async () => {
      const groups = [...document.querySelectorAll('svg g[transform*="translate"]')]
      groups[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(r => setTimeout(r, 1200))
      const overlay = document.querySelector('body > div.fixed.inset-0')
      return { modalOpen: !!overlay, modalText: overlay ? overlay.innerText.slice(0, 120).replace(/\\n+/g, ' | ') : null }
    })()
  `)
  await evalJs('click state 14', `
    (async () => {
      const overlay = document.querySelector('body > div.fixed.inset-0')
      if (!overlay) return 'no modal'
      const btns = [...overlay.querySelectorAll('button')]
      const target = btns.find(b => b.textContent.trim() === 'حشو')
      if (!target) return { btns: btns.map(b => b.textContent.trim()).slice(0, 20) }
      target.click()
      await new Promise(r => setTimeout(r, 1500))
      return { clicked: true, modalOpenAfter: !!document.querySelector('body > div.fixed.inset-0') }
    })()
  `)
  await evalJs('state after', `
    (() => {
      const total = [...document.querySelectorAll('p')].find(p => p.textContent.includes('إجمالي علاجات اليوم'))
      const listItems = [...document.querySelectorAll('li')].filter(li => li.textContent.includes('السن'))
      return { totalText: total && total.parentElement.textContent.replace(/\\s+/g,' ').trim().slice(0,60), items: listItems.map(li => li.textContent.replace(/\\s+/g,' ').trim().slice(0, 80)) }
    })()
  `)
  ws.close()
}
main()
