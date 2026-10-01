import { useEffect, useState } from 'react'
import { History, Pill } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Modal, Spinner, Tag, EmptyState } from './ui'
import { formatDateShort } from '../lib/format'

/**
 * Quick view of a patient's most recent visit — lets the doctor review the
 * previous consultation with one tap before starting a new one.
 */
export default function LastVisitModal({ open, onClose, patient }) {
  const [visit, setVisit] = useState(undefined) // undefined = loading, null = none

  useEffect(() => {
    if (!open || !patient?.id) return
    let alive = true
    setVisit(undefined)
    supabase
      .from('visits')
      .select('*, doctor:profiles(full_name), medications(*)')
      .eq('patient_id', patient.id)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setVisit(data || null)
      })
    return () => {
      alive = false
    }
  }, [open, patient?.id])

  const rows = visit
    ? [
        { label: 'الشكوى الرئيسية', value: visit.chief_complaint },
        { label: 'الأعراض', value: visit.symptoms },
        { label: 'الفحص السريري', value: visit.physical_examination },
        { label: 'التشخيص', value: visit.diagnosis },
        { label: 'خطة العلاج', value: visit.treatment_plan },
        { label: 'ملاحظات طبية', value: visit.medical_notes },
      ].filter((r) => r.value?.trim())
    : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="آخر زيارة"
      subtitle={patient?.full_name}
    >
      {visit === undefined ? (
        <Spinner label="جارٍ جلب آخر زيارة..." />
      ) : visit === null ? (
        <EmptyState
          icon={History}
          title="لا توجد زيارات سابقة"
          message="هذا أول كشف للمريض — سجل زياراته سيظهر هنا في المرات القادمة"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">
              {formatDateShort(visit.visit_date)}
              {visit.doctor?.full_name && <span className="ms-2 text-xs font-medium text-slate-400">{visit.doctor.full_name}</span>}
            </p>
            <Tag tone="teal">آخر زيارة</Tag>
          </div>

          {rows.map((r) => (
            <div key={r.label}>
              <p className="mb-0.5 text-[11px] font-bold text-slate-400">{r.label}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{r.value}</p>
            </div>
          ))}

          {(visit.medications || []).length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-slate-400">الأدوية الموصوفة</p>
              <ul className="space-y-1.5">
                {visit.medications.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1 font-bold text-slate-700">
                      <Pill size={12} className="text-primary-600" />
                      {m.name}
                    </span>
                    {m.dosage && <span className="text-slate-500">{m.dosage}</span>}
                    {m.duration && <span className="text-slate-400">· {m.duration}</span>}
                    {m.instructions && <span className="text-slate-400">· {m.instructions}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
