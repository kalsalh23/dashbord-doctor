const fs = require('fs');
const p = 'src/components/PrescriptionSheet.jsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  'export default function PrescriptionSheet({ settings, patient, visit, meds = [], onMedsChange, editable = false })',
  'export default function PrescriptionSheet({ settings, patient, visit, meds = [], onMedsChange, editable = false, doctorName })'
);
fs.writeFileSync(p, s);
console.log('doctorName prop added:', s.includes(', doctorName })'));
