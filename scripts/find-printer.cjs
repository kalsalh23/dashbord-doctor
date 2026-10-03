const fs = require('fs');
const path = require('path');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]
  );
}
for (const f of walk('src')) {
  if (!f.endsWith('.jsx') && !f.endsWith('.js')) continue;
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes('Printer')) continue;
  const uses = (s.match(/<Printer|Printer size|Printer,/g) || []).length;
  const imported = /import\s*{[^}]*Printer[^}]*}\s*from\s*'lucide-react'/.test(s);
  console.log(path.relative('.', f), '| uses:', uses, '| lucide import has Printer:', imported);
}
