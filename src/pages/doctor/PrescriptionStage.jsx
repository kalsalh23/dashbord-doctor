import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer, Save, Check, ArrowRight, Repeat } from 'lucide-react'
import { useApp } from '../../lib/store'
import { Button, Card } from '../../components/ui'
import PrescriptionSheet from '../../components/PrescriptionSheet'

/** مرحلة المعاينة داخل الكشف — القالب معبأ، مع الحفظ والطباعة ثم المتابعة */
export default function PrescriptionStage({ visit, onContinue }) {
  const { profile, settings } = useApp()
  const [printed, setPrinted] = useState(false)
  const nav = useNavigate()

  const print = () => {
    setPrinted(true)
    setTimeout(() => window.print(), 100)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card title="معاينة — الوصفة الطبية" subtitle="القالب الجاهز للمريض — يُطبع لصرفه من الصيدلية">
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

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 print:hidden">
          <Button variant="secondary" onClick={() => nav(`/print/prescription/${visit.id}`)}>
            <Printer size={15} />
            صفحة الطباعة الكاملة
          </Button>
          <Button variant="success" onClick={print}>
            {printed ? <Check size={15} /> : <Printer size={15} />}
            حفظ وطباعة
          </Button>
          <Button onClick={onContinue}>
            <Repeat size={15} />
            متابعة بعد الكشف
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400 print:hidden">
          الزيارة محفوظة تلقائياً في أرشيف المريض — تجدها في «أرشيف المرضى» مع إمكانية طباعتها لاحقاً.
        </p>
      </Card>
    </div>
  )
}
