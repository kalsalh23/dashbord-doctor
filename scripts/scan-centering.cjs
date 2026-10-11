// scan for top-level max-w-* containers that are not centered (no mx-auto)
const fs = require('fs')
const path = require('path')
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const fp = path.join(d, f)
    if (fs.statSync(fp).isDirectory()) walk(fp)
    else if (fp.endsWith('.jsx')) {
      fs.readFileSync(fp, 'utf8').split('\n').forEach((l, i) => {
        if (/className="max-w-/.test(l) && !/mx-auto/.test(l)) {
          console.log(fp + ':' + (i + 1) + ': ' + l.trim().slice(0, 130))
        }
      })
    }
  }
}
walk('src')
