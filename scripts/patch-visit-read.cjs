const fs = require('fs');

// 1) route for the visit read page
const ap = 'src/App.jsx';
let a = fs.readFileSync(ap, 'utf8');
if (!a.includes('VisitReadPage')) {
  a = a.replace(
    "import PatientArchive from './pages/doctor/PatientArchive'",
    "import PatientArchive from './pages/doctor/PatientArchive'\nimport VisitReadPage from './pages/doctor/VisitReadPage'"
  );
  a = a.replace(
    '            <Route path="/doctor/archive" element={<RequireRole role="doctor"><PatientArchive /></RequireRole>} />',
    '            <Route path="/doctor/archive" element={<RequireRole role="doctor"><PatientArchive /></RequireRole>} />\n            <Route path="/doctor/visit/:visitId" element={<RequireRole role="doctor"><VisitReadPage /></RequireRole>} />'
  );
  fs.writeFileSync(ap, a);
  console.log('app route added');
}

// 2) archive: visit click opens the read page (replace inline expand)
const p = 'src/pages/doctor/PatientArchive.jsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  "  const [openVisit, setOpenVisit] = useState(null)\n",
  ''
);
s = s.replace(
  `                        <div key={v.id} className="rounded-lg border border-slate-200 bg-white">
                          <button onClick={() => setOpenVisit(vOpen ? null : v.id)} className="flex w-full flex-wrap items-center gap-2.5 px-3.5 py-2.5 text-start">
                            <span className="text-xs font-bold text-slate-800">{formatDateShort(v.visit_date)}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                              {v.chief_complaint || '—'}{v.diagnosis ? \` — \${v.diagnosis}\` : ''}
                            </span>
                            {meds.length > 0 && <Tag tone="teal">{meds.length} دواء</Tag>}
                            <ChevronDown size={14} className={\`shrink-0 text-slate-400 transition-transform \${vOpen ? 'rotate-180' : ''}\`} />
                          </button>`,
  `                        <div key={v.id} className="rounded-lg border border-slate-200 bg-white">
                          <button onClick={() => nav(\`/doctor/visit/\${v.id}\`)} className="flex w-full flex-wrap items-center gap-2.5 px-3.5 py-2.5 text-start hover:bg-primary-50/40">
                            <span className="text-xs font-bold text-slate-800">{formatDateShort(v.visit_date)}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                              {v.chief_complaint || '—'}{v.diagnosis ? \` — \${v.diagnosis}\` : ''}
                            </span>
                            {meds.length > 0 && <Tag tone="teal">{meds.length} دواء</Tag>}
                            <Stethoscope size={14} className="shrink-0 text-primary-500" />
                          </button>`
);
fs.writeFileSync(p, s);
console.log('archive visit click → read page:', !s.includes('setOpenVisit'), s.includes('/doctor/visit/'));
