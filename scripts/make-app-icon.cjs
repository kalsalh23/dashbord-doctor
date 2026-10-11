// توليد أيقونة التطبيق build/icon.png من شعار العيادة
//   node scripts/make-app-icon.cjs [مسار-الصورة]
// يكبّر الشعار بحياد ثنائي ويحشوه في مربع 512×512 بخلفية بيضاء
// (electron-builder يحوّل icon.png تلقائياً إلى ico لويندوز — يشترط ≥256px)
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const SRC = process.argv[2] || 'public/nizar-logo.png'
const OUT = 'build/icon.png'
const SIZE = 512
const MARGIN = 44 // إطار أبيض مريح حول الشعار

const src = PNG.sync.read(fs.readFileSync(SRC))
console.log(`المصدر: ${SRC} (${src.width}x${src.height})`)

// أكبر مقاس يحافظ على النسبة داخل المساحة المتاحة
const box = SIZE - MARGIN * 2
const scale = Math.min(box / src.width, box / src.height)
const dw = Math.round(src.width * scale)
const dh = Math.round(src.height * scale)
const ox = Math.round((SIZE - dw) / 2)
const oy = Math.round((SIZE - dh) / 2)

const out = new PNG({ width: SIZE, height: SIZE })
// خلفية بيضاء معتمة
for (let i = 0; i < SIZE * SIZE; i++) {
  out.data[i * 4] = 255
  out.data[i * 4 + 1] = 255
  out.data[i * 4 + 2] = 255
  out.data[i * 4 + 3] = 255
}

// تكبير bilinear من الإحداثيات المصدرية
const sx = src.width / dw
const sy = src.height / dh
for (let y = 0; y < dh; y++) {
  const fy = Math.min((y + 0.5) * sy - 0.5, src.height - 1)
  const y0 = Math.max(0, Math.floor(fy))
  const y1 = Math.min(src.height - 1, y0 + 1)
  const wy = fy - y0
  for (let x = 0; x < dw; x++) {
    const fx = Math.min((x + 0.5) * sx - 0.5, src.width - 1)
    const x0 = Math.max(0, Math.floor(fx))
    const x1 = Math.min(src.width - 1, x0 + 1)
    const wx = fx - x0
    const o = (y + oy) * SIZE + (x + ox)
    for (let c = 0; c < 4; c++) {
      const p00 = src.data[(y0 * src.width + x0) * 4 + c]
      const p10 = src.data[(y0 * src.width + x1) * 4 + c]
      const p01 = src.data[(y1 * src.width + x0) * 4 + c]
      const p11 = src.data[(y1 * src.width + x1) * 4 + c]
      out.data[o * 4 + c] = Math.round(
        p00 * (1 - wx) * (1 - wy) + p10 * wx * (1 - wy) + p01 * (1 - wx) * wy + p11 * wx * wy
      )
    }
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, PNG.sync.write(out))
console.log(`تمت كتابة ${OUT} (${SIZE}x${SIZE})`)
