const fs = require('fs');
const p = 'src/pages/doctor/Consultation.jsx';
let lines = fs.readFileSync(p, 'utf8').split('\n');

// 1) import specialtyByKey after hooks import (line 11, index 10)
const hookIdx = lines.findIndex(l => l.includes("import { useSchedules, friendlyDbError } from '../../lib/hooks'"));
if (!lines.some(l => l.includes('specialtyByKey'))) {
  lines.splice(hookIdx + 1, 0, "import { specialtyByKey } from '../../lib/specialties'");
}

// 2) spec config + specData state after isDental line
const dIdx = lines.findIndex(l => l.includes("const isDental = specialtyKey === 'dentistry'"));
if (dIdx >= 0 && !lines.some(l => l.includes('const spec = specialtyByKey'))) {
  lines.splice(dIdx + 1, 0, '  const spec = specialtyByKey(specialtyKey)');
}
const deIdx = lines.findIndex(l => l.includes('const [dentalEntries, setDentalEntries] = useState([])'));
if (deIdx >= 0 && !lines.some(l => l.includes('const [specData, setSpecData]'))) {
  lines.splice(deIdx + 1, 0, '  const [specData, setSpecData] = useState({})');
}

// 3) exam label from spec
const examIdx = lines.findIndex(l => l.includes("label={isDental ? 'الفحص الفمي' : 'الفحص السريري'}"));
if (examIdx >= 0) lines[examIdx] = lines[examIdx].replace("label={isDental ? 'الفحص الفمي' : 'الفحص السريري'}", 'label={spec.examLabel || "الفحص السريري"}');

fs.writeFileSync(p, lines.join('\n'));
console.log('patched:', lines.some(l => l.includes('specialtyByKey')), lines.some(l => l.includes('const spec =')), lines.some(l => l.includes('specData')), lines.some(l => l.includes('spec.examLabel')));
