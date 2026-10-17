// هل تظهر قائمة المراجعات بتفاصيلها بعد الضغط على البطاقة؟
const CDP = 'http://127.0.0.1:9223'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
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
    if (r.exceptionDetails) return 'ERR ' + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 200)
    return r.result?.value
  }
  await send('Page.enable')
  await send('Page.navigate', { url: 'http://localhost:4173/doctor/archive?t=' + Date.now() })
  await sleep(4000)
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('مريض الكشف'))?.click()`)
  await sleep(2000)
  const t = await evalJs('document.body.innerText')
  console.log('hasVisitRow:', t.includes('كشف الأسنان') || t.includes('حشو ضوئي'))
  console.log('--- body after card ---')
  console.log((t || '').slice(250, 900).replace(/\n+/g, ' | '))
  ws.close()
}
main()
