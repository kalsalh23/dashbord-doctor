const fs = require('fs')
let t = fs.readFileSync('src/components/DentalChart.jsx', 'utf8')
t.split('\n').forEach((l, i) => {
  if (/toothType|CROWN_W/.test(l)) console.log(i + 1 + ': ' + l.trim().slice(0, 140))
})
