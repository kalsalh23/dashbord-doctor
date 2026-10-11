const fs = require('fs')
const t = fs.readFileSync('src/pages/doctor/DentalDashboard.jsx', 'utf8').split('\n')
t.forEach((l, i) => {
  if (/return \(|PageHeader|<Card|<div className|StatCard/.test(l)) console.log(i + 1 + ': ' + l.trim().slice(0, 110))
})
