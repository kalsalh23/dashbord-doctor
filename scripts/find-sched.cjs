const fs = require('fs')
const t = fs.readFileSync('src/pages/doctor/Schedule.jsx', 'utf8').split('\n')
console.log('total', t.length)
t.forEach((l, i) => {
  if (/return \(|grid-cols|PageHeader|title=|selected|weekStart|DAY|Card title/.test(l))
    console.log(i + 1 + ': ' + l.trim().slice(0, 110))
})
