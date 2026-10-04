import { formatDateShort } from '../lib/format'

/**
 * قالب الوصفة الطبية — د.نزار عبدالستار الشيخ
 * نسخة مطابقة تماماً للورقة الأصلية (A5) — ديناميكي: اسم المريض، العمر، التاريخ، المحتوى المكتوب.
 */
export default function NizarSheet({ patient, visit, meds = [], doctorName, qr = '/nizar-qr.png', logo = '/nizar-logo.png' }) {
  const age = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : ''
  const entries = Object.entries(visit?.specialty_data || {})

  // سطور المنطقة المكتوبة: التشخيص ثم الأدوية ثم الملاحظات
  const written = []
  if (visit?.chief_complaint?.trim()) written.push('الشكوى: ' + visit.chief_complaint.trim())
  if (visit?.diagnosis?.trim()) written.push('التشخيص: ' + visit.diagnosis.trim())
  meds.forEach((m) => {
    written.push([m.name, m.dosage, m.duration, m.instructions].filter(Boolean).join(' — '))
  })
  if (visit?.treatment_plan?.trim()) written.push('العلاج: ' + visit.treatment_plan.trim())
  if (visit?.medical_notes?.trim()) written.push('ملاحظات: ' + visit.medical_notes.trim())

  const totalLines = 14
  const lineRows = Array.from({ length: totalLines }, (_, i) => written[i] || '')

  return (
    <div className="prescription-sheet relative overflow-hidden bg-white" style={{ fontFamily: '"IBM Plex Sans Arabic", serif' }}>
      {/* ---------- header: logo centered, name below ---------- */}
      <div className="relative px-4 pt-2 text-center">
        <img src={logo} alt="شعار العيادة" className="mx-auto h-[92px] w-auto" />
        <p className="mt-1 text-[27px] font-bold leading-tight" style={{ color: '#1e3a5f' }}>
          د.نزار عبدالستار الشيخ
        </p>
        <p className="mt-1 text-[15px] font-bold" style={{ color: '#a8811f' }}>
          اختصاصي الجراحة العصبية وجراحة العمود الفقري
        </p>
        <p className="mt-0.5 text-[12px] text-slate-600">خبيرة جراحية متقدمة مدعومة بأحدث التقنيات المغورية</p>

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
              الديسك المخوري
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

      {/* ---------- sheet frame ---------- */}
      <div className="relative mx-4 mt-3 rounded-[16px] border border-slate-300 px-5 pb-3 pt-4">
        {/* وصفة طبية badge — attached top-right */}
        <span
          className="absolute -top-3.5 right-4 inline-flex items-center gap-2 rounded-l-xl rounded-br-xl px-7 py-1.5 text-[14px] font-bold text-white shadow-sm"
          style={{ background: '#1e3a5f' }}
        >
          وصفة طبية
          <span className="text-[13px]" style={{ color: '#e8b64c' }}>📝</span>
        </span>

        {/* patient rows */}
        <div className="mt-4 space-y-3 text-[13.5px] text-slate-800">
          <p className="flex items-end gap-1">
            <b>اسم المريض :</b>
            <span className="min-w-0 flex-1 border-b border-dotted border-slate-400 text-center font-semibold">{patient?.full_name || ''}</span>
          </p>
          <p className="flex items-end justify-between gap-3">
            <span>
              <b>العمر:</b>
              <span className="ms-1 inline-block w-20 border-b border-dotted border-slate-400 text-center">{age || '....'}</span>
              <b className="ms-1">سنة</b>
            </span>
            <span>
              <b>التاريخ:</b>
              <span className="ms-1 inline-block w-32 border-b border-dotted border-slate-400 text-center" dir="ltr">
                {visit?.visit_date ? formatDateShort(visit.visit_date) : '__ / __ / __'}
              </span>
            </span>
          </p>
        </div>

        {/* lined writing area */}
        <div className="relative mt-3">
          <div className="relative space-y-[30px] py-3">
            {lineRows.map((line, i) => (
              <p key={i} className="min-h-[16px] border-b border-dotted border-slate-300 pb-1.5 text-[13px] leading-5 text-slate-800">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* QR (left, original size) + signature (right) */}
        <div className="relative mt-2 flex items-end justify-between px-2 pb-2">
          <img src={qr} alt="QR" className="h-[104px] w-[104px]" />
          <div className="text-end">
            <p className="text-[14px] font-bold text-slate-700">توقيع الطبيب وختم العيادة</p>
            <span className="mt-2 inline-block w-48 border-b border-slate-500" />
            {doctorName && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{doctorName}</p>}
          </div>
        </div>
      </div>

      {/* ---------- footer navy band ---------- */}
      <div className="relative mx-1 mt-2 overflow-hidden rounded-t-[16px] border-t-2 px-4 py-3" style={{ background: '#1e3a5f', borderTopColor: '#e8b64c' }}>
        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-white">
          {/* right: booking */}
          <span className="flex items-center gap-2">
            <span className="text-[17px]" style={{ color: '#e8b64c' }}>📞</span>
            للحجز والاستفسار
          </span>
          {/* center: phones */}
          <span className="flex items-center gap-1.5 text-center leading-tight">
            <span style={{ color: '#e8b64c' }}>☎</span>
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
