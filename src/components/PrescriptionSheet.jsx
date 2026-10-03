import { useEffect, useMemo, useState } from 'react'
import { X, Search, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ageFrom, formatDateShort, genderLabel } from '../lib/format'

/**
 * قالب الوصفة الطبية — مطابق للورقة الأصلية (A5) مع شعار العيادة وبياناتها.
 * meds: قائمة الأدوية الحالية (قابلة للتحرير من الواجهة الأم).
 * onMedsChange(list): يُنادى عند أي تعديل ليحفظ الأم مستقبلاً.
 */
export default function PrescriptionSheet({ settings, patient, visit, meds = [], onMedsChange, editable = false }) {
  const [catQuery, setCatQuery] = useState('')
  const [catOpen, setCatOpen] = useState(false)


  // كتالوج الأدوية المشترك (يُجلب مرة واحدة)
  useEffect(() => {
    if (!editable) return
    supabase
      .from('medication_catalog')
      .select('name, dosage, duration, instructions')
      .order('name')
      .then(({ data }) => {
        setCatalog(data || [])
      })
  }, [editable])

  const s = settings || {}
  const clinicName = s?.prescription_clinic_name || s?.clinic?.name || 'عيادة الزهـــراء'
  const subtitle = s?.prescription_subtitle || 'للتسوّق والتجميل  /  ادراة  /أنهر العدنية'
  const tel = s?.prescription_tel || 'Tel: 778134451.737663543.771303636'
  const address = s?.prescription_address || 'تخر  -  مرفق  الصابقة  -  خط  بنى  عمر  -  دبع  الداخل'
  const footer1 = s?.prescription_footer1 || 'يرجى عرض العلاج قبل الاستعمال'
  const footer2 = s?.prescription_footer2 || 'المراجعة المعلنية خلال أسبوع فقط'
  const sideName = s?.prescription_side_name || 'سلمى محمد علام  7778158151'
  const logoUrl = s?.prescription_logo_url || null

  const age = patient?.date_of_birth ? ageFrom(patient.date_of_birth) : ''
  const entries = Object.entries(visit?.specialty_data || {})

  // catalog filtered by search
  const catFiltered = useMemo(() => {
    const q = catQuery.trim()
    if (!q) return catalog.slice(0, 6)
    return catalog.filter((m) => m.name.includes(q)).slice(0, 6)
  }, [catQuery, catalog])

  const addMed = (m) => {
    onMedsChange?.([...meds, { name: m.name, dosage: m.dosage || '', duration: m.duration || '', instructions: m.instructions || '' }])
    setCatQuery('')
    setCatOpen(false)
  }

  const removeMed = (idx) => {
    onMedsChange?.(meds.filter((_, i) => i !== idx))
  }

  const updateMed = (idx, key, value) => {
    onMedsChange?.(meds.map((m, i) => (i === idx ? { ...m, [key]: value } : m)))
  }

  return (
    <div className="prescription-sheet bg-white" style={{ fontFamily: '"Times New Roman", "IBM Plex Sans Arabic", serif' }}>
      {/* ---------- header navy band ---------- */}
      <div className="relative rounded-[14px] px-3 py-2" style={{ background: '#1c4f6e' }}>
        <div className="flex items-center">
          <span className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-4 ring-white/30">
            {logoUrl ? (
              <img src={logoUrl} alt="شعار" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary-800">{(clinicName || 'ع').charAt(0)}</span>
            )}
          </span>
          <div className="min-w-0 flex-1 text-center">
            <p className="whitespace-nowrap text-[26px] font-bold leading-tight tracking-wide text-white" style={{ textShadow: '1px 1px 2px rgba(0,0,0,.3)' }}>
              {clinicName}
            </p>
            <p className="mt-0.5 text-[13px] font-bold leading-snug" style={{ color: '#e8b64c' }}>
              {subtitle}
            </p>
          </div>
          <span className="h-[64px] w-[56px] shrink-0" />
        </div>
      </div>

      {/* ---------- وصفة طبية badge ---------- */}
      <div className="relative z-10 -mt-2.5 mb-1 flex justify-center">
        <span className="inline-flex items-center gap-3 rounded-full px-10 py-0.5 text-[15px] font-bold text-white" style={{ background: '#1c4f6e' }}>
          <span className="h-2.5 w-2.5 -ms-8 rounded-full bg-rose-600 ring-2 ring-white" />
          وصفة  طبية
          <span className="h-2.5 w-2.5 -me-8 rounded-full bg-rose-600 ring-2 ring-white" />
        </span>
      </div>

      {/* ---------- patient info box ---------- */}
      <div className="mx-1 rounded-[10px] border-2 px-4 py-2" style={{ borderColor: '#1c4f6e' }}>
        <div className="space-y-[3px] text-[13.5px] leading-6 text-slate-800">
          <p className="flex items-end gap-1">
            <b>Patient name:</b>
            <span className="min-w-0 flex-1 border-b border-dotted border-slate-400 text-center font-bold">{patient?.full_name || ''}</span>
            <b>: اسم المريض</b>
          </p>
          <p className="flex items-end gap-1">
            <b>the age:</b>
            <span className="w-24 border-b border-dotted border-slate-400 text-center">{age || ''}</span>
            <b>Sex</b>
            <span className="min-w-0 flex-1 border-b border-dotted border-slate-400 text-center">{genderLabel(patient?.gender)}</span>
            <b>: الجنس</b>
            <b className="ps-2">Age:</b>
            <span className="w-16 border-b border-dotted border-slate-400 text-center">{age || ''}</span>
          </p>
          <p className="flex items-end gap-1">
            <b>Diagnosis:</b>
            <span className="min-w-0 flex-1 border-b border-dotted border-slate-400 text-center font-bold">{visit?.diagnosis || ''}</span>
            <b>: التشخيص</b>
          </p>
        </div>
        {entries.length > 0 && (
          <div className="mt-1 border-t border-dashed border-slate-300 pt-1 text-[11.5px] text-slate-600">
            {entries.map(([label, value]) => (
              <span key={label} className="me-3">
                <b>{label}:</b> {String(value)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Rx + watermark ---------- */}
      <div className="relative mx-1 min-h-[300px]">
        {watermarkUrl && (
          <img src={watermarkUrl} alt="" className="pointer-events-none absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 select-none opacity-70" />
        )}
        <p
          className="absolute text-[10px] font-bold text-slate-600"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'left center', left: '-4px', top: '58%' }}
          dir="rtl"
        >
          {sideName}
        </p>

        <p className="pt-2 text-[26px] font-bold italic leading-none text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>
          R<span className="text-[19px]">x</span>
        </p>

        {visit?.chief_complaint && (
          <p className="mt-2 text-[13.5px] text-slate-700">
            <b className="text-slate-500">الشكوى:</b> {visit.chief_complaint}
          </p>
        )}

        {/* searchable medication dropdown (editable mode) */}
        {editable && (
          <div className="relative mt-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={catQuery}
                onChange={(e) => {
                  setCatQuery(e.target.value)
                  setCatOpen(true)
                }}
                onFocus={() => setCatOpen(true)}
                placeholder="اكتب اسم الدواء لإضافته للوصفة..."
                className="input-base pr-9"
              />
            </div>
            {catOpen && catQuery.trim() && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {catFiltered.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-slate-400">لا يوجد دواء مطابق</p>
                ) : (
                  catFiltered.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => addMed(m)}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 text-start text-xs hover:bg-primary-50"
                    >
                      <span className="font-bold text-slate-700">{m.name}</span>
                      <span className="text-slate-400">
                        {[m.dosage, m.duration].filter(Boolean).join(' · ')}
                      </span>
                      <Plus size={13} className="text-primary-600" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* medications on the pad */}
        <div className="mt-4 space-y-3 ps-2">
          {(meds.length ? meds : []).map((m, i) => (
            <div key={i} className="relative text-[15px] leading-6 text-slate-900">
              <b className="text-primary-900">{i + 1}. {m.name}</b>
              {m.dosage ? `  —  ${m.dosage}` : ''}
              {m.duration ? `  —  ${m.duration}` : ''}
              {m.instructions ? <span className="text-slate-600">  —  {m.instructions}</span> : null}
              {editable && (
                <button
                  type="button"
                  onClick={() => removeMed(i)}
                  className="absolute left-0 top-0.5 text-rose-400 hover:text-rose-600 print:hidden"
                  aria-label="إزالة"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {visit?.treatment_plan && (
          <p className="mt-4 text-[13px] text-slate-600">
            <b className="text-slate-500">خطة العلاج:</b> {visit.treatment_plan}
          </p>
        )}

        <div className="absolute bottom-1 left-4">
          <p className="text-[14px] font-bold text-slate-700">
            Signature : <span className="ms-1 inline-block w-36 border-b border-slate-500 align-bottom" />
          </p>
          {doctorName && <p className="mt-0.5 pe-8 text-[12px] font-bold text-slate-600">{doctorName}</p>}
        </div>
      </div>

      {/* ---------- footer notes ---------- */}
      <div className="mx-1 mt-2 flex items-stretch justify-between gap-1.5 text-[11.5px] font-bold">
        <span className="flex-1 rounded-[8px] border border-slate-300 px-2 py-1 text-center text-slate-700">❖ {footer1}</span>
        <span className="flex-1 rounded-[8px] border border-slate-300 px-2 py-1 text-center text-slate-700">❖ {footer2}</span>
      </div>

      {/* ---------- bottom navy band ---------- */}
      <div className="mx-1 mt-1.5 rounded-[10px] px-3 py-1.5 text-center" style={{ background: '#1c4f6e' }}>
        <p className="text-[12.5px] font-semibold text-white">
          {address}
          <span className="mx-2 text-amber-300">⊗</span>
          <b>{tel}</b>
        </p>
      </div>
    </div>
  )
}
