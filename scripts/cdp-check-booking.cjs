// التحقق من فتح نافذة الحجز في الاستقبال
async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json/list')).json()
  const page = list.find((t) => t.type === 'page')
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
    if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 700))
    return r.result.value
  }
  await send('Page.enable')
  const out = await evalJs(`(async () => {
    const btn = [...document.querySelectorAll('.ob-hero button')].find(b => b.innerText.includes('حجز متابعة'));
    btn.click();
    await new Promise(r => setTimeout(r, 2000));
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    return { opened: !!overlay, text: overlay?.innerText.replace(/\\n/g,' | ').slice(0, 300) };
  })()`)
  console.log('BOOK-MODAL:', JSON.stringify(out, null, 1))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  require('fs').writeFileSync(require('path').resolve('screenshots/ranim-booking.png'), Buffer.from(shot.data, 'base64'))
  console.log('DONE')
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
