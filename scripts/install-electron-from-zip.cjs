// استخراج حزمة Electron المنزلة إلى node_modules/electron/dist
// بحيث تعمل أوامر electron . مباشرة، وتجهيز مجلد electronDist لـ electron-builder
// الاستخدام: node scripts/install-electron-from-zip.cjs [path-to-zip]
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')

const zip = process.argv[2] || path.join(os.tmpdir(), 'electron-v44.5.1-win32-x64.zip')
if (!fs.existsSync(zip)) {
  console.error('الملف غير موجود: ' + zip)
  process.exit(1)
}
console.log('حجم الملف: ' + (fs.statSync(zip).size / 1024 / 1024).toFixed(1) + ' MB')

const distDir = path.join(__dirname, '..', 'node_modules', 'electron', 'dist')
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true })
fs.mkdirSync(distDir, { recursive: true })

// Windows: استخدم PowerShell Expand-Archive (موجود دائماً)
execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${distDir}' -Force"`, { stdio: 'inherit' })

fs.writeFileSync(path.join(__dirname, '..', 'node_modules', 'electron', 'path.txt'), 'electron.exe')
console.log('تم: node_modules/electron/dist جاهز')

// نسخة ثابتة لاستخدامها مع electron-builder عبر -c.electronDist
const cacheDir = path.join(os.homedir(), '.electron-cache')
const cachedDist = path.join(cacheDir, 'electron-v44.5.1-win32-x64')
if (fs.existsSync(cachedDist)) fs.rmSync(cachedDist, { recursive: true, force: true })
fs.mkdirSync(cacheDir, { recursive: true })
execSync(`robocopy "${distDir}" "${cachedDist}" /E /NFL /NDL /NJH /NJP /NP`, { stdio: 'ignore', shell: 'cmd.exe' })
console.log('تم: ' + cachedDist)
