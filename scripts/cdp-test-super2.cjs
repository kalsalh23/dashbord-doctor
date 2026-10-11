// فحص أعمق للوحة الإدارة: انتظار أطول + التقاط أخطاء الكونسول
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
  const errors = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails?.exception?.description || JSON.stringify(msg.params).slice(0, 300))
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args?.map((a) => a.value || a.description).join(' ').slice(0, 300))
    }
  }
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  await send('Runtime.enable')
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false })
    return r.result.value
  }

  evalJs(`(() => {
    localStorage.setItem('cm_local_session', JSON.stringify({
      user: { id: 'c2a1bf00-efb1-4be3-86f8-5ca2d4c740cb', email: 'x@y', user_metadata: {} },
      access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
    }));
    location.href = '/super';
    return 1;
  })()`).catch(() => {})
  await new Promise((r) => setTimeout(r, 8000))

  const admin = await evalJs(`({
    path: location.pathname,
    h1: document.querySelector('h1')?.innerText || '',
    mainLen: document.querySelector('main')?.innerHTML.length || 0,
    text: (document.querySelector('main')?.innerText || document.body.innerText).slice(0, 1200),
  })`)
  console.log('المسار:', admin.path, '| عنوان:', admin.h1, '| حجم المحتوى:', admin.mainLen)
  console.log('---- نص اللوحة ----')
  console.log(admin.text)
  console.log('---- أخطاء الكونسول ----')
  console.log(errors.length ? errors.slice(0, 5).join('\n---\n') : 'لا أخطاء')
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
