import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, PencilLine, CalendarPlus, Stethoscope, HeartPulse, AlertTriangle,
  Pill, Scissors, ClipboardList, Paperclip, Upload, FileText, ImageIcon, FlaskConical, ExternalLink, ChevronDown,
} from 'lucide-react'
import { useApp } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Button, Card, Badge, APPT_STATUS, Tag, EmptyState, Spinner, Modal } from '../components/ui'
import PatientFormModal from '../components/PatientFormModal'
import MedicalInfoModal from '../components/MedicalInfoModal'
import BookingModal from '../components/BookingModal'
import { ageFrom, genderLabel, formatDateShort, formatDateTime, money, todayStr } from '../lib/format'

const CATEGORY_META = {
  lab: { label: 'تحليل مخبري', icon: FlaskConical },
  imaging: { label: 'صورة طبية', icon: ImageIcon },
  document: { label: 'مستند', icon: FileText },
  other: { label: 'أخرى', icon: Paperclip },
}

export default function PatientProfile() {
  const { id } = useParams()
  const { profile, settings, effectiveRole, toast } = useApp()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()

  const [patient, setPatient] = useState(null)
  const [medInfo, setMedInfo] = useState(null)
  const [visits, setVisits] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [todayAppt, setTodayAppt] = useState(null)
  const [dentalHistory, setDentalHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(params.get('edit') === '1')
  const [medOpen, setMedOpen] = useState(false)
  const [booking, setBooking] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [uploadCat, setUploadCat] = useState('document')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.clinic_id || !id) return
    setLoading(true)
    const isDental = profile?.clinic?.specialty_key === 'dentistry'
    const [pRes, miRes, vRes, attRes, apptRes, dentalRes] = await Promise.all([
      supabase.from('patients').select('*').eq('id', id).single(),
      supabase.from('medical_information').select('*').eq('patient_id', id).maybeSingle(),
      supabase
        .from('visits')
        .select('*, medications(*), doctor:profiles(full_name)')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false })
        .limit(50),
      supabase.from('attachments').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
      supabase
        .from('appointments')
        .select('id, appointment_date, start_time, status')
        .eq('clinic_id', profile.clinic_id)
        .eq('patient_id', id)
        .in('status', ['confirmed', 'arrived', 'waiting', 'in_consultation'])
        .order('appointment_date', { ascending: false })
        .limit(1),
      isDental
        ? supabase
            .from('dental_chart_entries')
            .select('*, visit:visits(visit_date)')
            .eq('patient_id', id)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null }),
    ])
    setPatient(pRes.data || null)
    setMedInfo(miRes.data || null)
    setVisits(vRes.data || [])
    setAttachments(attRes.data || [])
    setTodayAppt(apptRes.data?.[0] || null)
    setDentalHistory(dentalRes.data || [])
    setLoading(false)
  }, [id, profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const isDoctor = effectiveRole === 'doctor'
  // per-doctor specialty first, then the clinic's
  const specialtyKey = profile?.specialty_key || profile?.clinic?.specialty_key || 'general'
  const isDentalClinic = specialtyKey === 'dentistry'

  const startConsultation = () => {
    if (todayAppt) {
      nav(`/doctor/consultation/${todayAppt.id}`)
    } else {
      nav(`/doctor/consultation/new/${id}`)
    }
  }

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !patient) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.clinic_id}/${patient.id}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('patient-attachments').upload(path, file)
    if (upErr) {
      setUploading(false)
      return toast('error', 'تعذر رفع الملف: ' + upErr.message)
    }
    const { error: dbErr } = await supabase.from('attachments').insert({
      clinic_id: profile.clinic_id,
      patient_id: patient.id,
      name: file.name,
      category: uploadCat,
      file_type: file.type,
      file_size: file.size,
      storage_path: path,
      uploaded_by: profile.id,
    })
    setUploading(false)
    if (dbErr) return toast('error', 'تعذر رفع الملف')
    toast('success', 'تم إرفاق الملف بنجاح')
    load()
  }

  const openAttachment = async (att) => {
    const { data } = await supabase.storage.from('patient-attachments').createSignedUrl(att.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

  if (loading) return <Spinner />
  if (!patient)
    return <EmptyState icon={FileText} title="المريض غير موجود" message="ربما تم حذف الملف أو الرابط غير صحيح" action={<Button onClick={() => nav(-1)}>رجوع</Button>} />

  const latest = visits?.[0]
  const history = visits?.slice(1) || []

  const infoCards = [
    { key: 'chronic_diseases', label: 'أمراض مزمنة', icon: HeartPulse, value: medInfo?.chronic_diseases, tone: 'rose' },
    { key: 'allergies', label: 'حساسية', icon: AlertTriangle, value: medInfo?.allergies, tone: 'amber' },
    { key: 'current_medications', label: 'أدوية حالية', icon: Pill, value: medInfo?.current_medications, tone: 'teal' },
    { key: 'previous_surgeries', label: 'عمليات سابقة', icon: Scissors, value: medInfo?.previous_surgeries, tone: 'slate' },
    { key: 'important_notes', label: 'ملاحظات طبية مهمة', icon: ClipboardList, value: medInfo?.important_notes, tone: 'blue' },
  ]

  return (
    <div>
      {/* header */}
      <div className="mb-5">
        <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
          <ArrowRight size={14} />
          رجوع
        </button>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-xl font-bold text-primary-800 ring-1 ring-primary-100">
                {patient.full_name?.trim().charAt(0)}
              </span>
              <div>
                <h1 className="text-lg font-bold text-slate-800 sm:text-xl">{patient.full_name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span dir="ltr" className="font-semibold">{patient.phone}</span>
                  {patient.date_of_birth && <Tag>{ageFrom(patient.date_of_birth)} سنة</Tag>}
                  <Tag>{genderLabel(patient.gender)}</Tag>
                  {patient.address && <span className="hidden sm:inline">· {patient.address}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isDoctor ? (
                <Button onClick={startConsultation}>
                  <Stethoscope size={16} />
                  {todayAppt?.status === 'in_consultation' ? 'متابعة الكشف' : 'بدء الكشف'}
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    <PencilLine size={15} />
                    تعديل البيانات
                  </Button>
                  <Button onClick={() => setBooking(true)}>
                    <CalendarPlus size={15} />
                    حجز موعد
                  </Button>
                </>
              )}
            </div>
          </div>
          {todayAppt && (
            <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              موعد {todayAppt.appointment_date === todayStr() ? 'اليوم' : formatDateShort(todayAppt.appointment_date)} الساعة{' '}
              <b dir="ltr">{todayAppt.start_time?.slice(0, 5)}</b>
              <Badge map={APPT_STATUS} value={todayAppt.status} />
            </p>
          )}
        </Card>
      </div>

      {/* important medical info */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">معلومات طبية مهمة</h2>
          {isDoctor && (
            <Button size="sm" variant="secondary" onClick={() => setMedOpen(true)}>
              <PencilLine size={13} />
              تعديل
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {infoCards.map((c) => {
            const has = !!c.value?.trim()
            return (
              <div
                key={c.key}
                className={`rounded-xl border p-3.5 ${
                  has
                    ? c.key === 'allergies'
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-slate-200 bg-white'
                    : 'border-slate-100 bg-slate-50'
                }`}
              >
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <c.icon size={13} className={has && c.key === 'allergies' ? 'text-rose-600' : 'text-slate-400'} />
                  {c.label}
                </p>
                <p className={`text-sm leading-relaxed ${has ? 'font-semibold text-slate-800' : 'text-slate-300'}`}>
                  {has ? c.value : 'لا يوجد'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* latest visit */}
      <div className="mb-5">
        <h2 className="mb-2 text-sm font-bold text-slate-700">آخر زيارة</h2>
        {latest ? (
          <VisitCard visit={latest} latest />
        ) : (
          <Card>
            <EmptyState icon={Stethoscope} title="لا توجد زيارات بعد" message="سيظهر هنا سجل أول كشف طبي للمريض" />
          </Card>
        )}
      </div>

      {/* history */}
      <div className="mb-5">
        <h2 className="mb-2 text-sm font-bold text-slate-700">السجل الطبي</h2>
        {history.length === 0 ? (
          <Card>
            <p className="py-4 text-center text-xs text-slate-400">لا توجد زيارات سابقة أخرى</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map((v) => (
              <VisitCard key={v.id} visit={v} expanded={expanded === v.id} onToggle={() => setExpanded(expanded === v.id ? null : v.id)} />
            ))}
          </div>
        )}
      </div>

      {/* dental history (dentistry clinics) */}
      {isDentalClinic && dentalHistory && dentalHistory.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 text-sm font-bold text-slate-700">سجل الأسنان</h2>
          <Card bodyClass="!p-0">
            <ul className="divide-y divide-slate-100">
              {dentalHistory.slice(0, 15).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-800">
                    {e.tooth_no}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700">{e.procedure}{e.notes ? <span className="font-medium text-slate-500"> · {e.notes}</span> : null}</p>
                    <p className="text-[10px] text-slate-400">{e.visit?.visit_date ? formatDateShort(e.visit.visit_date) : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* attachments */}
      <div className="mb-8">
        <h2 className="mb-2 text-sm font-bold text-slate-700">المرفقات والفحوصات</h2>
        <Card bodyClass="!p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <select value={uploadCat} onChange={(e) => setUploadCat(e.target.value)} className="input-base !w-auto !py-1.5">
              <option value="lab">تحليل مخبري</option>
              <option value="imaging">صورة طبية</option>
              <option value="document">مستند</option>
              <option value="other">أخرى</option>
            </select>
            <label className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary-700 px-3 text-xs font-semibold text-white hover:bg-primary-800 ${uploading ? 'opacity-60' : ''}`}>
              <Upload size={13} />
              {uploading ? 'جارٍ الرفع...' : 'إضافة مرفق'}
              <input type="file" className="hidden" onChange={onUpload} disabled={uploading} />
            </label>
          </div>
          {attachments.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-slate-400">لا توجد مرفقات</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attachments.map((a) => {
                const meta = CATEGORY_META[a.category] || CATEGORY_META.other
                return (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <meta.icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-700">{a.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {meta.label} · {formatDateTime(a.created_at)}
                        {a.file_size ? ` · ${(a.file_size / 1024).toFixed(0)} KB` : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openAttachment(a)}>
                      <ExternalLink size={14} />
                      فتح
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <PatientFormModal open={editOpen} onClose={() => { setEditOpen(false); setParams({}, { replace: true }) }} patient={patient} onSaved={load} />
      <MedicalInfoModal open={medOpen} onClose={() => setMedOpen(false)} patientId={id} info={medInfo} onSaved={load} />
      <BookingModal open={booking} onClose={() => setBooking(false)} presetPatient={patient} onBooked={load} />
    </div>
  )
}

function VisitCard({ visit, latest = false, expanded = false, onToggle }) {
  const { settings } = useApp()
  const [open, setOpen] = useState(expanded)
  useEffect(() => setOpen(expanded), [expanded])
  const meds = visit.medications || []
  const rows = [
    { label: 'الشكوى الرئيسية', value: visit.chief_complaint },
    { label: 'الأعراض', value: visit.symptoms },
    { label: 'الفحص السريري', value: visit.physical_examination },
    { label: 'التشخيص', value: visit.diagnosis },
    { label: 'خطة العلاج', value: visit.treatment_plan },
    { label: 'ملاحظات طبية', value: visit.medical_notes },
  ]
  return (
    <Card
      title={latest ? formatDateShort(visit.visit_date) : undefined}
      subtitle={latest ? undefined : undefined}
      bodyClass="!p-4 sm:!p-5"
    >
      <button onClick={onToggle ? () => onToggle() : undefined} className={`flex w-full items-center justify-between gap-3 text-start ${onToggle ? 'cursor-pointer' : ''}`}>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
            {formatDateShort(visit.visit_date)}
            {latest && <Tag tone="teal">آخر زيارة</Tag>}
            {visit.doctor?.full_name && <span className="text-xs font-medium text-slate-400">{visit.doctor.full_name}</span>}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {visit.chief_complaint || 'بدون شكوى مسجلة'}
            {visit.diagnosis ? ` — ${visit.diagnosis}` : ''}
          </p>
        </div>
        {onToggle && <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {(open || latest) && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {rows
            .filter((r) => r.value?.trim())
            .map((r) => (
              <div key={r.label}>
                <p className="mb-0.5 text-[11px] font-bold text-slate-400">{r.label}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{r.value}</p>
              </div>
            ))}
                    {visit.specialty_data && Object.keys(visit.specialty_data).length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-slate-400">بيانات التخصص</p>
              <ul className="space-y-1">
                {Object.entries(visit.specialty_data).map(([label, value]) => (
                  <li key={label} className="flex gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="font-bold text-slate-500">{label}:</span>
                    <span className="font-semibold text-slate-700">{String(value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {meds.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-slate-400">الأدوية الموصوفة</p>
              <ul className="space-y-1.5">
                {meds.map((m) => (
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
          {!latest && !onToggle && null}
        </div>
      )}
    </Card>
  )
}
