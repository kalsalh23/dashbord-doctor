import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Baby, CalendarHeart, ChevronDown, FileText, HeartPulse, Pill, Stethoscope, TriangleAlert,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, Spinner } from '../../components/ui'
import BookingModal from '../../components/BookingModal'
import SketchCanvas from '../../components/SketchCanvas'
import { ageFrom, formatDateShort, todayStr } from '../../lib/format'
import {
  bmiLabel, bmiOf, eddFromLmp, gaLabel, gestationalAge, gpaLabel,
  obgynAlerts, pregnancyStatus, riskLevel,
} from '../../lib/obgyn'

/**
 * ملف المريضة في عيادة النساء والتوليد — تصميم مستقل:
 *   بطاقة الحمل (أسبوع الحمل، الولادة المتوقعة، الفصيلة، الخطورة)
 *   سجل الحمول السابقة
 *   خط زمني للزيارات مع نتائج المخطط والرسم اليدوي
 */
export default function ObgynPatientProfile() {
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

  /* آخر كشف نساء وتوليد — منه تُشتق حالة الحمل */
  const ob = useMemo(() => {
    for (const v of visits || []) {
      if (v.specialty_data?.obgyn) return { ...v.specialty_data.obgyn, _visit: v }
    }
    return null
  }, [visits])

  const ga = useMemo(() => gestationalAge(ob?.lmp), [ob?.lmp])
  const edd = useMemo(() => eddFromLmp(ob?.lmp), [ob?.lmp])
  const bmi = useMemo(() => bmiOf(ob?.weight, ob?.height), [ob?.weight, ob?.height])
  const status = useMemo(() => pregnancyStatus(ob || {}), [ob])
  const alerts = useMemo(() => obgynAlerts({ ...ob, gestational_age: ga }), [ob, ga])
  const risk = useMemo(() => riskLevel({ ...ob, gestational_age: ga }), [ob, ga])
  const pregnancies = ob?._visit?.specialty_data?.pregnancies || []

  if (loading) return <Spinner />
  if (!patient) {
    return (
      <Card>
        <EmptyState icon={FileText} title="لم يتم العثور على المريضة" action={<Button onClick={() => nav(listPath)}>رجوع</Button>} />
      </Card>
    )
  }

  const age = patient.date_of_birth ? ageFrom(patient.date_of_birth) : null

  return (
    <div className="mx-auto max-w-4xl">
      {/* ===== ترويسة المريضة ===== */}
      <div className="ob-hero mb-4 px-4 py-5 sm:px-6">
        <div className="relative z-10">
          <h1 className="truncate text-lg font-black text-white sm:text-xl">{patient.full_name}</h1>
          <p className="mt-1 text-xs text-white/80">
            {age != null ? `${age} سنة · ` : ''}
            <span dir="ltr">{patient.phone}</span>
            {patient.address ? ` · ${patient.address}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isDoctor && (
              <Button size="sm" onClick={() => nav(`/doctor/consultation/new/${patient.id}`)} className="!bg-white !text-primary-800 hover:!bg-primary-50">
                <Stethoscope size={15} />
                كشف جديد
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20"
              onClick={() => setBookOpen(true)}
            >
              <CalendarHeart size={15} />
              حجز متابعة
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20"
              onClick={() => nav(listPath)}
            >
              رجوع
            </Button>
          </div>
        </div>
      </div>

      {/* ===== بطاقة الحمل ===== */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="ob-card !rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-400">حالة الحمل</p>
          <p className="mt-1 text-sm font-black text-slate-800">
            {status.pregnant ? gaLabel(ga) : 'ليست حاملة حالياً'}
          </p>
          {edd && <p className="mt-0.5 text-[11px] text-slate-500">الولادة المتوقعة: {formatDateShort(edd)}</p>}
        </Card>

        <Card className="ob-card !rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-400">التاريخ التوليدي (G-P-A)</p>
          <p className="mt-1 text-sm font-black text-slate-800">
            {ob ? gpaLabel(ob.gravida, ob.para, ob.abortions) : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">حمل / ولادة / إجهاض</p>
        </Card>

        <Card className="ob-card !rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-400">فصيلة الدم</p>
          <p className="mt-1 text-sm font-black text-slate-800">
            {ob?.blood_group ? `${ob.blood_group}${ob.rh ? (ob.rh === 'NEGATIVE' ? ' −' : ' +') : ''}` : '—'}
          </p>
          {ob?.weight && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              الوزن {ob.weight} كغ{bmi != null ? ` · BMI ${bmi} (${bmiLabel(bmi)?.text})` : ''}
            </p>
          )}
        </Card>

        <Card className="ob-card !rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-400">مستوى الخطورة</p>
          <p
            className={`mt-1 text-sm font-black ${
              risk.cls === 'rose' ? 'text-rose-600' : risk.cls === 'amber' ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {risk.label}
          </p>
          {alerts.length > 0 && <p className="mt-0.5 text-[11px] text-slate-500">{alerts.length} تنبيه</p>}
        </Card>
      </div>

      {/* ===== التنبيهات ===== */}
      {alerts.length > 0 && (
        <Card className="mb-4" title="تنبيهات تحتاج انتباهاً">
          <ul className="flex flex-wrap gap-2">
            {alerts.map((a) => (
              <li
                key={a.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                  a.tone === 'rose' ? 'bg-rose-50 text-rose-700' : a.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <TriangleAlert size={12} />
                {a.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ===== سجل الحمول السابقة ===== */}
      {pregnancies.length > 0 && (
        <Card className="mb-4" title="سجل الحمول السابقة">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="p-2 text-start font-bold">السنة</th>
                  <th className="p-2 text-start font-bold">النتيجة</th>
                  <th className="p-2 text-start font-bold">نوع الولادة</th>
                  <th className="p-2 text-start font-bold">المضاعفات</th>
                </tr>
              </thead>
              <tbody>
                {pregnancies.map((p, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="p-2 font-bold text-slate-700">{p.year || '—'}</td>
                    <td className="p-2 text-slate-600">{p.outcome || '—'}</td>
                    <td className="p-2 text-slate-600">{p.mode || '—'}</td>
                    <td className="p-2 text-slate-600">{p.complications || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ===== خط زمني للزيارات ===== */}
      <Card className="mb-4" title="سجل الكشوف" subtitle={`${(visits || []).length} كشف`}>
        {(visits || []).length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">لا توجد كشوف مسجلة بعد</p>
        ) : (
          <ul className="space-y-2">
            {(visits || []).map((v) => {
              const sd = v.specialty_data || {}
              const findings = sd.findings || []
              const vOb = sd.obgyn || {}
              const isOpen = openVisit === v.id
              return (
                <li key={v.id} className="rounded-2xl border border-slate-200">
                  <button
                    onClick={() => setOpenVisit(isOpen ? null : v.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                        {formatDateShort(v.visit_date)}
                        {vOb.lmp && (
                          <span className="ob-chip !border-pink-200 !bg-pink-50 !text-pink-700">
                            <Baby size={10} />
                            {gaLabel(gestationalAge(vOb.lmp, v.visit_date))}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{v.diagnosis || v.chief_complaint || '—'}</p>
                    </div>
                    <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600">
                      {v.chief_complaint && (
                        <p><b className="text-slate-400">الشكوى:</b> {v.chief_complaint}</p>
                      )}
                      {v.physical_examination && (
                        <p><b className="text-slate-400">الفحص:</b> {v.physical_examination}</p>
                      )}
                      {v.treatment_plan && (
                        <p><b className="text-slate-400">الخطة العلاجية:</b> {v.treatment_plan}</p>
                      )}
                      {vOb.ultrasound && (
                        <p><b className="text-slate-400">السونار:</b> {vOb.ultrasound}</p>
                      )}
                      {vOb.labs && (
                        <p><b className="text-slate-400">التحاليل:</b> {vOb.labs}</p>
                      )}
                      {(v.medications || []).length > 0 && (
                        <p className="flex items-start gap-1">
                          <Pill size={12} className="mt-0.5" />
                          <span>
                            <b className="text-slate-400">الأدوية:</b>{' '}
                            {(v.medications || []).map((m) => `${m.name} ${m.dosage || ''} ${m.duration || ''}`).join(' · ')}
                          </span>
                        </p>
                      )}

                      {findings.length > 0 && (
                        <div>
                          <p className="mb-1 font-bold text-slate-400">نتائج المخطط</p>
                          <ul className="space-y-1">
                            {findings.map((f, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
                                <span>{f.treatment || f.note || f.region}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sd.sketch && (
                        <div>
                          <p className="mb-1 font-bold text-slate-400">الرسم اليدوي</p>
                          <SketchCanvas value={sd.sketch} readOnly height={180} className="max-w-md" />
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* ===== المتابعات والمدفوعات ===== */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="المتابعات">
          {followUps.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">لا توجد متابعات</p>
          ) : (
            <ul className="space-y-1.5">
              {followUps.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-bold text-slate-700">{f.suggested_date ? formatDateShort(f.suggested_date) : '—'}</span>
                  <span className="text-slate-500">{f.status === 'pending' ? 'بانتظار الحجز' : 'مجدولة'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="المدفوعات">
          {payments.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">لا توجد مدفوعات</p>
          ) : (
            <ul className="space-y-1.5">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-bold text-slate-700" dir="ltr">{Number(p.amount || 0).toLocaleString('en-US')}</span>
                  <span className="text-slate-500">
                    {formatDateShort(String(p.paid_at || p.created_at).slice(0, 10))} · {p.status === 'paid' ? 'مدفوعة' : 'آجلة'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* معلومات طبية */}
      {medInfo && (
        <Card className="mt-4" title="المعلومات الطبية">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: 'أمراض مزمنة', value: medInfo.chronic_diseases },
              { label: 'أدوية حالية', value: medInfo.current_medications },
              { label: 'عمليات سابقة', value: medInfo.previous_surgeries },
              { label: 'ملاحظات مهمة', value: medInfo.important_notes },
              { label: 'الحساسية', value: medInfo.allergies },
            ]
              .filter((c) => c.value?.trim())
              .map((c) => (
                <div key={c.label} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <HeartPulse size={11} />
                    {c.label}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-700">{c.value}</p>
                </div>
              ))}
          </div>
        </Card>
      )}

      <p className="mt-6 text-center text-[11px] text-slate-400">
        آخر تحديث: {todayStr()} — نظام إدارة عيادة النساء والتوليد
      </p>

      <BookingModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        presetPatient={{ id: patient.id, full_name: patient.full_name, phone: patient.phone }}
        onBooked={() => load()}
      />
    </div>
  )
}
