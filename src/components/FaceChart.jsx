import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../lib/store'
import { Button, Modal } from '../components/ui'
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

// مناطق الوجه القابلة للنقر (بالنسبة المئوية من أبعاد الصورة)
const FACE_ZONES = [
  { id: 'forehead', label: 'الجبهة', cx: 50, cy: 28, r: 22 },
  { id: 'eye_l', label: 'العين اليمنى', cx: 35, cy: 42, r: 16 },
  { id: 'eye_r', label: 'ال눈 اليسرى', cx: 65, cy: 42, r: 16 },
  { id: 'nose', label: 'الأنف', cx: 50, cy: 52, r: 14 },
  { id: 'cheek_l', label: 'الخد الأيمن', cx: 30, cy: 62, r: 18 },
  { id: 'cheek_r', label: 'الخد الأيسر', cx: 70, cy: 62, r: 18 },
  { id: 'lip', label: 'الشفاه', cx: 50, cy: 72, r: 14 },
  { id: 'chin', label: 'الذقن', cx: 50, cy: 82, r: 16 },
  { id: 'jaw_l', label: 'الفك الأيمن', cx: 25, cy: 75, r: 16 },
  { id: 'jaw_r', label: 'الفك الأيسر', cx: 75, cy: 75, r: 16 },
  { id: 'neck', label: 'الرقبة', cx: 50, cy: 92, r: 18 },
]

