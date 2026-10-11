// هل تختفي رسالة الإرشاد بعد إعادة تحميل الصفحة (والبيانات موجودة)؟
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
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false })
    return r.result.value
  }

  // أزل أي جلسة، وعد إلى صفحة الدخول، وافحص
  evalJs(`(() => { localStorage.removeItem('cm_local_session'); location.href = '/login'; return 1 })()`).catch(() => {})
  await new Promise((r) => setTimeout(r, 4000))
  const st = await evalJs(`({
    path: location.pathname,
    hint: document.body.innerText.includes('clinic-data.json'),
    text: document.body.innerText.slice(0, 200),
  })`)
  console.log('المسار:', st.path, '| رسالة الإرشاد:', st.hint)
  console.log(st.text.replace(/\n/g, ' | '))
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
