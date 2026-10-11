// التحقق من ظهور زر الرجوع في الصفحات الداخلية واختفائه في الرئيسية
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
    return r.result.value
  }

  const userId = '3d143a2c-0019-4ac0-bfe7-2da25d60af14' // موظفة استقبال حقيقية
  const check = async (path) => {
    await evalJs(`(async () => {
      localStorage.setItem('cm_local_session', JSON.stringify({
        user: { id: '${userId}', email: 't@l', user_metadata: {} },
        access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
      }));
      location.href = '${path}';
    })()`)
    await new Promise((r) => setTimeout(r, 2200))
    return evalJs(`({
      path: location.pathname,
      backBtn: !!document.querySelector('[aria-label="رجوع للصفحة السابقة"]'),
    })`)
  }
  console.log('home   /reception            ->', JSON.stringify(await check('/reception')))
  console.log('inner  /reception/appointments ->', JSON.stringify(await check('/reception/appointments')))
  console.log('inner  /reception/patients   ->', JSON.stringify(await check('/reception/patients')))
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
