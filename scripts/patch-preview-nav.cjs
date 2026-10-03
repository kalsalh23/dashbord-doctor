const fs = require('fs');

// 1) Layout nav: add معاينة, remove متابعاتي
const lp = 'src/components/Layout.jsx';
let l = fs.readFileSync(lp, 'utf8');
l = l.replace("    { to: '/doctor/visits', label: 'أرشيف المرضى', icon: FileText },\n    { to: '/doctor/follow-ups', label: 'متابعاتي', icon: Repeat },", "    { to: '/doctor/visits', label: 'أرشيف المرضى', icon: FileText },\n    { to: '/doctor/preview', label: 'معاينة', icon: Printer },");
if (!l.includes("'/doctor/preview'")) {
  // fallback: just add preview after archive if pattern differed
  l = l.replace("{ to: '/doctor/archive', label: 'أرشيف المرضى', icon: FileText },", "{ to: '/doctor/archive', label: 'أرشيف المرضى', icon: FileText },\n    { to: '/doctor/preview', label: 'معاينة', icon: Printer },");
}
fs.writeFileSync(lp, l);
console.log('nav preview:', l.includes("'/doctor/preview'"), '| follow-ups removed:', !l.includes("'/doctor/follow-ups'"));

// 2) App.jsx: remove follow-ups route/import, add preview route/import
const ap = 'src/App.jsx';
let a = fs.readFileSync(ap, 'utf8');
a = a.replace("import DoctorFollowUps from './pages/doctor/DoctorFollowUps'\n", "");
a = a.replace("import PatientArchive from './pages/doctor/PatientArchive'\n", "import PatientArchive from './pages/doctor/PatientArchive'\nimport PrescriptionPreview from './pages/doctor/PrescriptionPreview'\n");
a = a.replace('            <Route path="/doctor/follow-ups" element={<RequireRole role="doctor"><DoctorFollowUps /></RequireRole>} />\n', "");
a = a.replace(
  '            <Route path="/doctor/archive" element={<RequireRole role="doctor"><PatientArchive /></RequireRole>} />',
  '            <Route path="/doctor/archive" element={<RequireRole role="doctor"><PatientArchive /></RequireRole>} />\n            <Route path="/doctor/preview" element={<RequireRole role="doctor"><PrescriptionPreview /></RequireRole>} />'
);
fs.writeFileSync(ap, a);
console.log('app preview route:', a.includes("'/doctor/preview'"), '| follow-ups route removed:', !a.includes('/doctor/follow-ups'));

// 3) delete the follow-ups page
try { fs.unlinkSync('src/pages/doctor/DoctorFollowUps.jsx'); console.log('DoctorFollowUps deleted'); } catch {}
