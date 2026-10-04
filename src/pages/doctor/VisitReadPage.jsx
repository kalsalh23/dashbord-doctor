import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowRight, Printer, Pill, FolderOpen, Stethoscope } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, Spinner, Tag } from '../../components/ui'
import { formatDateShort } from '../../lib/format'

/**
 * واجهة قراءة زيارة — يعرض الكشف كاملاً للطبيب لقراءته، مع طباعة الوصفة.
 */
export default function VisitReadPage() {
  const { visitId } = useParams()
  const { profile, settings } = useApp()
  const nav = useNavigate()
  const [data, setData] = useState(undefined)

  useEffect(() => {
    if (!visitId) return
    supabase
      .from('visits')
      .select('*, patient:patients(*), medications(*), doctor:profiles(full_name)')
      .eq('id', visitId)
      .maybeSingle()
      .then(({ data }) => setData(data || null))
  }, [visitId])

  if (data === undefined) return <Spinner label="جارٍ فتح الزيارة..." />
  if (data === null)
    return (
      <EmptyState
        title="الزيارة غير موجودة"
        message="ربما تم حذفها أو الرابط غير صحيح"
        action={<Button onClick={() => nav('/doctor/archive')}>رجوع للأرشيف</Button>}
      />
    )

  const rows = [
    { label: 'الشكوى الرئيسية', value: data.chief_complaint },
    { label: 'الأعراض', value: data.symptoms },
    { label: 'الفحص السريري', value: data.physical_examination },
    { label: 'التشخيص', value: data.diagnosis },
    { label: 'خطة العلاج', value: data.treatment_plan },
    { label: 'ملاحظات طبية', value: data.medical_notes },
  ]
  const entries = Object.entries(data.specialty_data || {})
  const meds = data.medications || []

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={() => nav('/doctor/archive')}>
          <ArrowRight size={14} />
          رجوع للأرشيف
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/patients/${data.patient?.id}`)}>
            <FolderOpen size={14} />
            الملف الكامل
          </Button>
          <Button size="sm" onClick={() => nav(`/print/prescription/${data.id}`)}>
            <Printer size={14} />
            الوصفة الطبية (A5)
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{data.patient?.full_name}</h1>
            <p className="mt-0.5 text-[11px] text-slate-400" dir="ltr">{data.patient?.phone}</p>
          </div>
          <div className="text-end">
            <Tag tone="teal">{formatDateShort(data.visit_date)}</Tag>
            {data.doctor?.full_name && <p className="mt-1 text-[10px] text-slate-400">{data.doctor.full_name}</p>}
          </div>
        </div>

        <div className="space-y-4 pt-4">
          {rows.filter((r) => r.value?.trim()).map((r) => (
            <div key={r.label}>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                <Stethoscope size={12} />
                {r.label}
              </p>
              <p className="whitespace-pre-wrap text-[14px] leading-7 text-slate-700">{r.value}</p>
            </div>
          ))}

          {entries.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-bold text-slate-400">بيانات التخصص</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {entries.map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <b className="text-slate-500">{label}:</b> <span className="font-semibold text-slate-700">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {meds.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                <Pill size={12} />
                الأدوية الموصوفة
              </p>
              <ul className="space-y-1.5">
                {meds.map((m, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 rounded-lg bg-primary-50 px-3 py-2 text-xs">
                    <b className="text-primary-900">{m.name}</b>
                    {m.dosage && <span className="text-slate-600">{m.dosage}</span>}
                    {m.duration && <span className="text-slate-500">· {m.duration}</span>}
                    {m.instructions && <span className="text-slate-500">· {m.instructions}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
