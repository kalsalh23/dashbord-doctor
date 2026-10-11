// الاتصال بنافذة التطبيق المعبأ عبر CDP وفحص حالتها الفعلية + لقطة شاشة
const fs = require('fs')

async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) {
    console.log('NO PAGE TARGETS:', JSON.stringify(list, null, 2))
    return
  }
  console.log('URL:', page.url)
  console.log('TITLE:', page.title)

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
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result.value
  }

  const state = await evalJs(`({
    readyState: document.readyState,
    href: location.href,
    title: document.title,
    rootChildren: document.getElementById('root')?.children.length ?? -1,
    rootHtmlLen: document.getElementById('root')?.innerHTML.length ?? -1,
    bodyText: document.body.innerText.slice(0, 400),
    hasErrorBoundary: document.body.innerText.includes('حدث خطأ غير متوقع'),
    fontsLoaded: document.fonts ? document.fonts.status : 'n/a',
  })`)
  console.log('STATE:', JSON.stringify(state, null, 2))

  // لقطة شاشة
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('screenshots/packaged-app.png', Buffer.from(shot.data, 'base64'))
  console.log('screenshot saved: screenshots/packaged-app.png')

  ws.close()
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
