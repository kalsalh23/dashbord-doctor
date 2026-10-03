const fs = require('fs');
let c = fs.readFileSync('src/styles.css', 'utf8');
const start = c.indexOf('/* print: show only the prescription sheet */');
const block = [
  '/* print: show only the prescription sheet — scaled to fit A5 exactly */',
  '@media print {',
  '  body * { visibility: hidden !important; }',
  '  .print-area, .print-area * { visibility: visible !important; }',
  '  .print-area {',
  '    position: absolute !important;',
  '    top: 0 !important;',
  '    right: 0 !important;',
  '    left: auto !important;',
  '    width: 745px !important;',
  '    transform: scale(0.655) !important;',
  '    transform-origin: top right !important;',
  '    box-shadow: none !important;',
  '    margin: 0 !important;',
  '    padding: 3mm !important;',
  '    background: #fff !important;',
  '  }',
  '  @page { size: A5 portrait; margin: 4mm; }',
  '}',
].join('\n');
c = start >= 0 ? c.slice(0, start) + block : c + '\n\n' + block;
fs.writeFileSync('src/styles.css', c);
console.log('print css updated:', c.includes('scale(0.655)'));
