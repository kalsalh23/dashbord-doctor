import { formatDateShort } from '../lib/format'
/**
 * قالب الوصفة الطبية الخاص بـ د. نزار عبدالستار الشيخ — نسخة مطابقة للورقة الأصلية (A5).
 * الديناميكي: اسم المريض، العمر، التاريخ، التشخيص، الأدوية.
 */
export default function NizarSheet({ patient, visit, meds = [], doctorName, qr = '/nizar-qr.png', watermark = '/nizar-watermark.png' }) {
  const age = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : ''
  const entries = Object.entries(visit?.specialty_data || {})

  // سطور المنطقة المكتوبة: التشخيص ثم الأدوية ثم الملاحظات
  const written = []
  if (visit?.diagnosis?.trim()) written.push('التشخيص: ' + visit.diagnosis.trim())
  meds.forEach((m) => {
    written.push(
      [m.name, m.dosage, m.duration, m.instructions].filter(Boolean).join(' — ')
    )
  })
  if (visit?.treatment_plan?.trim()) written.push('العلاج: ' + visit.treatment_plan.trim())
  if (visit?.medical_notes?.trim()) written.push('ملاحظات: ' + visit.medical_notes.trim())
  if (visit?.chief_complaint?.trim()) written.unshift('الشكوى: ' + visit.chief_complaint.trim())

  const totalLines = 14
  const lineRows = Array.from({ length: totalLines }, (_, i) => written[i] || '')

  return (
    <div className="prescription-sheet relative overflow-hidden bg-white" style={{ fontFamily: '"IBM Plex Sans Arabic", serif' }}>
      {/* faint spine pattern on the right edge */}
      <img src={watermark} alt="" className="pointer-events-none absolute -right-4 top-0 h-full opacity-25" style={{ transform: 'scaleX(-1)' }} />

      {/* ---------- header ---------- */}
      <div className="relative px-4 pt-3 text-center">
        <img src="/nizar-logo.png" alt="شعار العيادة" className="mx-auto h-[88px] w-auto" />
        <p className="mt-1 text-[24px] font-bold leading-tight" style={{ color: '#1e3a5f' }}>
          د.نزار عبدالستار الشيخ
        </p>
        <p className="mt-1 text-[14px] font-bold" style={{ color: '#a8811f' }}>
          اختصاصي الجراحة العصبية وجراحة العمود الفقري
        </p>
        <p className="mt-0.5 text-[11.5px] text-slate-600">خبيرة جراحية متقدمة مدعومة بأحدث التقنيات المغورية</p>

        {/* services row */}
        <div className="mt-2.5 flex items-center justify-center gap-2 text-[9.5px] font-semibold text-slate-600">
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5">
            <span className="text-[11px]" style={{ color: '#a8811f' }}>🧠</span>
            معالجة أورام الدماغ
            <br />
            وأورام الحبل الشوكي
          </span>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5">
            <span className="text-[11px]" style={{ color: '#a8811f' }}>🦴</span>
            ثقب الفقرات واستئصال
            <br />
            الديسك المخوري
          </span>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5">
            <span className="text-[11px]" style={{ color: '#a8811f' }}>🧠</span>
            جراحة الأعصاب
            <br />
            المحيطية
          </span>
        </div>
      </div>

      {/* ---------- sheet frame ---------- */}
      <div className="relative mx-3 mt-2 rounded-[14px] border border-slate-300 px-4 pb-3 pt-2">
        {/* وصفة طبية badge — top right */}
        <span
          className="absolute -top-3 right-6 inline-flex items-center gap-2 rounded-full px-6 py-1 text-[13px] font-bold text-white"
          style={{ background: '#1e3a5f' }}
        >
          <span className="text-[11px]" style={{ color: '#a8811f' }}>📝</span>
          وصفة  طبية
        </span>

        {/* patient rows */}
        <div className="mt-3 space-y-2.5 text-[13.5px] text-slate-800">
          <p className="flex items-end justify-start gap-1" dir="rtl">
            <b>اسم المريض :</b>
            <span className="min-w-0 flex-1 border-b border-dotted border-slate-400 text-center font-semibold">{patient?.full_name || ''}</span>
          </p>
          <p className="flex items-end justify-between gap-2">
            <span>
              <b>العمر:</b>
              <span className="ms-1 border-b border-dotted border-slate-400 px-6 text-center">{age || '....'}</span>
              <b className="ms-1">سنة</b>
            </span>
            <span>
              <b>التاريخ:</b>
              <span className="ms-1 border-b border-dotted border-slate-400 px-2 text-center" dir="ltr">{formatDateShort(visit?.visit_date) || '__ / __ / __'}</span>
            </span>
          </p>
        </div>

        {/* lined writing area with watermark */}
        <div className="relative mt-2">
          <img src={watermark} alt="" className="pointer-events-none absolute left-1/2 top-1/2 w-[52%] -translate-x-1/2 -translate-y-1/2 opacity-30 select-none" />
          <div className="relative space-y-[26px] py-2">
            {lineRows.map((line, i) => (
              <p key={i} className="min-h-[16px] border-b border-dotted border-slate-300 pb-1 text-[13px] leading-5 text-slate-800">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* QR + signature */}
        <div className="relative mt-1 flex items-end justify-between px-1 pb-1">
          <img src={qr} alt="QR" className="h-[74px] w-[74px]" />
          <div className="text-end">
            <p className="text-[13px] font-bold text-slate-700">توقيع الطبيب وختم العيادة</p>
            <span className="mt-1 inline-block w-44 border-b border-slate-500" />
            {doctorName && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{doctorName}</p>}
          </div>
        </div>
      </div>

      {/* ---------- footer navy band ---------- */}
      <div className="relative mx-1 mt-1.5 overflow-hidden rounded-[12px] px-3 py-2.5" style={{ background: '#1e3a5f' }}>
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px]" style={{ color: '#e8b64c' }}>📍</span>
            <span>
              دمشق - مقابل مشفى الشام العسكري
              <br />
              حماه - مشفى الحوراني
            </span>
          </span>
          <span className="text-center">
            <span className="block text-[13px] font-bold" style={{ color: '#e8b64c' }} dir="ltr">0969168667</span>
            حماه
            <span className="mx-1">|</span>
            <span className="block text-[13px] font-bold" style={{ color: '#e8b64c' }} dir="ltr">0988934861</span>
            دمشق
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[15px]" style={{ color: '#e8b64c' }}>🏥</span>
            للحجز والاستفسار
          </span>
        </div>
      </div>
    </div>
  )
}
