import { ageFrom, formatDateShort } from '../lib/format'

/**
 * قالب الوصفة الطبية — د.نزار عبدالستار الشيخ
 * نسخة مطابقة تماماً للورقة الأصلية (A5) — ديناميكي: اسم المريض، العمر، التاريخ، المحتوى المكتوب.
 */
export default function NizarSheet({ patient, visit, meds = [], doctorName, qr = '/nizar-qr.png', logo = '/nizar-logo.png', topValues = null, onTopEdit = null, dateValue = null, onDateEdit = null, medEntrySlot = null, onDeleteMed = null, paperImage = '/por.jpg' }) {
  const age = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : ''
  const entries = Object.entries(visit?.specialty_data || {})

  // سطور المنطقة المكتوبة: الأدوية ثم خطة العلاج والملاحظات (الاسم والعمر والتشخيص في الأعلى)
  const written = []
  meds.forEach((m) => {
    written.push([m.name, m.dosage, m.duration, m.instructions].filter(Boolean).join(' — '))
  })
  if (visit?.treatment_plan?.trim()) written.push('العلاج: ' + visit.treatment_plan.trim())
  if (visit?.medical_notes?.trim()) written.push('ملاحظات: ' + visit.medical_notes.trim())

  const totalLines = 14
  const lineRows = Array.from({ length: totalLines }, (_, i) => written[i] || '')
  // الورقة ثابتة الحجم: سطور الأدوية لا تتجاوز أسطر الورقة الأصلية مهما أُضيف —
  // الباقي يُحفظ في أرشيف المريض ويظهر كاملاً في المعاينة والأرشفة
  const maxMedLines = totalLines - (medEntrySlot ? 1 : 0)
  const shownMeds = meds.slice(0, maxMedLines)

return (
    // عمود مرن: المحتوى يتمدد بمقداره والتذييل يبقى ملتصقاً بأسفل الورقة
    // خلفية الورقة (por.jpg) تغطي كل الورقة من Header إلى التذييل — لا يظهر أبيض underneath
    <div
      className="prescription-sheet relative flex flex-col overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${paperImage})`, fontFamily: '"IBM Plex Sans Arabic", serif' }}
    >
      {/* ---------- header: logo centered, name below ---------- */}
      <div className="relative shrink-0 px-4 pt-2 text-center">
        <img src={logo} alt="شعار العيادة" className="mx-auto h-[74px] w-auto" />
        <p className="mt-1 text-[27px] font-bold leading-tight" style={{ color: '#1e3a5f' }}>
          د.نزار عبدالستار الشيخ
        </p>
        <p className="mt-1 text-[15px] font-bold" style={{ color: '#a8811f' }}>
          اختصاصي الجراحة العصبية وجراحة العمود الفقري
        </p>
        <p className="mt-0.5 text-[12px] text-slate-600">خبرة جراحية متقدمة مدعومة بأحدث التقنيات المغورية</p>

        {/* services row */}
        <div className="mx-auto mt-3 flex w-fit items-center justify-center gap-3 text-[9.5px] font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px]" style={{ color: '#a8811f' }}>🧠</span>
            <span className="text-start leading-[1.3]">
              معالجة أورام الدماغ
              <br />
              وأورام الحبل الشوكي
            </span>
          </span>
          <span className="h-7 w-px bg-slate-200" />
          <span className="flex items-center gap-1.5">
            <span className="text-[13px]" style={{ color: '#a8811f' }}>🦴</span>
            <span className="text-start leading-[1.3]">
              ثقب الفقرات واستئصال
              <br />
              الديسك مجهريا
            </span>
          </span>
          <span className="h-7 w-px bg-slate-200" />
          <span className="flex items-center gap-1.5">
            <span className="text-[13px]" style={{ color: '#a8811f' }}>🧠</span>
            <span className="text-start leading-[1.3]">
              جراحة الأعصاب
              <br />
              المحيطية
            </span>
          </span>
        </div>
      </div>

      {/* ---------- sheet frame: ورقة المعاينة الأصلية (H5) -------- */}
      <div
        className="relative mx-4 mt-3 flex min-h-0 flex-1 flex-col rounded-[16px] border border-slate-300 px-5 pb-3 pt-4 bg-transparent"
      >
        {/* وصفة طبية badge — attached top-right */}
        <span
          className="absolute -top-3.5 right-4 inline-flex items-center gap-2 rounded-l-xl rounded-br-xl px-7 py-1.5 text-[14px] font-bold text-white shadow-sm"
          style={{ background: '#1e3a5f' }}
        >
          وصفة طبية
          <span className="text-[13px]" style={{ color: '#e8b64c' }}>📝</span>
        </span>

        {/* patient rows — الاسم والعمر والتشخيص على خط واحد (قابل للكتابة المباشرة في الوضع الحي) */}
        <div className="mt-4 space-y-3 text-[13.5px] text-slate-800">
          <p className="flex items-end gap-2">
            <b>اسم المريض :</b>
            <span className="min-w-0 flex-1 border-b border-dotted border-slate-400 text-center font-semibold">
              {onTopEdit ? (
                <input
                  value={topValues?.name ?? patient?.full_name ?? ''}
                  onChange={(e) => onTopEdit('name', e.target.value)}
                  className="w-full bg-transparent text-center font-semibold outline-none placeholder:text-slate-300"
                  placeholder="اسم المريض"
                />
              ) : (
                patient?.full_name || ''
              )}
            </span>
            <b className="ms-1">العمر:</b>
            <span className="inline-block w-14 border-b border-dotted border-slate-400 text-center">
              {onTopEdit ? (
                <input
                  dir="ltr"
                  value={topValues?.age ?? ''}
                  onChange={(e) => onTopEdit('age', e.target.value)}
                  className="w-full bg-transparent text-center outline-none placeholder:text-slate-300"
                  placeholder="...."
                />
              ) : (
                age || '....'
              )}
            </span>
            <b className="ms-1">التشخيص:</b>
            <span className="min-w-0 flex-1 border-b border-dotted border-slate-400 text-center">
              {onTopEdit ? (
                <input
                  value={topValues?.diagnosis ?? ''}
                  onChange={(e) => onTopEdit('diagnosis', e.target.value)}
                  className="w-full bg-transparent text-center outline-none placeholder:text-slate-300"
                  placeholder="اكتب التشخيص هنا"
                />
              ) : (
                visit?.diagnosis || ''
              )}
            </span>
          </p>

          {/* سطر التاريخ — تلقائي حسب اليوم وقابل للتعديل اليدوي */}
          <p className="flex items-end gap-2">
            <b>التاريخ:</b>
            <span className="inline-block w-44 border-b border-dotted border-slate-400 text-center">
              {onDateEdit ? (
                <input
                  dir="ltr"
                  value={dateValue ?? ''}
                  onChange={(e) => onDateEdit(e.target.value)}
                  className="w-full bg-transparent text-center outline-none"
                />
              ) : (
                visit?.visit_date ? formatDateShort(visit.visit_date) : ''
              )}
            </span>
          </p>
        </div>

        {/* lined writing area — أسطر تتوزّع داخل ما يتبقى من الورقة (صفحة واحدة دائماً) */}
        <div className="relative mt-3 flex min-h-0 flex-1 flex-col">
          <div className="nizar-lines relative flex min-h-0 flex-1 flex-col overflow-hidden py-3">
            {/* أسطر الأدوية المضافة — بسطور الورقة نفسها (حجم ثابت) مع منع التمدد */}
            {shownMeds.map((m, i) => {
              const line = [m.name, m.dosage, m.duration, m.instructions].filter(Boolean).join(' — ')
              return (
              <p key={i} className="nizar-line flex min-h-[18px] flex-1 flex-col justify-end overflow-hidden border-b border-dotted border-slate-300 pb-1 text-[13px] leading-5 text-slate-800" title={line}>
                {onDeleteMed ? (
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{line}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteMed(meds.indexOf(m))}
                      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-600 print:hidden"
                      aria-label="حذف الدواء"
                    >
                      حذف ✕
                    </button>
                  </span>
                ) : (
                  line
                )}
              </p>
              )
            })}
            {/* سطر كتابة الدواء — في السطر الثالث مباشرة بعد الأدوية، بعلامة صغيرة للإشارة */}
            {medEntrySlot && (
              <p className="nizar-line flex min-h-[18px] flex-1 flex-col justify-end border-b border-dotted border-slate-300 pb-1 text-[13px] leading-5 text-slate-800">
                {medEntrySlot}
              </p>
            )}
            {/* باقي الأسطر الفارغة */}
            {lineRows.slice(shownMeds.length + (medEntrySlot ? 1 : 0)).map((line, i) => (
              <p key={'e' + i} className="nizar-line flex min-h-[18px] flex-1 flex-col justify-end border-b border-dotted border-slate-300 pb-1 text-[13px] leading-5 text-slate-800">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* QR بحجمه الطبيعي الثابت (126×147 بلا تحجيم أو تمديد) + التوقيع يميناً */}
        <div className="nizar-qr-row relative mt-2 flex shrink-0 items-end justify-between px-2 pb-2">
          <img src={qr} alt="QR" width={126} height={147} className="nizar-qr block max-w-none" />
          <div className="text-end">
            <p className="text-[14px] font-bold text-slate-700">توقيع الطبيب وختم العيادة</p>
            <span className="mt-2 inline-block w-48 border-b border-slate-500" />
            {doctorName && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{doctorName}</p>}
          </div>
        </div>
      </div>

      {/* ---------- footer navy band ---------- */}
      <div className="relative mx-1 mt-2 shrink-0 overflow-hidden rounded-t-[16px] border-t-2 px-4 py-3" style={{ background: '#1e3a5f', borderTopColor: '#e8b64c' }}>
        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-white">
          {/* right: booking */}
          <span className="flex items-center gap-2">
            <span className="text-[17px]" style={{ color: '#e8b64c' }}>📞</span>
            للحجز والاستفسار
          </span>
          {/* center: phones */}
          <span className="flex items-center gap-1.5 text-center leading-tight">
            <span style={{ color: '#e8b64c' }}>�?�</span>
            <span>
              دمشق
              <br />
              <b dir="ltr" className="text-[13px]">0969168667</b>
            </span>
            <span className="mx-1 h-6 w-px bg-white/30" />
            <span>
              حماه
              <br />
              <b dir="ltr" className="text-[13px]">0988934861</b>
            </span>
          </span>
          {/* left: address */}
          <span className="flex items-center gap-2 text-start leading-tight">
            <span className="text-[17px]" style={{ color: '#e8b64c' }}>📍</span>
            <span>
              دمشق - مقابل مشفى الشام العسكري
              <br />
              حماه - مشفى الحوراني
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
