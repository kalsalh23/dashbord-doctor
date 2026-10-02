const fs = require('fs');
const p = 'src/pages/PatientProfile.jsx';
let s = fs.readFileSync(p, 'utf8');

// display specialty fields inside VisitCard, after the meds list block
const anchor = s.indexOf('{meds.length > 0 && (');
if (anchor >= 0 && !s.includes('بيانات التخصص')) {
  const block = `          {visit.specialty_data && Object.keys(visit.specialty_data).length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-slate-400">بيانات التخصص</p>
              <ul className="space-y-1">
                {Object.entries(visit.specialty_data).map(([label, value]) => (
                  <li key={label} className="flex gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="font-bold text-slate-500">{label}:</span>
                    <span className="font-semibold text-slate-700">{String(value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}`;
  s = s.slice(0, anchor) + block + '\n          ' + s.slice(anchor);
  fs.writeFileSync(p, s);
  console.log('VisitCard specialty fields added');
} else console.log('anchor not found or already added');
