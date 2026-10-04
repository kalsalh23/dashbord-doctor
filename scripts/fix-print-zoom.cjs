const fs = require('fs');
let c = fs.readFileSync('src/styles.css', 'utf8');
const start = c.indexOf('/* print: isolate the prescription sheet');
const end = c.indexOf('}', c.indexOf('@page', start)) + 1;
const block = [
  '/* print: isolate the prescription sheet into a single A5 page */',
  '#print-clone { display: none; }',
  '@media print {',
  '  html.printing #root { display: none !important; }',
  '  html.printing #print-clone {',
  '    display: block !important;',
  '    position: absolute;',
  '    top: 0;',
  '    right: 0;',
  '    width: 745px;',
  '    zoom: 0.62;',
  '  }',
  '  html.printing body { background: #fff !important; }',
  '  #print-clone .prescription-sheet { width: 745px !important; }',
  '  @page { size: A5 portrait; margin: 5mm; }',
  '}',
].join('\n');
c = start >= 0 ? c.slice(0, start) + block : c + '\n\n' + block;
fs.writeFileSync('src/styles.css', c);
console.log('zoom-based print css:', c.includes('zoom: 0.62'));
