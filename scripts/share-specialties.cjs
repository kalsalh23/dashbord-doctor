const fs = require('fs');
function shareList(path, importAfter) {
  let s = fs.readFileSync(path, 'utf8');
  if (s.includes('lib/specialties')) { console.log(path, 'already shared'); return; }
  const start = s.indexOf('const SPECIALTIES');
  if (start === -1) { console.log(path, 'NO LOCAL LIST'); return; }
  const end = s.indexOf('\n]', start);
  if (end === -1) { console.log(path, 'NO END'); return; }
  s = s.slice(0, start) + s.slice(end + 3); // remove local list (+ its trailing \n])
  const impAt = s.indexOf(importAfter);
  const lineEnd = s.indexOf('\n', impAt);
  s = s.slice(0, lineEnd + 1) + "import { SPECIALTIES } from '../../lib/specialties'\n" + s.slice(lineEnd + 1);
  fs.writeFileSync(path, s);
  console.log(path, 'shared ✓');
}
shareList('src/pages/super/SuperPanel.jsx', "import { friendlyDbError } from '../../lib/hooks'");
shareList('src/pages/reception/Settings.jsx', "import { useSchedules } from '../../lib/hooks'");
