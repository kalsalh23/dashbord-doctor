const fs = require('fs');
const p = 'src/components/PrescriptionSheet.jsx';
let s = fs.readFileSync(p, 'utf8');

// fix imports: add react hooks + lucide icons + supabase
s = s.replace(
  "import { ageFrom, formatDateShort, genderLabel } from '../lib/format'",
  "import { useEffect, useMemo, useRef, useState } from 'react'\nimport { X, Search, Plus } from 'lucide-react'\nimport { supabase } from '../lib/supabase'\nimport { ageFrom, formatDateShort, genderLabel } from '../lib/format'"
);

// remove unused Trash2 (already not present) and fix catVersion order: declare state before the effect
s = s.replace(
  `  // كتالوج الأدوية المشترك (يُجلب مرة واحدة)
  useEffect(() => {`,
  `  const [, setCatVersion] = useState(0)

  // كتالوج الأدوية المشترك (يُجلب مرة واحدة)
  useEffect(() => {`
);
s = s.replace('  const [, setCatVersion] = useState(0)\n\n  const s = settings || {}', "  const s = settings || {}");
// ensure only one catVersion declaration before the effect
const firstIdx = s.indexOf('const [, setCatVersion] = useState(0)');
const secondIdx = s.indexOf('const [, setCatVersion] = useState(0)', firstIdx + 1);
if (secondIdx >= 0) {
  s = s.slice(0, secondIdx) + s.slice(s.indexOf('\n', secondIdx) + 1);
}
fs.writeFileSync(p, s);
console.log('imports fixed:', s.includes("import { useEffect, useMemo, useRef, useState } from 'react'"), '| catVersion count:', (s.match(/setCatVersion\] = useState/g) || []).length);
