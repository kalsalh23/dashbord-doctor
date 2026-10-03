import { SmilePlus, Stethoscope } from 'lucide-react'
import { ageFrom, formatDateShort, genderLabel } from '../lib/format'

/**
 * قالب الوصفة الطبية — printable prescription sheet.
 * Pure presentational: renders exactly what a clinic prescription looks like.
 * props: { clinic, settings, patient, visit, meds, doctorName }
 */
export default function PrescriptionSheet({ clinic, settings, patient, visit, meds = [], doctorName }) {
  const name = clinic?.name || 'العيادة'
  const spec = clinic?.specialty || ''
  const age = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : ''
  const entries = Object.entries(visit?.specialty_data || {})

  return (
    <div
      dir="rtl"
      className="prescription-sheet mx-auto w-full max-w-[820px] bg-white p-5 shadow-lg"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}
    >
      {/* header band */}
      <div className="overflow-hidden rounded-lg" style={{ background: '#1d4e6b' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/40">
            <SmilePlus size={26} className="text-white/90" />
          </span>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-2xl font-bold tracking-wide text-white">{name}</p>
            {spec && <p className="mt-0.5 text-sm font-semibold text-amber-300">{spec}</p>}
          </div>
          <span className="h-14 w-14 shrink-0" />
        </div>
      </div>

      {/* وصفة طبية badge */}
      <div className="relative -mt-3 mb-2 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-slate-700 bg-white px-8 py-1 text-lg font-bold text-slate-800">
          <span className="h-2 w-2 rounded-full bg-rose-600" />
          وصفة طبية
          <span className="h-2 w-2 rounded-full bg-rose-600" />
        </span>
      </div>

      {/* patient info box */}
      <div className="rounded-lg border-2 border-slate-700 px-4 py-3">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[15px] leading-7">
          <span className="font-bold text-slate-800">اسم المريض:</span>
          <span className="border-b border-dotted border-slate-400 font-semibold text-slate-800">
            {patient?.full_name || '........................'}
          </span>

          <span className="font-bold text-slate-800">العمر:</span>
          <span className="border-b border-dotted border-slate-400 text-slate-700">
            {age ? `${age} سنة` : '..............'}
          </span>

          <span className="font-bold text-slate-800">الجنس:</span>
          <span className="border-b border-dotted border-slate-400 text-slate-700">
            {genderLabel(patient?.gender)}
          </span>

          <span className="font-bold text-slate-800">التاريخ:</span>
          <span className="border-b border-dotted border-slate-400 text-slate-700">
            {visit?.visit_date ? formatDateShort(visit.visit_date) : '..............'}
          </span>

          <span className="font-bold text-slate-800">التشخيص:</span>
          <span className="border-b border-dotted border-slate-400 text-slate-700">
            {visit?.diagnosis || '........................'}
          </span>
        </div>

        {/* specialty data line (if any) */}
        {entries.length > 0 && (
          <div className="mt-2 border-t border-dashed border-slate-300 pt-2 text-[13px] text-slate-600">
            {entries.map(([label, value]) => (
              <span key={label} className="me-4">
                <b className="text-slate-700">{label}:</b> {String(value)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Rx section */}
      <div className="relative mt-4 min-h-[430px] overflow-hidden rounded-lg border-2 border-slate-700 p-6">
        <p className="absolute left-6 top-3 text-4xl font-bold italic text-slate-800">Rx</p>

        {/* watermark */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07]">
          <div className="flex flex-col items-center">
            <span className="text-[120px] leading-none">🦷</span>
            <Stethoscope size={90} className="text-slate-400" strokeWidth={1} />
          </div>
        </div>

        {/* complaint + treatment quick lines */}
        {visit?.chief_complaint && (
          <p className="mb-3 text-[14px] text-slate-700">
            <b className="text-slate-500">الشكوى:</b> {visit.chief_complaint}
          </p>
        )}
        {visit?.treatment_plan && (
          <p className="mb-4 text-[14px] text-slate-700">
            <b className="text-slate-500">خطة العلاج:</b> {visit.treatment_plan}
          </p>
        )}

        {/* medications */}
        <div className="relative space-y-3">
          {meds.length === 0 ? (
            <p className="text-[13px] text-slate-300">— لا توجد أدوية مدوّنة —</p>
          ) : (
            meds.map((m, i) => (
              <div key={i} className="text-[15px] leading-6 text-slate-800">
                <b className="text-primary-800">{i + 1}. {m.name}</b>
                {m.dosage ? ` — ${m.dosage}` : ''}
                {m.duration ? ` — ${m.duration}` : ''}
                {m.instructions ? <span className="text-slate-500"> — {m.instructions}</span> : null}
              </div>
            ))
          )}
        </div>

        {/* signature */}
        <div className="absolute bottom-3 left-6 text-[14px] text-slate-600">
          <span className="font-bold">Signature:</span>
          <span className="ms-2 inline-block w-40 border-b border-slate-400 align-bottom" />
          {doctorName && <span className="ms-2 text-[13px] font-bold text-slate-700">{doctorName}</span>}
        </div>
      </div>

      {/* footer notes */}
      <div className="mt-2 flex items-stretch justify-between gap-2 text-[12px] font-semibold">
        <span className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-700">
          ❖ {settings?.prescription_footer1 || 'يرجى عرض العلاج قبل الاستعمال'}
        </span>
        <span className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-slate-700">
          ❖ {settings?.prescription_footer2 || 'المراجعة المعلنية خلال أسبوع فقط'}
        </span>
      </div>

      {/* bottom band: address + phones */}
      <div className="mt-2 overflow-hidden rounded-lg" style={{ background: '#1d4e6b' }}>
        <p className="px-4 py-2.5 text-center text-[13px] font-semibold text-white">
          {[settings && settings.address, settings?.phone ? `Tel: ${settings.phone}` : ''].filter(Boolean).join('   ⊗   ') || name}
        </p>
      </div>
    </div>
  )
}
