// ============================================================
// إلكترون: يشغّل الواجهة المبنية (dist/) من سيرفر محلي على
// 127.0.0.1 حتى تعمل IndexedDB والراوتر بلا أي اتصال بالإنترنت.
// ============================================================
const { app, BrowserWindow, Menu, shell } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')

const DIST = path.join(__dirname, '..', 'dist')

// ملف بيانات العيادة الخارجي: يُوضع بجانب التطبيق. نقبل الاسم القياسي
// clinic-data.json أو أي ملف يبدأ بـ clinic-data وينتهي بـ .json —
// هكذا يضع الطبيب الملف الذي استلمه كما هو دون إعادة تسمية.
function externalSeedFile() {
  const dirs = [
    process.env.PORTABLE_EXECUTABLE_DIR,
    path.dirname(process.execPath),
  ].filter(Boolean)
  for (const dir of dirs) {
    try {
      const exact = path.join(dir, 'clinic-data.json')
      if (fs.existsSync(exact)) return exact
      const match = fs.readdirSync(dir).find(
        (f) => f.startsWith('clinic-data') && f.endsWith('.json')
      )
      if (match) return path.join(dir, match)
    } catch {}
  }
  return null
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

const gotSingleLock = app.requestSingleInstanceLock()
if (!gotSingleLock) {
  app.quit()
}

// تخزين ثابت وآمن لبيانات قاعدة العيادة — ليس مجلد temp المؤقت
// (نفس المكان عبر كل التشغيلات والتحديثات: %APPDATA%\ClinicManager)
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'ClinicManager'))
} catch {}

function startServer() {
  // منفذ ثابت: قاعدة البيانات (IndexedDB) مرتبطة بالمنفذ (origin)،
  // فلو تغيّر المنفذ في كل تشغيل ضاعت بيانات الجلسة السابقة.
  // نبدأ من 45123 ونزيد عند التعارض.
  return new Promise((resolve, reject) => {
    let port = 45123
    const tryListen = () => {
      const server = http.createServer((req, res) => {
        try {
          const url = new URL(req.url, 'http://127.0.0.1')
          // أولوية لملف بيانات العيادة الخارجي
          if (url.pathname === '/seed-data.json') {
            const ext = externalSeedFile()
            if (ext) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
              fs.createReadStream(ext).pipe(res)
              return
            }
          }
          let file = path.join(DIST, decodeURIComponent(url.pathname))
          if (!file.startsWith(DIST)) file = path.join(DIST, 'index.html')
          if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            file = path.join(DIST, 'index.html') // SPA fallback
          }
          const ext2 = path.extname(file).toLowerCase()
          res.writeHead(200, { 'Content-Type': MIME[ext2] || 'application/octet-stream' })
          fs.createReadStream(file).pipe(res)
        } catch (e) {
          res.writeHead(500)
          res.end(String(e))
        }
      })
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && port < 45123 + 50) {
          port++
          tryListen()
        } else reject(e)
      })
      server.listen(port, '127.0.0.1', () => resolve(port))
    }
    tryListen()
  })
}

async function createWindow() {
  const port = await startServer()

  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: 'نظام إدارة العيادة',
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // أي رابط خارجي (واتساب مثلاً) يفتح في متصفح النظام
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.loadURL(`http://127.0.0.1:${port}/`)
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
