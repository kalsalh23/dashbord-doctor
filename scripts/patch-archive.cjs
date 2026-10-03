const fs = require('fs');

// ---------- Consultation: prescription stage ----------
const cp = 'src/pages/doctor/Consultation.jsx';
let c = fs.readFileSync(cp, 'utf8');
if (!c.includes('PrescriptionStage')) {
  c = c.replace(
    "import { specialtyByKey } from '../../lib/specialties'",
    "import { specialtyByKey } from '../../lib/specialties'\nimport PrescriptionStage from './PrescriptionStage'"
  );
  c = c.replace(
    "    setSaving(false)\n    toast('success', 'تم حفظ الزيارة بنجاح')\n    setStage('followup')",
    "    setSaving(false)\n    toast('success', 'تم حفظ الزيارة بنجاح')\n    setSavedVisit({ ...visit, patient, medications: realMeds, doctor: { full_name: profile.full_name } })\n    setStage('prescription')"
  );
  // add savedVisit state + prescription stage render before followup block
  c = c.replace(
    '  const [specData, setSpecData] = useState({})',
    '  const [specData, setSpecData] = useState({})\n  const [savedVisit, setSavedVisit] = useState(null)'
  );
  c = c.replace(
    '  /* ---------- stage: follow-up ---------- */\n  if (stage === \'followup\' || stage === \'done\') {',
    `  /* ---------- stage: prescription (معاينة) ---------- */
  if (stage === 'prescription' && savedVisit) {
    return (
      <div className="py-4">
        <PrescriptionStage visit={savedVisit} onContinue={() => setStage('followup')} />
      </div>
    )
  }

  /* ---------- stage: follow-up ---------- */
  if (stage === 'followup' || stage === 'done') {`
  );
  fs.writeFileSync(cp, c);
  console.log('consultation patched:', c.includes('PrescriptionStage'), c.includes("stage === 'prescription'"));
}

// ---------- App.jsx: archive route + bare print route ----------
const ap = 'src/App.jsx';
let a = fs.readFileSync(ap, 'utf8');
a = a.replace("import VisitsLog from './pages/doctor/VisitsLog'", "import PatientArchive from './pages/doctor/PatientArchive'\nimport PrescriptionPage from './pages/doctor/PrescriptionPage'");
a = a.replace(
  '            <Route path="/doctor/visits" element={<RequireRole role="doctor"><VisitsLog /></RequireRole>} />',
  '            <Route path="/doctor/archive" element={<RequireRole role="doctor"><PatientArchive /></RequireRole>} />'
);
a = a.replace(
  '          <Route path="/super" element={<RequireSuper><SuperPanel /></RequireSuper>} />',
  `          <Route path="/super" element={<RequireSuper><SuperPanel /></RequireSuper>} />
          {/* bare printable prescription page */}
          <Route path="/print/prescription/:visitId" element={<BareAuth><PrescriptionPage /></BareAuth>} />`
);
a = a.replace(
  'function UnauthorizedScreen() {',
  `function BareAuth({ children }) {
  const { session } = useApp()
  if (session === undefined) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  return children
}

function UnauthorizedScreen() {`
);
fs.writeFileSync(ap, a);
console.log('app patched:', a.includes('PatientArchive'), a.includes('BareAuth'), a.includes('/print/prescription/'));

// ---------- Layout: nav label + route ----------
const lp = 'src/components/Layout.jsx';
let l = fs.readFileSync(lp, 'utf8');
l = l.replace("{ to: '/doctor/visits', label: 'سجل الكشوفات', icon: FileText }", "{ to: '/doctor/archive', label: 'أرشيف المرضى', icon: FileText }");
fs.writeFileSync(lp, l);
console.log('layout label:', l.includes('أرشيف المرضى'));

// ---------- DentalDashboard tools link ----------
const dp = 'src/pages/doctor/DentalDashboard.jsx';
let d = fs.readFileSync(dp, 'utf8');
d = d.replace("onClick={() => nav('/doctor/visits')}", "onClick={() => nav('/doctor/archive')}");
d = d.replace('سجل الكشوفات', 'أرشيف المرضى');
fs.writeFileSync(dp, d);
console.log('dental dashboard link:', d.includes('/doctor/archive'));

// ---------- VisitsLog removed ----------
try { fs.unlinkSync('src/pages/doctor/VisitsLog.jsx'); console.log('VisitsLog deleted'); } catch {}
