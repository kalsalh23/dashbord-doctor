import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowRight, Printer, Save, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../lib/store'
import { Button, Spinner, EmptyState } from '../../components/ui'
import PrescriptionSheet from '../../components/PrescriptionSheet'

/**
 * واجهة المعاينة — قالب الوصفة الطبية معبأ تلقائياً من الكشف المحفوظ.
 * Bare printable page (no app chrome) — window.print() prints the sheet only.
 */
export default function PrescriptionPage() {
  const { visitId } = useParams()
  const { profile, settings, toast } = useApp()
  const nav = useNavigate()
  const [data, setData] = useState(undefined) // undefined loading / null missing
  const [savedMark, setSavedMark] = useState(false)

  useEffect(() => {
    document.title = 'معاينة — وصفة طبية'
    if (!visitId) return
    supabase
      .from('visits')
      .select('*, patient:patients(*), medications(*), doctor:profiles(full_name)')
      .eq('id', visitId)
      .maybeSingle()
      .then(({ data }) => setData(data || null))
  }, [visitId])

  const saveMark = async () => {
    setSavedMark(true)
  }

  if (data === undefined) return <Spinner label="جارٍ تجهيز المعاينة..." />
  if (data === null)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <EmptyState title="الزيارة غير موجودة" message="ربما تم حذفها أو الرابط غير صحيح" />
      </div>
    )

  return (
    <div className="min-h-screen bg-slate-200 py-4 print:bg-white print:p-0">
      {/* toolbar (hidden when printing) */}
      <div className="mx-auto mb-3 flex max-w-[820px] flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="secondary" size="sm" onClick={() => nav(-1)}>
          <ArrowRight size={14} />
          رجوع
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={savedMark ? 'success' : 'secondary'} onClick={saveMark} disabled={savedMark}>
            {savedMark ? <Check size={14} /> : <Save size={14} />}
            {savedMark ? 'محفوظ في أرشيف المريض' : 'حفظ في أرشيف المريض'}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer size={14} />
            حفظ وطباعة
          </Button>
        </div>
      </div>

      <div className="print-area">
      <PrescriptionSheet
        clinic={profile?.clinic}
        settings={settings}
        patient={data.patient}
        visit={data}
        meds={data.medications || []}
        doctorName={data.doctor?.full_name || profile?.full_name}
      />
      </div>

      <p className="mx-auto mt-3 max-w-[820px] text-center text-[11px] text-slate-400 print:hidden">
        الزيارة محفوظة في أرشيف المريض تلقائياً — زر الطباعة يطبع هذا القالب جاهزاً للمريض.
      </p>
    </div>
  )
}
