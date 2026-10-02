const fs = require('fs');
const p = 'src/pages/doctor/Consultation.jsx';
let lines = fs.readFileSync(p, 'utf8').split('\n');

// 1) after the exam field (line index 442 = "443:" line above, 0-based 442) insert specialty fields card
const examCloseIdx = lines.findIndex(l => l.includes('label={spec.examLabel'));
if (examCloseIdx >= 0) {
  // find the closing </Field> right after it
  let closeIdx = examCloseIdx;
  for (let i = examCloseIdx; i < lines.length; i++) {
    if (lines[i].trim() === '</Field>') { closeIdx = i; break; }
  }
  const card = [
    '              {spec.fields?.length > 0 && (',
    '                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">',
    '                  <p className="mb-2 text-[11px] font-bold text-slate-500">بيانات {spec.label} الخاصة</p>',
    '                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">',
    '                    {spec.fields.map((f) => (',
    '                      <Field key={f.key} label={f.label}>',
    '                        <Input',
    '                          value={specData[f.label] || \'\'}',
    '                          onChange={(e) => setSpecData((d) => ({ ...d, [f.label]: e.target.value }))}',
    '                        />',
    '                      </Field>',
    '                    ))}',
    '                  </div>',
    '                </div>',
    '              )}',
  ];
  lines.splice(closeIdx + 1, 0, ...card);
}

// 2) visitPayload: add specialty_data
const payIdx = lines.findIndex(l => l.includes('medical_notes: form.medical_notes.trim() || null,'));
if (payIdx >= 0) lines.splice(payIdx + 1, 0, '      specialty_data: Object.keys(specData).length ? specData : null,');

fs.writeFileSync(p, lines.join('\n'));
console.log('fields card:', lines.some(l => l.includes('spec.fields?.length')), '| payload:', lines.some(l => l.includes('specialty_data: Object.keys(specData)')));
