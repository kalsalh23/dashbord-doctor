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

function FaceImage({ points, onPointClick }) {
  return (
    <div
      className="relative block mx-auto max-w-[260px] sm:max-w-[320px] aspect-square max-h-[55vh] drop-shadow-md"
      style={{
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#fdf2ec',
      }}
    >
      <img
        src="/image.jpg"
        alt="وجه فتاة حقيقية للكشف"
        className="block w-full h-full object-cover"
        style={{ borderRadius: '50%' }}
      />
      {/* مناطق الضغط القابلة للنقر — مبنية على النسبة المئوية من أبعاد الصورة */}
      {FACE_ZONES.map((zone) => (
        <button
          key={zone.id}
          type="button"
          onClick={() => onPointClick(zone.id)}
          className="absolute rounded-full border-2 border-white shadow-sm transition-transform active:scale-90"
          style={{
            left: `${zone.cx - zone.r / 2}%`,
            top: `${zone.cy - zone.r / 2}%`,
            width: `${zone.r}%`,
            height: `${zone.r}%`,
          }}
          aria-label={zone.label}
        />
      ))}
      {/* نقاط العلاج المسجلة */}
      {points.map((p, i) => {
        const zone = FACE_ZONES.find((z) => z.id === p.zone)
        const t = TREATMENTS.find((t) => t.key === p.treatment)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPointClick(i)}
            className="absolute rounded-full border-2 border-white shadow-sm transition-transform active:scale-90"
            style={{
              left: `${(zone ? zone.cx : (p.cx ?? 50)) - 3}%`,
              top: `${(zone ? zone.cy : (p.cy ?? 50)) - 3}%`,
              width: '6%',
              height: '6%',
              backgroundColor: t ? t.color : '#64748b',
            }}
            title={t?.label || 'أخرى'}
            aria-label={`نقطة علاج: ${t?.label || 'أخرى'} — ${zone?.label || 'غير محدد'}`}
          />
        )
      })}
    </div>
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
            <FaceImage points={points} onPointClick={handleZoneClick} />
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
