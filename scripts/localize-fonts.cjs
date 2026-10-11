// Download IBM Plex Sans Arabic woff2 files locally and rewrite gf.css to /fonts/ URLs
const fs = require('fs')
const path = require('path')

const cssPath = 'public/fonts/gf.css'
let css = fs.readFileSync(cssPath, 'utf8')
const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1])
console.log(urls.length, 'font files')

;(async () => {
  for (const url of urls) {
    const name = url.split('/').pop()
    const out = path.join('public/fonts', name)
    if (!fs.existsSync(out)) {
      const res = await fetch(url)
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url)
      fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()))
    }
    css = css.split(url).join('/fonts/' + name)
  }
  fs.writeFileSync(cssPath, css)
  console.log('done — fonts local, css rewritten')
})()
