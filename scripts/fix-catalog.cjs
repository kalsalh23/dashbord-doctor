const fs = require('fs');
const p = 'src/components/PrescriptionSheet.jsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  "  const catalogRef = useRef([])\n  const [, setCatVersion] = useState(0)",
  "  const [catalog, setCatalog] = useState([])"
);
s = s.replace(
  "        catalogRef.current = data || []\n        setCatVersion((v) => v + 1)",
  "        setCatalog(data || [])"
);
s = s.replace("    if (!q) return catalogRef.current.slice(0, 6)", "    if (!q) return catalog.slice(0, 6)");
s = s.replace("    return catalogRef.current.filter((m) => m.name.includes(q)).slice(0, 6)", "    return catalog.filter((m) => m.name.includes(q)).slice(0, 6)");
s = s.replace("  }, [catQuery, catVersion])", "  }, [catQuery, catalog])");
s = s.replace("import { useEffect, useMemo, useRef, useState } from 'react'", "import { useEffect, useMemo, useState } from 'react'");
fs.writeFileSync(p, s);
console.log('catalog state fixed:', s.includes('const [catalog, setCatalog]'), '| ref gone:', !s.includes('catalogRef'), '| catVersion gone:', !s.includes('catVersion'));
