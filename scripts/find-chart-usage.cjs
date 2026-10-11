const fs = require('fs')
for (const f of [
  'src/pages/doctor/DentalConsultation.jsx',
  'src/pages/PatientProfile.jsx',
  'src/pages/doctor/DentalDashboard.jsx',
  'src/pages/doctor/DentalTodayLog.jsx',
]) {
  const t = fs.readFileSync(f, 'utf8')
  t.split('\n').forEach((l, i) => {
    if (/DentalChart/.test(l)) console.log(f + ':' + (i + 1) + ': ' + l.trim().slice(0, 150))
  })
}
