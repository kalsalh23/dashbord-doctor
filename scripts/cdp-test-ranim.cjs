// فحص واجهات عيادة النساء والتوليد — Dr. Ranim Al-Nabhan
// يفتح التطبيق، يحقن جلسة الطبيبة، ويمرّ على صفحات العيادة ويلتقط صوراً
const fs = require('fs')
const path = require('path')

const OUT = path.resolve('screenshots')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

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
    if (r.exceptionDetails) throw new Error('PAGE ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 600))
    return r.result.value
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')

  // 1) انتظر تهيئة القاعدة المحلية (البذور)
  await evalJs(`location.href = 'http://127.0.0.1:5199/'`)
  await new Promise((r) => setTimeout(r, 4000))

  const seeded = await evalJs(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('clinic_offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) });
    const tx = db.transaction('rows', 'readonly');
    const idx = tx.objectStore('rows').index('by-table');
    const get = (t) => new Promise((res) => { const q = idx.getAll(t); q.onsuccess = () => res(q.result) });
    const clinics = await get('clinics');
    const profiles = await get('profiles');
    const users = await get('__users');
    db.close();
    return {
      clinics: clinics.map(c => c.name),
      profiles: profiles.map(p => ({ id: p.id, name: p.full_name, role: p.role, clinic: p.clinic_id })),
      users: users.map(u => u.email),
    };
  })()`)
  console.log('CLINICS:', JSON.stringify(seeded.clinics))
  console.log('USERS:', JSON.stringify(seeded.users))

  const ranim = seeded.profiles.find((p) => p.name.includes('رنيم') && p.role === 'doctor')
  if (!ranim) throw new Error('لم يُعثر على حساب الطبيبة في البذور')

  // 2) احقن جلسة الطبيبة وافتح الصفحات
  const pages = [
    ['/doctor', 'لوحة اليوم'],
    ['/doctor/patients', 'المريضات'],
    ['/doctor/consultation', 'الكشف'],
    ['/doctor/schedule', 'جدول المواعيد'],
    ['/doctor/archive', 'الأرشيف'],
  ]
  for (const [p, label] of pages) {
    await evalJs(`(async () => {
      localStorage.setItem('cm_local_session', JSON.stringify({
        user: { id: '${ranim.id}', email: 'ranim@noor-clinic.com', user_metadata: {} },
        access_token: 'local', token_type: 'bearer',
        expires_at: Math.floor(Date.now()/1000) + 3600,
      }));
      location.href = 'http://127.0.0.1:5199${p}';
      return true;
    })()`)
    await new Promise((r) => setTimeout(r, 2600))
    const st = await evalJs(`({
      path: location.pathname,
      rootLen: document.getElementById('root')?.innerHTML.length ?? -1,
      err: document.body.innerText.includes('حدث خطأ غير متوقع') || document.body.innerText.includes('Something went wrong'),
      h1: (document.querySelector('h1')?.innerText || '').replace(/\\n/g,' '),
      pills: document.querySelectorAll('.ob-pill').length,
      heroes: document.querySelectorAll('.ob-hero').length,
      snippet: document.body.innerText.slice(0, 160).replace(/\\n/g, ' | '),
    })`)
    console.log(`[${label}] ${st.path} rootLen=${st.rootLen} err=${st.err} h1="${st.h1}" pills=${st.pills} heroes=${st.heroes}`)
    if (st.err || st.rootLen < 300) console.log('   BODY:', st.snippet)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, 'ranim' + p.replace(/\//g, '_') + '.png'), Buffer.from(shot.data, 'base64'))
  }

  console.log('DONE')
  ws.close()
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
