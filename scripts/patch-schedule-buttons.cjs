const fs = require('fs');
const p = 'src/pages/doctor/Schedule.jsx';
let s = fs.readFileSync(p, 'utf8');

// replace the actions block: badge + last-visit(secondary) + conditional start + folder ghost
const old = `                <Badge map={APPT_STATUS} value={a.status} />
                <Button size="sm" variant="secondary" onClick={() => setLastVisitFor(a.patient)} title="عرض آخر زيارة">
                  <History size={14} />
                  آخر زيارة
                </Button>
                {['arrived', 'waiting'].includes(a.status) && (
                  <Button size="sm" onClick={() => startConsult(a)}>
                    <Stethoscope size={14} />
                    بدء الكشف
                  </Button>
                )}
                {a.status === 'in_consultation' && (
                  <Button size="sm" onClick={() => startConsult(a)}>
                    <Stethoscope size={14} />
                    متابعة
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => nav(\`/doctor/patients/\${a.patient_id}\`)} title="فتح الملف">
                  <FolderOpen size={14} />
                </Button>`;

const next = `                <Badge map={APPT_STATUS} value={a.status} />
                <button
                  onClick={() => setLastVisitFor(a.patient)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200"
                >
                  <History size={13} />
                  آخر زيارة
                </button>
                <button
                  onClick={() => startConsult(a)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  <Stethoscope size={13} />
                  بدء الكشف
                </button>`;

if (!s.includes(old)) { console.log('OLD BLOCK NOT FOUND — checking variants'); }
s = s.replace(old, next);

fs.writeFileSync(p, s);
console.log('last-visit amber:', s.includes('border-amber-300 bg-amber-100'), '| green start:', s.includes('bg-emerald-600'), '| folder removed:', !s.includes('FolderOpen size={14}'));
