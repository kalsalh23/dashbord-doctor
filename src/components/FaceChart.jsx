import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/store'
import { Button } from '../components/ui'
import { isFatimaClinic } from '../lib/clinicStyle'

const TREATMENTS = [
  { key: 'botox', label: 'بوتوكس', color: '#ef4444', types: [
    { key: 'botox_front', label: 'جبهة', price: 150 },
    { key: 'botox_eye', label: 'حول العينين', price: 200 },
    { key: 'botox_brow', label: 'بين الحواجب', price: 180 },
  ]},
  { key: 'filler', label: 'فلير', color: '#f59e0b', types: [
    { key: 'filler_lip', label: 'شفاه', price: 250 },
    { key: 'filler_cheek', label: 'خدود', price: 300 },
    { key: 'filler_nose', label: 'أنف', price: 280 },
  ]},
  { key: 'peeling', label: 'تقشير', color: '#10b981', types: [
    { key: 'peeling_face', label: 'وجه كامل', price: 120 },
    { key: 'peeling_neck', label: 'رقبة', price: 100 },
  ]},
  { key: 'laser', label: 'ليزر', color: '#8b5cf6', types: [
    { key: 'laser_spot', label: 'بقع', price: 200 },
    { key: 'laser_hair', label: 'إزالة شعر', price: 180 },
  ]},
  { key: 'meso', label: 'ميزوثيرابي', color: '#06b6d4', types: [
    { key: 'meso_face', label: 'وجه', price: 160 },
    { key: 'meso_neck', label: 'رقبة', price: 140 },
  ]},
  { key: 'thread', label: 'خيوط', color: '#ec4899', types: [
    { key: 'thread_cheek', label: 'خدود', price: 400 },
    { key: 'thread_jaw', label: 'فك', price: 450 },
  ]},
  { key: 'other', label: 'أخرى', color: '#64748b', types: [
    { key: 'other_custom', label: 'أخرى', price: 0 },
  ]},
]

function treatmentColor(key) {
  const t = TREATMENTS.find((t) => t.key === key)
  return t ? t.color : '#64748b'
}

const FACE_ZONES = [
  { id: 'forehead', label: 'الجبهة', cx: 50, cy: 28, r: 22 },
  { id: 'eye_l', label: 'العين اليمنى', cx: 35, cy: 42, r: 16 },
  { id: 'eye_r', label: 'العين اليسرى', cx: 65, cy: 42, r: 16 },
  { id: 'nose', label: 'الأنف', cx: 50, cy: 52, r: 14 },
  { id: 'cheek_l', label: 'الخد الأيمن', cx: 30, cy: 62, r: 18 },
  { id: 'cheek_r', label: 'الخد الأيسر', cx: 70, cy: 62, r: 18 },
  { id: 'lip', label: 'الشفاه', cx: 50, cy: 72, r: 14 },
  { id: 'chin', label: 'الذقن', cx: 50, cy: 82, r: 16 },
  { id: 'jaw_l', label: 'الفك الأيمن', cx: 25, cy: 75, r: 16 },
  { id: 'jaw_r', label: 'الفك الأيسر', cx: 75, cy: 75, r: 16 },
  { id: 'neck', label: 'الرقبة', cx: 50, cy: 92, r: 18 },
]

