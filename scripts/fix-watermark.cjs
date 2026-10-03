const fs = require('fs');
const p = 'src/components/PrescriptionSheet.jsx';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('const watermarkUrl')) {
  s = s.replace(
    "  const logoUrl = s?.prescription_logo_url || null",
    "  const logoUrl = s?.prescription_logo_url || null\n  const watermarkUrl = s?.prescription_watermark_url || null"
  );
  fs.writeFileSync(p, s);
}
console.log('watermarkUrl declared:', s.includes('const watermarkUrl'));
