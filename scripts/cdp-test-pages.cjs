// اختبار الواجهات الداخلية في التطبيق المعبأ: حقن جلسة لمستخدم حقيقي + فحص الصفحات
const fs = require('fs')

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
    if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 500))
    return r.result.value
  }

  // 1) اقرأ المستخدمين والملفات الشخصية من القاعدة المحلية
  const users = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const get = (t) => new Promise((res) => { const q = idx.getAll(t); q.onsuccess = () => res(q.result) });
    const profiles = await get('profiles');
    db.close();
    return profiles.map(p => ({ id: p.id, name: p.full_name, role: p.role, clinic: p.clinic_id, active: p.is_active }));
  })()`)
  console.log('PROFILES:', JSON.stringify(users, null, 1))

  // 2) اختر مستخدماً لكل دور وحقن جلسة ثم افحص الصفحات
  const pick = (role) => users.find((u) => u.role === role && u.active !== false)
  const roles = ['reception', 'doctor', 'admin'].map(pick).filter(Boolean)

  const pagesToTest = {
    reception: ['/reception', '/reception/appointments', '/reception/patients', '/reception/payments', '/reception/follow-ups', '/reception/settings'],
    doctor: ['/doctor', '/doctor/schedule', '/doctor/patients', '/doctor/archive'],
  }

  for (const u of roles) {
    const home = u.role === 'doctor' ? pagesToTest.doctor : pagesToTest.reception
    for (const path of home) {
      await evalJs(`(async () => {
        localStorage.setItem('cm_local_session', JSON.stringify({
          user: { id: '${u.id}', email: 'test@local', user_metadata: {} },
          access_token: 'local', token_type: 'bearer',
          expires_at: Math.floor(Date.now()/1000) + 3600,
        }));
        location.href = '${path}';
        return true;
      })()`)
      await new Promise((r) => setTimeout(r, 2500))
      const st = await evalJs(`({
        path: location.pathname,
        rootLen: document.getElementById('root')?.innerHTML.length ?? -1,
        error: document.body.innerText.includes('حدث خطأ غير متوقع'),
        heading: document.querySelector('h1')?.innerText || '',
        bodySnippet: document.body.innerText.slice(0, 120).replace(/\\n/g, ' | '),
      })`)
      console.log(`[${u.role}] ${st.path} -> rootLen=${st.rootLen} err=${st.error} h1="${st.heading}"`)
      if (st.error || st.rootLen < 200) {
        console.log('   BODY:', st.bodySnippet)
        const shot = await send('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync('screenshots/broken-' + u.role + path.replace(/\//g, '_') + '.png', Buffer.from(shot.data, 'base64'))
      }
    }
  }
  console.log('DONE')
  ws.close()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