function FaceSVG({ points, onPointClick }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className="block mx-auto drop-shadow-md"
      style={{
        background:
          'radial-gradient(circle at 40% 40%, #ffe8dd 0%, #fce7e3 35%, #e8c3b8 100%)',
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'block',
      }}
    >
      <defs>
        <filter id="faceShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-opacity="0.2" />
        </filter>
        <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <radialGradient id="skinGrad" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#ffe8dd" />
          <stop offset="40%" stopColor="#fce7e3" />
          <stop offset="100%" stopColor="#e8c3b8" />
        </radialGradient>
        <radialGradient id="lipGrad" cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#e98a99" />
          <stop offset="100%" stopColor="#a83a4a" />
        </radialGradient>
        <radialGradient id="cheekGrad" cx="40%" cy="65%" r="40%">
          <stop offset="0%" stopColor="#ffb7b7" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2d1b10" />
          <stop offset="100%" stopColor="#4a2d1a" />
        </linearGradient>
      </defs>

      {/* شعر حول الوجه */}
      <path
        d="M 15 30 Q 25 15 45 12 Q 55 10 65 15 Q 75 10 85 18 Q 90 25 95 38 Q 95 52 90 68 Q 85 82 70 90 Q 55 92 40 90 Q 25 82 15 68 Q 10 52 15 38 Q 15 30 15 30"
        fill="url(#hairGrad)"
        filter="url(#softBlur)"
      />
      {/* خصلات شعر على الجوانب */}
      <path d="M 15 35 Q 5 45 12 60 Q 15 70 18 80" fill="none" stroke="#2d1b10" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <path d="M 85 35 Q 95 45 88 60 Q 85 70 82 80" fill="none" stroke="#2d1b10" strokeWidth="3" strokeLinecap="round" opacity="0.6" />

      {/* رقبة */}
      <ellipse cx="50" cy="94" rx="24" ry="15" fill="url(#skinGrad)" filter="url(#faceShadow)" />
      <path d="M 28 70 Q 30 82 40 92 Q 60 92 70 82 Q 72 70 72 70 Z" fill="url(#skinGrad)" filter="url(#faceShadow)" />

      {/* وجه بيضاوي واقعي */}
      <ellipse cx="50" cy="50" rx="40" ry="50" fill="url(#skinGrad)" filter="url(#faceShadow)" />

      {/* خدود وردية */}
      <ellipse cx="30" cy="64" rx="10" ry="7" fill="url(#cheekGrad)" filter="url(#softBlur)" />
      <ellipse cx="70" cy="64" rx="10" ry="7" fill="url(#cheekGrad)" filter="url(#softBlur)" />

      {/* عيون مع رموش */}
      <g filter="url(#faceShadow)">
        {/* العين اليمنى */}
        <ellipse cx="34" cy="41" rx="6.5" ry="4" fill="#fff" />
        <ellipse cx="34" cy="41" rx="3.5" ry="2.5" fill="#3b2a2a" />
        <circle cx="34.5" cy="40.5" r="1" fill="#fff" />
        <path d="M 29 39 Q 34 35 39 39" fill="none" stroke="#222" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        <path d="M 30 42 Q 34 44 38 42" fill="none" stroke="#222" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        {/* العين اليسرى */}
        <ellipse cx="66" cy="41" rx="6.5" ry="4" fill="#fff" />
        <ellipse cx="66" cy="41" rx="3.5" ry="2.5" fill="#3b2a2a" />
        <circle cx="66.5" cy="40.5" r="1" fill="#fff" />
        <path d="M 61 39 Q 66 35 71 39" fill="none" stroke="#222" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        <path d="M 62 42 Q 66 44 70 42" fill="none" stroke="#222" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      </g>

      {/* حواجب دقيقة */}
      <path d="M 28 35 Q 35 31 42 35" fill="none" stroke="#4a2d1a" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <path d="M 58 35 Q 65 31 72 35" fill="none" stroke="#4a2d1a" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

      {/* أنف أنثوي دقيق */}
      <path d="M 48 49 Q 50 45 52 49 Q 52 55 48 55 Z" fill="#e8c3b8" stroke="#d1a594" strokeWidth="1" opacity="0.9" />
      <circle cx="50" cy="52" r="1.8" fill="#c9a89d" />
      <path d="M 48 55 Q 50 57 52 55" fill="none" stroke="#d1a594" strokeWidth="1" opacity="0.6" />

      {/* شفاه ممتلئة */}
      <path d="M 38 68 Q 50 64 62 68 Q 58 76 42 76 Q 32 76 38 68 Z" fill="url(#lipGrad)" filter="url(#faceShadow)" />
      <path d="M 38 68 Q 50 73 62 68" fill="none" stroke="#7a2b36" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 45 66 Q 50 70 55 66" fill="none" stroke="#c95a66" strokeWidth="1" opacity="0.7" />

      {/* ذقن مدبب أنثوي */}
      <path d="M 42 82 Q 50 90 58 82" fill="none" stroke="#d8b3a8" strokeWidth="1.5" opacity="0.7" />

      {/* نقاط العلاج المسجلة */}
      {points.map((p, i) => {
        const zone = FACE_ZONES.find((z) => z.id === p.zone)
        const t = TREATMENTS.find((t) => t.key === p.treatment)
        return (
          <g key={i} style={{ cursor: 'pointer' }} onClick={() => onPointClick(i)}>
            <circle
              cx={zone ? zone.cx : (p.cx ?? 50)}
              cy={zone ? zone.cy : (p.cy ?? 50)}
              r={5}
              fill={t ? t.color : '#64748b'}
              stroke="#fff"
              strokeWidth="2.5"
            />
            <title>{t?.label || 'أخرى'} — {zone?.label || 'غير محدد'}</title>
          </g>
        )
      })}
    </svg>
  )
}

