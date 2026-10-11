// تشخيص تعليق لوحة الإدارة: التقاط unhandledrejection بعد تركيب الصفحة
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

  evalJs(`(() => {
    localStorage.setItem('cm_local_session', JSON.stringify({
      user: { id: 'c2a1bf00-efb1-4be3-86f8-5ca2d4c740cb', email: 'x@y', user_metadata: {} },
      access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
    }));
    location.href = '/super';
    return 1;
  })()`).catch(() => {})
  await new Promise((r) => setTimeout(r, 2500))

  // سجّل الملتقط بعد التحميل ثم انتظر المزيد
  await evalJs(`(() => {
    window.__rej = [];
    window.addEventListener('unhandledrejection', (e) => window.__rej.push(String(e.reason?.message || e.reason).slice(0, 300)));
    return 'listening';
  })()`)
  await new Promise((r) => setTimeout(r, 8000))

  const st = await evalJs(`({
    rej: window.__rej,
    mainLen: document.querySelector('main')?.innerHTML.length || 0,
    spinner: !!document.querySelector('main svg.animate-spin'),
    text: (document.querySelector('main')?.innerText || '').slice(0, 300),
  })`)
  console.log('حجم المحتوى:', st.mainLen, '| سبنر:', st.spinner)
  console.log('رفض غير معالج:', st.rej.length ? JSON.stringify(st.rej, null, 1) : 'لا شيء')
  console.log('النص:', st.text)
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
