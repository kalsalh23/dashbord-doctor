const fs = require('fs');

// 1) NizarSheet needs the format import
const np = 'src/components/NizarSheet.jsx';
let n = fs.readFileSync(np, 'utf8');
if (!n.includes('formatDateShort')) {
  n = "import { formatDateShort } from '../lib/format'\n" + n;
  fs.writeFileSync(np, n);
  console.log('nizar import added');
}

// 2) PrescriptionSheet becomes the dispatcher: nizar template → NizarSheet, else rose sheet
const p = 'src/components/PrescriptionSheet.jsx';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('NizarSheet')) {
  // rename the default export to RosePrescriptionSheet
  s = s.replace(
    'export default function PrescriptionSheet({ settings, patient, visit, meds = [], onMedsChange, editable = false, doctorName })',
    'export function RosePrescriptionSheet({ settings, patient, visit, meds = [], onMedsChange, editable = false, doctorName })'
  );
  // append dispatcher
  s += `\n\nimport NizarSheet from './NizarSheet'\n\n/**
 * موزّع القوالب: يختار قالب الوصفة حسب إعدادات العيادة.
 */\nexport default function PrescriptionSheet(props) {\n  if (props.settings?.prescription_template === 'nizar') {\n    return <NizarSheet {...props} />\n  }\n  return <RosePrescriptionSheet {...props} />\n}\n`;
  fs.writeFileSync(p, s);
  console.log('dispatcher wired');
}