export default function FaceChart({ patientId, onChange }) {
  const { profile, toast } = useApp()
  const [points, setPoints] = useState([])
  const [selectedTreatment, setSelectedTreatment] = useState(null)
  const [showTypes, setShowTypes] = useState(null)
  const [loading, setLoading] = useState(true)
  const isFatima = isFatimaClinic(profile)

  useEffect(() => {
    if (!patientId || !isFatima) return
    const init = async () => {
      setLoading(true)
      try {
        const { data: visits } = await supabase
          .from('visits')
          .select('visit_date, specialty_data')
          .eq('patient_id', patientId)
          .order('visit_date', { ascending: true })
        const allPoints = []
        for (const v of visits || []) {
          const sd = v.specialty_data || {}
          if (sd.face_points && Array.isArray(sd.face_points)) {
            for (const p of sd.face_points) {
              allPoints.push({ ...p, visit_date: v.visit_date })
            }
          }
        }
        setPoints(allPoints)
      } catch (e) {
        toast('error', 'تعذر تحميل نقاط العلاج السابقة')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [patientId, isFatima, toast])

  useEffect(() => {
    if (!onChange) return
    onChange({ face_points: points })
  }, [points, onChange])

  const totalPrice = useMemo(() => {
    return points.reduce((sum, p) => {
      const t = TREATMENTS.find((t) => t.key === p.treatment)
      const subtype = t?.types?.find((x) => x.key === p.subtype)
      return sum + (subtype ? subtype.price : 0)
    }, 0)
  }, [points])

  const handleZoneClick = (zoneId) => {
    if (!selectedTreatment) {
      toast('error', 'يرجى اختيار نوع العلاج أولاً')
      return
    }
    const t = TREATMENTS.find((t) => t.key === selectedTreatment)
    const point = {
      zone: zoneId,
      treatment: selectedTreatment,
      subtype: null,
      price: 0,
      created_at: new Date().toISOString(),
    }
    setPoints((prev) => [...prev, point])
  }

  const handleTypeSelect = (subtypeKey) => {
    const t = TREATMENTS.find((t) => t.key === selectedTreatment)
    const subtype = t?.types?.find((x) => x.key === subtypeKey)
    const lastZone = points.length > 0 ? points[points.length - 1].zone : 'forehead'
    setPoints((prev) => [
      ...prev,
      {
        zone: lastZone,
        treatment: selectedTreatment,
        subtype: subtypeKey,
        price: subtype ? subtype.price : 0,
        created_at: new Date().toISOString(),
      },
    ])
    setShowTypes(null)
  }

  if (!isFatima) return null

  const activeTreatment = TREATMENTS.find((t) => t.key === selectedTreatment)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-card w-full max-w-full">
      <div className="mb-3 flex flex-col sm:flex-row items-center sm:justify-between gap-2">
        <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-none">كشف الوجه — نقاط العلاج</h3>
        <span className="text-xs sm:text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded whitespace-nowrap">
          الإجمالي: {totalPrice} ر.س
        </span>
      </div>

      {/* صورة الوجه الحقيقية (رسم واقعي) - متجاوبة مع الجوال */}
      <div className="mx-auto mb-4 relative w-full max-w-[260px] sm:max-w-[320px] aspect-[0.75] max-h-[55vh]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 rounded-full animate-pulse text-slate-400 text-[10px] sm:text-xs p-2">
            <span>تحميل الوجه...</span>
          </div>
        ) : (
          <>
            <FaceSVG points={points} onPointClick={handleZoneClick} />
            <p className="absolute -bottom-6 left-0 right-0 text-center text-[10px] sm:text-xs text-slate-400 leading-tight px-2">
              انقر على منطقة في الوجه لإضافة نقطة علاج
            </p>
          </>
        )}
      </div>

      {/* بطاقات العلاجات أسفل الوجه */}
      <div className="mb-3">
        <p className="text-[10px] sm:text-xs font-bold text-slate-500 mb-2 whitespace-nowrap">اختر العلاج:</p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
          {TREATMENTS.map((t) => {
            const active = selectedTreatment === t.key
            return (
              <button
                key={t.key}
                onClick={() => setSelectedTreatment(active ? null : t.key)}
                className={`flex items-center gap-1 rounded-lg border border-slate-200 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold transition-colors ${
                  active
                    ? `border-${t.key === 'botox' ? 'rose' : t.key === 'filler' ? 'amber' : t.key === 'peeling' ? 'emerald' : t.key === 'laser' ? 'violet' : t.key === 'meso' ? 'cyan' : t.key === 'thread' ? 'pink' : 'slate'}-500 bg-${t.key === 'botox' ? 'rose' : t.key === 'filler' ? 'amber' : t.key === 'peeling' ? 'emerald' : t.key === 'laser' ? 'violet' : t.key === 'meso' ? 'cyan' : t.key === 'thread' ? 'pink' : 'slate'}-500/10 text-${t.key === 'botox' ? 'rose' : t.key === 'filler' ? 'amber' : t.key === 'peeling' ? 'emerald' : t.key === 'laser' ? 'violet' : t.key === 'meso' ? 'cyan' : t.key === 'thread' ? 'pink' : 'slate'}-700`
                    : 'text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex h-2.5 sm:h-3 w-2.5 sm:w-3 rounded-full shrink-0" style={{ backgroundColor: treatmentColor(t.key) }} />
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* أنواع العلاج المختار وأسعارها */}
      {showTypes && activeTreatment && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3 mb-3">
          <p className="text-[10px] sm:text-xs font-bold text-slate-600 mb-2 whitespace-normal">أنواع {activeTreatment.label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
            {activeTreatment.types.map((type) => (
              <button
                key={type.key}
                onClick={() => handleTypeSelect(type.key)}
                className={`flex items-center justify-between rounded-lg border border-slate-200 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900`}
              >
                <span className="whitespace-normal">{type.label}</span>
                <span className="font-bold text-slate-500 whitespace-nowrap">{type.price} ر.س</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowTypes(null)}
            className="mt-2 text-[10px] sm:text-xs text-slate-400 underline hover:text-slate-600"
          >
            إغلاق
          </button>
        </div>
      )}

      {activeTreatment && selectedTreatment && showTypes === null && (
        <button
          onClick={() => setShowTypes(selectedTreatment)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 whitespace-normal"
        >
          عرض أنواع وأسعار {activeTreatment.label}
        </button>
      )}

      {/* قائمة النقاط المسجلة */}
      {points.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 mb-2 whitespace-normal">نقاط العلاج المسجلة:</p>
          <ul className="space-y-1">
            {points.map((p, i) => {
              const t = TREATMENTS.find((x) => x.key === p.treatment)
              const subtype = t?.types?.find((x) => x.key === p.subtype)
              const zone = FACE_ZONES.find((z) => z.id === p.zone)
              return (
                <li key={i} className="flex items-center justify-between rounded bg-white px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shrink-0" style={{ backgroundColor: t?.color }} />
                    <span className="text-xs sm:text-sm text-slate-600 truncate">{t?.label}</span>
                    {subtype && <span className="ml-1 text-[9px] sm:text-xs text-slate-400 truncate">({subtype.label})</span>}
                    <span className="ml-1 text-[9px] sm:text-xs font-bold text-slate-400 truncate">{zone?.label}</span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-600 whitespace-nowrap">{subtype?.price ?? 0} ر.س</span>
                  <button
                    onClick={() => setPoints((prev) => prev.filter((_, j) => j !== i))}
                    className="ml-1 text-[10px] sm:text-xs text-rose-500 hover:text-rose-700 shrink-0"
                    title="حذف"
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[10px] sm:text-xs font-bold text-slate-700 border-t border-slate-200 pt-2">
            المجموع: <span className="text-emerald-600 whitespace-nowrap">{totalPrice} ر.س</span>
          </p>
        </div>
      )}
    </div>
  )
}

function btnColor(key) {
  return key === 'botox' ? 'rose' : key === 'filler' ? 'amber' : key === 'peeling' ? 'emerald' : key === 'laser' ? 'violet' : key === 'meso' ? 'cyan' : key === 'thread' ? 'pink' : 'slate'
}
