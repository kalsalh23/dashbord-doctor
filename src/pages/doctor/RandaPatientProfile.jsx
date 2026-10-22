import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Calendar, ChevronDown, FileText, HeartPulse, Pill, Stethoscope, TriangleAlert,
  Activity,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, Spinner } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import { ageFrom, formatDateShort, todayStr } from '../../lib/format'
import {
  glucoseLabel, hba1cLabel, bmiOf, bmiLabel, bpLabel, endocrineAlerts, endocrineRiskLevel,
} from '../../lib/endocrine'

/**
 * ملف المريض في عيادة الغدد والسكري — تصميم مستقل:
 *   بطاقة السكر (آخر قراءة، HbA1c، BMI، الضغط، الخطورة)
 *   تنبيهات مضاعفات السكري
 *   خط زمني للزيارات مع قياسات السكر والوزن والضغط
 */
export default function RandaPatientProfile() {
  const { id } = useParams()
  const { profile, effectiveRole } = useApp()
  const nav = useNavigate()
  const isDoctor = effectiveRole === 'doctor'
  const listPath = isDoctor ? '/doctor/patients' : '/reception/patients'

  const [patient, setPatient] = useState(null)
  const [visits, setVisits] = useState(null)
  const [medInfo, setMedInfo] = useState(null)
  const [payments, setPayments] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [openVisit, setOpenVisit] = useState(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile?.clinic_id || !id) return
    setLoading(true)
    const [pRes, vRes, mRes, payRes, fRes] = await Promise.all([
      supabase.from('patients').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('visits')
        .select('*, medications(*), doctor:profiles(full_name)')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false })
        .limit(60),
      supabase.from('medical_information').select('*').eq('patient_id', id).maybeSingle(),
      supabase
        .from('payments')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('follow_up_requests')
        .select('*')
        .eq('patient_id', id)
        .order('suggested_date', { ascending: false })
        .limit(20),
    ])
    setPatient(pRes.data || null)
    setVisits(vRes.data || [])
    setMedInfo(mRes.data || null)
    setPayments(payRes.data || [])
    setFollowUps(fRes.data || [])
    setLoading(false)
  }, [id, profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  /* آخر كشف سكري — منه تُشتق قيم السكر والوزن */
  const en = useMemo(() => {
    for (const v of visits || []) {
      if (v.specialty_data?.endocrine) return { ...v.specialty_data.endocrine, _visit: v }
    }
    return null
  }, [visits])

  const glucose = Number(en?.blood_glucose || 0)
  const hba1c = Number(en?.hba1c || 0)
  const bmi = bmiOf(en?.weight, en?.height)
  const gLabel = glucoseLabel(glucose) || null
  const hLabel = hba1cLabel(hba1c) || null
  const bLabel = bmiLabel(bmi) || null
  const bpLabelRes = bpLabel(en?.blood_pressure) || null
  const risk = en ? endocrineRiskLevel(en) : null
  const alerts = en ? endocrineAlerts(en) : []

  if (loading) return <Spinner />
  if (!patient) return <EmptyState title="لم يتم العثور على المريض" />

  return (
    <div className="mx-auto max-w-5xl">
      {/* ===== الترويسة ===== */}
      <div className="mb-4 px-4 py-5 sm:px-6">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-black text-white sm:text-xl">
              <Activity size={20} />
              ملف المريض
            </h1>
            <p className="mt-1 text-xs text-white/80">
              {patient.full_name} · {patient.date_of_birth ? `${ageFrom(patient.date_of_birth)} سنة` : '—'} ·
              <span dir="ltr">{patient.phone}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setBookOpen(true)} className="!bg-white !text-primary-800 hover:!bg-primary-50">
              <Calendar size={15} />
              حجز موعد
            </Button>
            {isDoctor && (
              <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/consultation/new/${patient.id}`)}>
                <Stethoscope size={15} />
                كشف جديد
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ===== بطاقة السكر ===== */}
      <Card title="مقياس السكر" subtitle="آخر قراءة من آخر كشف سكري">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className={`rounded-xl p-3 ${gLabel ? `bg-${gLabel.cls}-50 border border-${gLabel.cls}-200` : 'bg-slate-50 border border-slate-200'}`}>
            <p className="text-[10px] font-bold text-slate-400">سكر الدم</p>
            <p className="text-xs font-extrabold text-slate-800" dir="ltr">{glucose || '—'} مجم/دل</p>
            {gLabel && <p className="mt-0.5 text-[10px] font-bold text-slate-700">{gLabel.label}</p>}
          </div>
          <div className={`rounded-xl p-3 ${hLabel ? `bg-${hLabel.cls}-50 border border-${hLabel.cls}-200` : 'bg-slate-50 border border-slate-200'}`}>
            <p className="text-[10px] font-bold text-slate-400">HbA1c</p>
            <p className="text-xs font-extrabold text-slate-800" dir="ltr">{hba1c || '—'}%</p>
            {hLabel && <p className="mt-0.5 text-[10px] font-bold text-slate-700">{hLabel.label}</p>}
          </div>
          <div className={`rounded-xl p-3 ${bLabel ? `bg-${bLabel.cls}-50 border border-${bLabel.cls}-200` : 'bg-slate-50 border border-slate-200'}`}>
            <p className="text-[10px] font-bold text-slate-400">كتلة الجسم BMI</p>
            <p className="text-xs font-extrabold text-slate-800" dir="ltr">{bmi || '—'}</p>
            {bLabel && <p className="mt-0.5 text-[10px] font-bold text-slate-700">{bLabel.label}</p>}
          </div>
          <div className={`rounded-xl p-3 ${bpLabelRes ? `bg-${bpLabelRes.cls}-50 border border-${bpLabelRes.cls}-200` : 'bg-slate-50 border border-slate-200'}`}>
            <p className="text-[10px] font-bold text-slate-400">ضغط الدم</p>
            <p className="text-xs font-extrabold text-slate-800" dir="ltr">{en?.blood_pressure || '—'}</p>
            {bpLabelRes && <p className="mt-0.5 text-[10px] font-bold text-slate-700">{bpLabelRes.label}</p>}
          </div>
        </div>
        <div className="mt-3 rounded-xl p-3 bg-slate-50 border border-slate-100">
          <p className="text-xs font-bold text-slate-700">مستوى الخطورة</p>
          <p className={`text-xs font-extrabold mt-0.5 ${risk ? `text-${risk.cls}-700` : 'text-slate-700'}`}>
            {risk ? risk.label : '—'}
          </p>
        </div>
      </Card>

      {/* ===== تنبيهات مضاعفات السكري ===== */}
      {alerts.length > 0 && (
        <Card title="تنبيهات تحتاج انتباهاً">
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={a.key + i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed ${a.tone === 'rose' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                <p className="text-start">{a.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ===== سجل الزيارات ===== */}
      <Card title="سجل زيارات السكر" subtitle="آخر القراءات من كل زيارة">
        {(visits || []).length === 0 ? (
          <EmptyState icon={Activity} title="لا توجد زيارات مسجلة" message="ابدئي بتسجيل كشف للمريض" />
        ) : (
          <div className="space-y-2.5">
            {(visits || []).map((v) => {
              const sd = v.specialty_data?.endocrine
              if (!sd) return null
              const g = Number(sd.blood_glucose)
              const gl = glucoseLabel(g)
              return (
                <div key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-primary-50 cursor-pointer" onClick={() => setOpenVisit(v.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Activity size={13} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{formatDateShort(v.visit_date)}</p>
                      <p className="text-[10px] text-slate-500">د. {v.doctor?.full_name || ''}</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    {gl && (
                      <span className={`font-bold text-slate-800 ${gl.cls === 'rose' ? 'text-rose-700' : gl.cls === 'amber' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {g} مجم/دل
                      </span>
                    )}
                  </div>
                  <ChevronDown size={13} className="text-slate-400 shrink-0" />
                </div>
              )
            })}
          </div>
        )}
        {openVisit && (
          <div className="mt-3 rounded-xl p-3 border border-primary-100 bg-primary-50">
            <p className="text-xs font-bold text-primary-800 mb-1">تفاصيل الزيارة</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
              <p><span className="font-bold">التشخيص:</span> {(openVisit.specialty_data?.endocrine || {}).diagnosis || '—'}</p>
              <p><span className="font-bold">الخطة العلاجية:</span> {openVisit.treatment_plan || '—'}</p>
              <p><span className="font-bold">السكر:</span> {(openVisit.specialty_data?.endocrine || {}).blood_glucose || '—'} مجم/دل</p>
              <p><span className="font-bold">HbA1c:</span> {(openVisit.specialty_data?.endocrine || {}).hba1c || '—'}%</p>
              <p><span className="font-bold">الوزن:</span> {(openVisit.specialty_data?.endocrine || {}).weight || '—'} كغ</p>
              <p><span className="font-bold">الضغط:</span> {(openVisit.specialty_data?.endocrine || {}).blood_pressure || '—'}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setOpenVisit(null)} className="mt-2">إغلاق</Button>
          </div>
        )}
      </Card>

      {/* ===== المتابعات ===== */}
      <Card title="متابعات مريض" subtitle="مواعيد المراجعة القادمة">
        {(followUps || []).length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">لا توجد متابعات مستحقة</p>
        ) : (
          <ul className="space-y-2">
            {(followUps || []).map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => nav(`${listPath}/${patient.id}`)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-start hover:bg-primary-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-slate-700">مراجعة السكر</span>
                    <span className="block text-[10px] text-slate-400">
                      {f.suggested_date ? formatDateShort(f.suggested_date) : 'بلا تاريخ'} · الحالة: {f.status}
                    </span>
                  </span>
                  <Calendar size={14} className="shrink-0 text-primary-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <BookingModal open={bookOpen} onClose={() => setBookOpen(false)} presetPatient={{ id: patient.id, full_name: patient.full_name, phone: patient.phone }} onBooked={() => load()} />
    </div>
  )
}
