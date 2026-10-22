// فحص واجهة الاستقبال في عيادة النساء والتوليد
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

  const RECEPTION = 'd1a7b3c5-2e64-4f98-b0a3-6c7d5e9f1823'
  const go = async (url) => {
    await evalJs(`(async () => {
      localStorage.setItem('cm_local_session', JSON.stringify({
        user: { id: '${RECEPTION}', email: 'ranim.reception@noor-clinic.com', user_metadata: {} },
        access_token: 'local', token_type: 'bearer',
        expires_at: Math.floor(Date.now()/1000) + 3600,
      }));
      location.href = '${url}';
      return true;
    })()`)
    await new Promise((r) => setTimeout(r, 3000))
  }

  await go('http://127.0.0.1:5199/reception/patients')
  const res = await evalJs(`({
    url: location.pathname,
    hero: document.querySelector('.ob-hero')?.innerText.replace(/\\n/g,' | '),
    cards: document.querySelectorAll('.ob-card').length,
    buttons: [...document.querySelectorAll('.ob-card button')].map(b => b.innerText.trim()),
    theme: !!document.querySelector('.clinic-theme-ranim'),
  })`)
  console.log('RECEPTION-PATIENTS:', JSON.stringify(res, null, 1))

  // افتح ملف مريضة
  const profile = await evalJs(`(async () => {
    const btn = [...document.querySelectorAll('.ob-card button')].find(b => b.innerText.includes('الملف'));
    if (!btn) return 'no profile button';
    btn.click();
    await new Promise(r => setTimeout(r, 2500));
    return { url: location.pathname, h1: document.querySelector('h1')?.innerText,
      actions: [...document.querySelectorAll('.ob-hero button')].map(b => b.innerText.trim()),
      cards: document.querySelectorAll('.ob-card').length };
  })()`)
  console.log('RECEPTION-PROFILE:', JSON.stringify(profile, null, 1))

  // زر حجز المتابعة
  const book = await evalJs(`(async () => {
    const btn = [...document.querySelectorAll('.ob-hero button')].find(b => b.innerText.includes('حجز'));
    if (!btn) return 'no book button';
    btn.click();
    await new Promise(r => setTimeout(r, 1800));
    const modal = document.querySelector('[role="dialog"]');
    return { modalOpen: !!modal, text: modal?.innerText.replace(/\\n/g,' | ').slice(0, 260) };
  })()`)
  console.log('BOOK-MODAL:', JSON.stringify(book, null, 1))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  require('fs').writeFileSync(require('path').resolve('screenshots/ranim-reception.png'), Buffer.from(shot.data, 'base64'))
  console.log('DONE')
  ws.close()
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
