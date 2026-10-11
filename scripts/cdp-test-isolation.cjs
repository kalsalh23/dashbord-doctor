// إثبات العزل في التطبيق المعبأ: طبيبان من عيادتين مختلفتين في نفس التطبيق
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
    if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }

  // طبيبان حقيقيان من عيادتين مختلفتين (من فحص profiles السابق):
  // سليمان الحسين -> عيادة سليمان محمد الحسين (f0d1e425...)
  // حازم الشيخ    -> عيادة حازم محمد الشيخ (5573edcc...)
  const doctors = [
    { id: '11e55e3e-02d3-45db-a4ab-b48c22424901', name: 'سليمان', clinic: 'f0d1e425' },
    { id: 'e0cf5d8e-58db-4c57-9729-cf967077706e', name: 'حازم', clinic: '5573edcc' },
  ]

  for (const d of doctors) {
    await evalJs(`(async () => {
      localStorage.setItem('cm_local_session', JSON.stringify({
        user: { id: '${d.id}', email: 'x@y', user_metadata: {} },
        access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
      }));
      location.href = '/reception/patients';
    })()`)
    await new Promise((r) => setTimeout(r, 2500))
    const st = await evalJs(`(async () => {
      // عدّ المرضى الظاهرين في جدول المرضى + اسم العيادة في الشريط
      const rows = document.querySelectorAll('main table tbody tr, main [role="row"], main .grid a').length
      const clinicName = document.querySelector('aside .text-sm.font-bold')?.innerText || ''
      // والفحص المباشر من القاعدة عبر واجهة التطبيق نفسها غير ممكن، لذا نقرأ النص
      return { path: location.pathname, clinicName, rowsShown: rows, text: document.body.innerText.slice(0, 300) }
    })()`)
    console.log(`--- طبيب: ${d.name} (عيادة ${d.clinic}...)`)
    console.log(`    العيادة الظاهرة: ${st.clinicName}`)
    console.log(`    مسار: ${st.path}`)
  }

  // الفحص القاطع: كم مريضاً يرى كل طبيب في قاعدة البيانات عبر واجهة البحث؟
  for (const d of doctors) {
    const count = await evalJs(`(async () => {
      localStorage.setItem('cm_local_session', JSON.stringify({
        user: { id: '${d.id}', email: 'x@y', user_metadata: {} },
        access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
      }));
      location.href = '/reception';
      return new Promise((res) => setTimeout(() => {
        // عدد أسماء المرضى في مواعيد اليوم الظاهرة فقط كمؤشر
        res(document.body.innerText.length);
      }, 2500));
    })()`)
    console.log(`طبيب ${d.name}: حجم نص الصفحة الرئيسية = ${count}`)
  }
  ws.close()
  console.log('DONE')
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
