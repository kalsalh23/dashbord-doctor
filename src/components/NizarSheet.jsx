import { ageFrom, formatDateShort } from '../lib/format'

/**
 * ورقة المعاينة — عيادة د. نزار عبدالستار الشقرة
 * الصورة por.jpg هي التصميم الكامل للورقة. نضع فوقها فقط الحقول المطلوبة:
 * الاسم (يتم تعبئته تلقائياً)، العمر (يتم تعبئته تلقائياً)، التشخيص (يكتبه الطبيب)، التاريخ، وحقل اختيار الدواء.
 */
export default function NizarSheet({ patient, visit, meds = [], onTopEdit = null, dateValue = null, onDateEdit = null, medEntrySlot = null, onDeleteMed = null, paperImage = '/ima.jpg' }) {
  const age = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : ''

  const shownMeds = meds.slice(0, 20)

  return (
    <div
      className="prescription-sheet relative flex flex-col overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${paperImage})`, fontFamily: '"IBM Plex Sans Arabic", serif' }}
    >
      {/* الحقول التفاعلية فقط - فوق الصورة بدون تكرار للتصميم */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-12 pb-28">
        {/* صف الاسم والعمر والتشخيص والتاريخ - في منتصف الورقة */}
        <div className="absolute left-12 right-12 flex flex-wrap items-end gap-x-4 gap-y-3 text-[14px] font-bold text-slate-900" style={{ top: 'calc(33% - 0px)', transform: 'translateY(-50%)' }}>
          <div className="flex items-end gap-1">
            <b>اسم المريض:</b>
            <span className="inline-block min-w-[180px] border-b border-dotted border-slate-600 px-1">
              {onTopEdit ? (
                <input
                  value={(patient?.full_name || '').trim()}
                  onChange={(e) => onTopEdit('name', e.target.value)}
                  className="w-full bg-transparent text-center outline-none placeholder:text-slate-400"
                  placeholder="اسم المريض"
                />
              ) : (
                patient?.full_name || ''
              )}
            </span>
          </div>
          <div className="flex items-end gap-1">
            <b>العمر:</b>
            <span className="inline-block w-16 border-b border-dotted border-slate-600 px-1 text-center">
              {age || '...'}
            </span>
          </div>
          <div className="flex items-end gap-1 flex-1 min-w-[200px]">
            <b>التشخيص:</b>
            <span className="inline-block flex-1 border-b border-dotted border-slate-600 px-1">
              {onTopEdit ? (
                <input
                  value={visit?.diagnosis || ''}
                  onChange={(e) => onTopEdit('diagnosis', e.target.value)}
                  className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  placeholder="اكتب التشخيص هنا"
                />
              ) : (
                <span className="block w-full">{visit?.diagnosis || ''}</span>
              )}
            </span>
          </div>
          <div className="flex items-end gap-1">
            <b>التاريخ:</b>
            <span className="inline-block w-32 border-b border-dotted border-slate-600 px-1 text-center">
              {onDateEdit ? (
                <input
                  dir="ltr"
                  value={dateValue ?? (visit?.visit_date ? formatDateShort(visit.visit_date) : '')}
                  onChange={(e) => onDateEdit(e.target.value)}
                  className="w-full bg-transparent text-center outline-none"
                />
              ) : (
                visit?.visit_date ? formatDateShort(visit.visit_date) : ''
              )}
            </span>
          </div>
        </div>

        {/* منطقة الأدوية */}
        <div className="absolute bottom-28 left-12 right-12 flex min-h-0 flex-col text-[15px] font-bold text-slate-900" style={{ top: 'calc(36% + 35px)' }}>
          <div className="flex min-h-0 flex-1 flex-col">
            {shownMeds.map((m, i) => {
              const line = [m.name, m.dosage, m.duration, m.instructions].filter(Boolean).join(' — ')
              return (
                <div key={i} className="flex items-center justify-between border-b border-dotted border-slate-300 py-2.5 px-1">
                  <span className="truncate pr-2">{line}</span>
                  {onDeleteMed && (
                    <button
                      type="button"
                      onClick={() => onDeleteMed(meds.indexOf(m))}
                      className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-white print:hidden"
                    >
                      حذف
                    </button>
                  )}
                </div>
              )
            })}
            {medEntrySlot && (
              <div className="border-b border-dotted border-slate-300 py-2.5 px-1">{medEntrySlot}</div>
            )}
            {shownMeds.length === 0 && !medEntrySlot && (
              <div className="py-2 px-1 text-slate-400">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function NizarSurgicalInstructions() {
  return (
    <div className="prescription-sheet relative flex flex-col overflow-hidden bg-white" style={{ fontFamily: '"IBM Plex Sans Arabic", serif' }}>
      <div className="h-6 w-full bg-blue-600" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-12 py-8">
        <h2 className="mb-6 text-center text-lg font-bold">تعليمات العمل الجراحي</h2>
        <div className="space-y-4">
          {['تمارين تقوية عضلات الرقبة', 'تمارين تقوية عضلات الظهر', 'تمارين لعلاج التهاب الكتف'].map((label) => (
            <div key={label} className="flex items-center justify-between border-b border-dotted border-slate-300 py-3">
              <span className="font-bold text-slate-800">{label}</span>
            </div>
          ))}
          <div className="pt-4 text-center font-bold text-slate-800">تمارين اضافية</div>
          <div className="flex items-start gap-4">
            <textarea className="flex-1 rounded border border-slate-300 p-2 text-sm" rows={4} placeholder="ملاحظات" />
          </div>
          <img src="/par.png" alt="par" className="mx-auto mt-4 max-h-60 object-contain" />
        </div>
      </div>
      <div className="h-6 w-full bg-blue-600" />
    </div>
  )
}