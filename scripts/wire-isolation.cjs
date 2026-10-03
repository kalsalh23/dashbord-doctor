const fs = require('fs');
function wire(p, stateLine) {
  let lines = fs.readFileSync(p, 'utf8').split('\n');
  if (lines.some(l => l.includes('usePrintIsolation'))) { console.log(p, 'already'); return; }
  const impIdx = lines.findIndex(l => l.includes("PrescriptionSheet from"));
  lines.splice(impIdx + 1, 0, "import { usePrintIsolation } from '../../lib/print'");
  const stIdx = lines.findIndex(l => l.includes(stateLine));
  lines.splice(stIdx + 1, 0, '  usePrintIsolation()');
  fs.writeFileSync(p, lines.join('\n'));
  console.log(p, 'wired ✓');
}
wire('src/pages/doctor/PrescriptionPage.jsx', 'const [savedMark, setSavedMark] = useState(false)');
wire('src/pages/doctor/PrescriptionPreview.jsx', 'const [medsDirty, setMedsDirty] = useState(false)');
wire('src/pages/doctor/PrescriptionStage.jsx', 'const [printed, setPrinted] = useState(false)');
