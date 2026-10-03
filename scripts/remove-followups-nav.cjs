const fs = require('fs');
const lp = 'src/components/Layout.jsx';
let lines = fs.readFileSync(lp, 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes("'/doctor/follow-ups'"));
if (idx >= 0) {
  lines.splice(idx, 1);
  fs.writeFileSync(lp, lines.join('\n'));
  console.log('متابعاتي nav removed');
} else {
  console.log('already removed');
}
