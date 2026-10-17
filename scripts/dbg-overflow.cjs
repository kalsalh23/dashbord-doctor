// هل هناك فائض أفقي (عناصر أوسع من الشاشة)؟
const CDP = 'http://127.0.0.1:9223'
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
    console.log(label, '=>', JSON.stringify(r.result?.value ?? '(undefined)').slice(0, 500))
  }
  await evalJs('overflow check', `
    (() => {
      const de = document.documentElement
      const vw = window.innerWidth
      const sw = de.scrollWidth
      const wide = [...document.querySelectorAll('body *')].filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > vw + 1 || r.right > vw + 1 || r.left < -1
      }).slice(0, 6).map(el => ({ tag: el.tagName, cls: String(el.className).slice(0, 70), w: Math.round(el.getBoundingClientRect().width), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) }))
      return { viewport: vw, scrollWidth: sw, overflowing: sw > vw + 1, culprits: wide }
    })()
  `)
  ws.close()
}
main()
