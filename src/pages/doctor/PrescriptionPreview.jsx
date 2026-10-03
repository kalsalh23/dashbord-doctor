import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, Save, Check, FileSearch } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, Select, PageHeader, SkeletonRows } from '../../components/ui'
import PrescriptionSheet from '../../components/PrescriptionSheet'
import { formatDateShort } from '../../lib/format'

/**
 * واجهة معاينة مستقلة: تختار زيارة من الأرشيف فيظهر قالب الوصفة الطبية معبأً — للطباعة.
 */
export default function PrescriptionPreview() {
  const { profile, settings, toast } = useApp()
  const [visits, setVisits] = useState(null)
  const [selected, setSelected] = useState(null)
  const [printed, setPrinted] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('visits')
      .select('id, visit_date, chief_complaint, diagnosis, treatment_plan, specialty_data, patient:patients(id, full_name), doctor:profiles(full_name), medications(*)')
      .eq('clinic_id', profile.clinic_id)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
    setVisits(data || [])
    if (data?.length) setSelected(data[0].id)
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const visit = useMemo(() => (visits || []).find((v) => v.id === selected) || null, [visits, selected])

  const print = () => {
    setPrinted(true)
    setTimeout(() => window.print(), 100)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="معاينة" subtitle="قالب الوصفة الطبية — معبأ من الكشف المختار، جاهز للطباعة" />

      <Card bodyClass="!p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <p className="label-base">اختر الزيارة</p>
            {visits === null ? (
              <SkeletonRows rows={1} />
            ) : visits.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد زيارات بعد — أكمل كشفاً أولاً</p>
            ) : (
              <Select value={selected || ''} onChange={(e) => setSelected(e.target.value)}>
                {visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patient?.full_name} — {formatDateShort(v.visit_date)} — {v.diagnosis || v.chief_complaint || 'كشف'}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {visit && (
            <Button onClick={print} className="print:hidden">
              {printed ? <Check size={15} /> : <Printer size={15} />}
              حفظ وطباعة
            </Button>
          )}
        </div>
      </Card>

      <div className="mt-4">
        {visits !== null && !visit ? (
          <Card>
            <EmptyState icon={FileSearch} title="لا توجد زيارات بعد" message="أنهِ كشفاً أولاً وستظهر معاينته هنا" />
          </Card>
        ) : visit ? (
          <div className="print-area overflow-x-auto">
            <PrescriptionSheet
              clinic={profile?.clinic}
              settings={settings}
              patient={visit.patient}
              visit={visit}
              meds={visit.medications || []}
              doctorName={visit.doctor?.full_name || profile?.full_name}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
