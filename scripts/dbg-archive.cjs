// تشخيص: الضغط على بطاقة المريض في الأرشيف
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
  const evalJs = async (label, expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    console.log(label, '=>', r.exceptionDetails ? 'ERR ' + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 250) : JSON.stringify(r.result?.value ?? '(undefined)').slice(0, 600))
  }
  await send('Page.enable')
  await send('Page.navigate', { url: 'http://localhost:4173/doctor/archive?t=' + Date.now() })
  await sleep(4000)
  await evalJs('cards', `
    [...document.querySelectorAll('button')].filter(b => b.textContent.includes('مراجعة')).map(b => b.textContent.replace(/\\s+/g,' ').trim().slice(0, 70))
  `)
  await evalJs('click', `
    (() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('مريض الكشف'))
      if (!btn) return 'card not found'
      btn.click()
      return 'clicked'
    })()
  `)
  await sleep(1500)
  await evalJs('after click', `
    (() => {
      const t = document.body.innerText
      return { hasDetail: t.includes('قائمة مراجعات') || t.includes('كل المرضى'), body: t.slice(0, 300).replace(/\\n+/g, ' | ') }
    })()
  `)
  ws.close()
}
main()
