import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, Save, Check, FileSearch, Trash2, Pill } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, Select, PageHeader, SkeletonRows } from '../../components/ui'
import PrescriptionSheet from '../../components/PrescriptionSheet'
import { usePrintIsolation } from '../../lib/print'
import { formatDateShort } from '../../lib/format'

/**
 * واجهة معاينة مستقلة: تختار زيارة من الأرشيف فيظهر قالب الوصفة الطبية معبأً —
 * مع قائمة أدوية قابلة للبحث تُضاف للوصفة مباشرة، وحفظ وطباعة.
 */
export default function PrescriptionPreview() {
  const { profile, settings, toast } = useApp()
  const [visits, setVisits] = useState(null)
  const [selected, setSelected] = useState(null)
  const [meds, setMeds] = useState(null) // editable copy of the selected visit's meds
  const [printed, setPrinted] = useState(false)
  const [savingMeds, setSavingMeds] = useState(false)
  const [medsDirty, setMedsDirty] = useState(false)
  usePrintIsolation()

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
    if (data?.length) setSelected((cur) => cur || data[0].id)
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  // reset the editable meds when switching visits
  useEffect(() => {
    if (!selected || !visits) return
    const v = visits.find((v) => v.id === selected)
    setMeds(v ? (v.medications || []).map((m) => ({ ...m })) : [])
    setMedsDirty(false)
  }, [selected, visits])

  const visit = useMemo(() => (visits || []).find((v) => v.id === selected) || null, [visits, selected])

  const saveMeds = async () => {
    if (!visit) return
    setSavingMeds(true)
    // replace the visit's medications with the current list
    const { error: delErr } = await supabase.from('medications').delete().eq('visit_id', visit.id)
    let error = delErr
    if (!error && meds.length) {
      const ins = await supabase.from('medications').insert(
        meds.map((m) => ({
          clinic_id: profile.clinic_id,
          visit_id: visit.id,
          patient_id: visit.patient?.id,
          name: m.name,
          dosage: m.dosage || null,
          duration: m.duration || null,
          instructions: m.instructions || null,
        }))
      )
      error = ins.error
    }
    setSavingMeds(false)
    if (error) return toast('error', 'تعذر حفظ الأدوية: ' + error.message)
    setMedsDirty(false)
    toast('success', 'تم حفظ أدوية الوصفة')
    load()
  }

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
              settings={settings}
              patient={visit.patient}
              visit={visit}
              meds={meds || []}
              doctorName={visit.doctor?.full_name || profile?.full_name}
              editable
              onMedsChange={(list) => {
                setMeds(list)
                setMedsDirty(true)
              }}
            />

            {/* med save bar */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
              <p className="text-[11px] text-slate-400">
                {medsDirty ? 'توجد تغييرات غير محفوظة على أدوية الوصفة' : 'الأدوية محفوظة — اضغط على أي دواء القائمة أعلاه لإضافته'}
              </p>
              <Button size="sm" onClick={saveMeds} loading={savingMeds} disabled={!medsDirty}>
                <Save size={14} />
                حفظ أدوية الوصفة
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
