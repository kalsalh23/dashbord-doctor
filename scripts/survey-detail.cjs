// Show exact lines using or()/contains()/storage/auth detail calls.
const fs = require('fs')
const files = [
  'src/components/Layout.jsx',
  'src/pages/reception/Patients.jsx',
  'src/pages/doctor/DentalConsultation.jsx',
  'src/pages/doctor/EntConsultation.jsx',
  'src/pages/doctor/DentalTodayLog.jsx',
  'src/components/BookingModal.jsx',
  'src/pages/doctor/DoctorSettings.jsx',
  'src/pages/PatientProfile.jsx',
  'src/lib/staffPush.js',
  'src/pages/super/SuperPanel.jsx',
  'src/pages/reception/Settings.jsx',
]
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  lines.forEach((l, i) => {
    if (/\.(or|contains)\(|storage\.from\(|\.upload\(|\.download\(|\.remove\(|getPublicUrl|auth\.getUser|\.upsert\(/.test(l))
      console.log(f + ':' + (i + 1) + ': ' + l.trim().slice(0, 240))
  })
}