// رسم وجه فتاة واقعي باستخدام SVG (بدون صور خارجية)
function FaceSVG({ points, onPointClick, selectedTreatment }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      className="block mx-auto drop-shadow-lg"
      style={{ background: '#fdf2ec', borderRadius: '50%', overflow: 'hidden', display: 'block' }}
    >
      <defs>
        <radialGradient id="skinGrad" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#fce7e3" />
          <stop offset="100%" stopColor="#e8c3b8" />
        </radialGradient>
        <radialGradient id="lipGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d97786" />
          <stop offset="100%" stopColor="#a83a4a" />
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.25" />
        </filter>
      </defs>

      {/* رقبة */}
      <ellipse cx="50" cy="93" rx="22" ry="14" fill="url(#skinGrad)" />
      {/* وجه */}
      <ellipse cx="50" cy="50" rx="38" ry="48" fill="url(#skinGrad)" filter="url(#shadow)" />
      {/* خط الفك */}
      <path d="M 25 70 Q 20 80 30 90 Q 50 100 70 90 Q 80 80 75 70" fill="none" stroke="#d8b3a8" strokeWidth="2" />

      {/* عيون */}
      <circle cx="35" cy="42" r="6" fill="#222" />
      <circle cx="65" cy="42" r="6" fill="#222" />
      <circle cx="35" cy="41" r="2" fill="#fff" />
      <circle cx="65" cy="41" r="2" fill="#fff" />
      {/* حواجب */}
      <path d="M 28 36 Q 35 33 42 36" fill="none" stroke="#5d4037" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 58 36 Q 65 33 72 36" fill="none" stroke="#5d4037" strokeWidth="2.5" strokeLinecap="round" />

      {/* أنف */}
      <path d="M 50 48 L 46 58 L 54 58 Z" fill="#e8c3b8" stroke="#c9a89d" strokeWidth="1" />
      <circle cx="48" cy="55" r="1.5" fill="#c9a89d" />
      <circle cx="52" cy="55" r="1.5" fill="#c9a89d" />

      {/* شفاه */}
      <path d="M 40 70 Q 50 66 60 70 Q 55 76 45 76 Q 35 76 40 70" fill="url(#lipGrad)" />
      <path d="M 40 70 Q 50 74 60 70" fill="none" stroke="#8a2c3a" strokeWidth="1" strokeLinecap="round" />

      {/* نقاط العلاج المسجلة */}
      {points.map((p, i) => {
        const zone = FACE_ZONES.find((z) => z.id === p.zone)
        const t = TREATMENTS.find((t) => t.key === p.treatment)
        return (
          <g key={i} cursor="pointer" onClick={() => onPointClick(i)}>
            <circle
              cx={zone ? zone.cx : (p.cx ?? 50)}
              cy={zone ? zone.cy : (p.cy ?? 50)}
              r={5}
              fill={t ? t.color : '#64748b'}
              stroke="#fff"
              strokeWidth="2"
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

  // تحميل نقاط الوجه من زيارات المريض السابقة
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

  // حفظ النقاط في التخصص الحالي
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
    // إضافة نقطة علاجه آخر منطقة ضغطة أو Default front
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">كشف الوجه — نقاط العلاج</h3>
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
          الإجمالي: {totalPrice} ر.س
        </span>
      </div>

      {/* صورة الوجه الحقيقية (رسم واقعي) */}
      <div className="mx-auto mb-4 relative w-[280px] h-[360px] sm:w-[320px] sm:h-[420px] max-w-full max-h-[60vh]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-full animate-pulse text-slate-400 text-xs">
            تحميل الوجه...
          </div>
        ) : (
          <>
            <FaceSVG points={points} onPointClick={handleZoneClick} selectedTreatment={selectedTreatment} />
            <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 text-center w-[280px] sm:w-[320px]">
              انقر على منطقة في الوجه لإضافة نقطة علاج
            </p>
          </>
        )}
      </div>

      {/* بطاقات العلاجات أسفل الوجه */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-slate-500 mb-2">اختر العلاج:</p>
        <div className="flex flex-wrap gap-2">
          {TREATMENTS.map((t) => {
            const active = selectedTreatment === t.key
            return (
              <button
                key={t.key}
                onClick={() => setSelectedTreatment(active ? null : t.key)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? `border-${t.key === 'botox' ? 'rose' : t.key === 'filler' ? 'amber' : t.key === 'peeling' ? 'emerald' : t.key === 'laser' ? 'violet' : t.key === 'meso' ? 'cyan' : t.key === 'thread' ? 'pink' : 'slate'}-500 bg-${t.key === 'botox' ? 'rose' : t.key === 'filler' ? 'amber' : t.key === 'peeling' ? 'emerald' : t.key === 'laser' ? 'violet' : t.key === 'meso' ? 'cyan' : t.key === 'thread' ? 'pink' : 'slate'}-500/10 text-${t.key === 'botox' ? 'rose' : t.key === 'filler' ? 'amber' : t.key === 'peeling' ? 'emerald' : t.key === 'laser' ? 'violet' : t.key === 'meso' ? 'cyan' : t.key === 'thread' ? 'pink' : 'slate'}-700`
                    : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: treatmentColor(t.key) }} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* أنواع العلاج المختار وأسعارها */}
      {showTypes && activeTreatment && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4">
          <p className="text-xs font-bold text-slate-600 mb-2">أنواع {activeTreatment.label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeTreatment.types.map((type) => (
              <button
                key={type.key}
                onClick={() => handleTypeSelect(type.key)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  `border-${btnColor(t.key)} bg-white text-slate-700 hover:bg-${btnColor(t.key)}-50 hover:text-${btnColor(t.key)}-700`
                }`}
              >
                <span>{type.label}</span>
                <span className="font-bold text-slate-500">{type.price} ر.س</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowTypes(null)}
            className="mt-2 text-[10px] text-slate-400 underline hover:text-slate-600"
          >
            إغلاق
          </button>
        </div>
      )}

      {activeTreatment && selectedTreatment && showTypes === null && (
        <button
          onClick={() => setShowTypes(selectedTreatment)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800"
        >
          عرض أنواع وأسعار {activeTreatment.label}
        </button>
      )}

      {/* قائمة النقاط المسجلة */}
      {points.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-bold text-slate-500 mb-2">نقاط العلاج المسجلة:</p>
          <ul className="space-y-1">
            {points.map((p, i) => {
              const t = TREATMENTS.find((x) => x.key === p.treatment)
              const subtype = t?.types?.find((x) => x.key === p.subtype)
              const zone = FACE_ZONES.find((z) => z.id === p.zone)
              return (
                <li key={i} className="flex items-center justify-between rounded bg-white px-2.5 py-1.5 text-xs border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t?.color }} />
                    <span className="text-slate-600">{t?.label}</span>
                    {subtype && <span className="ml-1 text-[9px] text-slate-400">({subtype.label})</span>}
                    <span className="ml-2 text-[9px] font-bold text-slate-400">{zone?.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600">{subtype?.price ?? 0} ر.س</span>
                  <button
                    onClick={() => setPoints((prev) => prev.filter((_, j) => j !== i))}
                    className="ml-2 text-[10px] text-rose-500 hover:text-rose-700"
                    title="حذف"
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[10px] font-bold text-slate-700 border-t border-slate-200 pt-2">
            المجموع: <span className="text-emerald-600">{totalPrice} ر.س</span>
          </p>
        </div>
      )}
    </div>
  )
}

function btnColor(key) {
  return key === 'botox' ? 'rose' : key === 'filler' ? 'amber' : key === 'peeling' ? 'emerald' : key === 'laser' ? 'violet' : key === 'meso' ? 'cyan' : key === 'thread' ? 'pink' : 'slate'
}
