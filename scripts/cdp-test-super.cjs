// اختبار لوحة إدارة النظام داخل التطبيق المعبأ بحساب مدير النظام
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

  // 1) مستخدم عادي (موظفة استقبال) يحاول فتح /super → يجب أن يُعاد للرئيسية
  evalJs(`(() => {
    localStorage.setItem('cm_local_session', JSON.stringify({
      user: { id: '3d143a2c-0019-4ac0-bfe7-2da25d60af14', email: 'x@y', user_metadata: {} },
      access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
    }));
    location.href = '/super';
    return 1;
  })()`).catch(() => {})
  await new Promise((r) => setTimeout(r, 3000))
  const normal = await evalJs(`({ path: location.pathname, h1: document.querySelector('h1')?.innerText || '' })`)
  console.log('موظف استقبال يفتح /super ->', JSON.stringify(normal))

  // 2) مدير النظام يفتح /super → يجب أن تظهر لوحة الإدارة
  evalJs(`(() => {
    localStorage.setItem('cm_local_session', JSON.stringify({
      user: { id: 'c2a1bf00-efb1-4be3-86f8-5ca2d4c740cb', email: 'x@y', user_metadata: {} },
      access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
    }));
    location.href = '/super';
    return 1;
  })()`).catch(() => {})
  await new Promise((r) => setTimeout(r, 3500))
  const admin = await evalJs(`({
    path: location.pathname,
    h1: document.querySelector('h1')?.innerText || '',
    clinicNames: [...document.querySelectorAll('main *')].map(e => e.childElementCount === 0 ? e.innerText : '').filter(t => t && t.includes('عيادة')).slice(0, 5),
    hasError: document.body.innerText.includes('حدث خطأ غير متوقع'),
    text: document.body.innerText.slice(0, 500),
  })`)
  console.log('\nمدير النظام يفتح /super ->')
  console.log('  المسار:', admin.path, '| العنوان:', admin.h1, '| خطأ:', admin.hasError)
  console.log('  عيادات ظاهرة:', admin.clinicNames.join(' | ') || '(فحص النص أدناه)')
  console.log('  ---- نص الصفحة ----')
  console.log(admin.text)
  ws.close()
  console.log('DONE')
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
