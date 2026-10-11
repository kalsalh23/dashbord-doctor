// عدّ المرضى الظاهر فعلاً لكل طبيب في صفحة المرضى
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

  const doctors = [
    { id: '11e55e3e-02d3-45db-a4ab-b48c22424901', name: 'سليمان', expected: 12 },
    { id: 'e0cf5d8e-58db-4c57-9729-cf967077706e', name: 'حازم', expected: 7 },
  ]

  for (const d of doctors) {
    await evalJs(`(() => {
      localStorage.setItem('cm_local_session', JSON.stringify({
        user: { id: '${d.id}', email: 'x@y', user_metadata: {} },
        access_token: 'local', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
      }));
      location.href = '/doctor/patients';
      return 1;
    })()`)
    await new Promise((r) => setTimeout(r, 3000))
    const r = await evalJs(`(() => {
      const names = [...document.querySelectorAll('main tbody tr td:first-child, main a[href*="/patients/"] p, main a[href*="/patients/"] span')].map(e => e.innerText.trim()).filter(Boolean);
      return { clinic: document.querySelector('aside .text-sm.font-bold')?.innerText, patientMentions: names.slice(0, 30) };
    })()`)
    console.log(`${d.name} → العيادة: ${r.clinic} | أسماء مرضى ظاهرة: ${r.patientMentions.length} (المتوقع من عيادته فقط: ${d.expected})`)
    console.log('   ' + r.patientMentions.slice(0, 8).join('، '))
  }
  ws.close()
  console.log('DONE')
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
