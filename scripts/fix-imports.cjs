// Add .js extension to relative imports inside src/lib/local (needed for plain Node ESM too)
const fs = require('fs')
const dir = 'src/lib/local'
for (const f of ['auth.js', 'storage.js', 'seed.js', 'client.js', 'rpc.js']) {
  const p = dir + '/' + f
  let t = fs.readFileSync(p, 'utf8')
  const before = t
  t = t.replace(/from '\.\/(db|auth|storage|seed|client|rpc)'/g, "from './$1.js'")
  if (t !== before) {
    fs.writeFileSync(p, t)
    console.log('updated', p)
  } else {
    console.log('unchanged', p)
  }
}
