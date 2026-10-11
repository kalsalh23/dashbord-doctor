import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileSearch, Printer, RefreshCw, Users } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, SkeletonRows, PageHeader, SearchInput, Tag, Avatar } from '../../components/ui'
import PrescriptionSheet from '../../components/PrescriptionSheet'
import { usePrintIsolation } from '../../lib/print'

/**
 * واجهة المعاينة — عيادة د. نزار عبد الستار الشيخ (قالب nizar)
 * بحث باسم المريض ← تظهر معايناته الورقية (ورقة العيادة المطابقة للأصل)
 * معبأة من زياراته المحفوظة — ويمكن طباعتها.
 * الكتابة على الورقة تجري في «الكشف» (الورقة الحية)؛ هذه الواجهة للاستعراض والطباعة.
 */

// توحيد الحروف العربية للبحث: همزات، تاء مربوطة، ألف مقصورة، تشكيل
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .trim()

export default function NizarExamBoard() {
  const { profile, settings } = useApp()
  const [patients, setPatients] = useState(null)
  const [visitsByPatient, setVisitsByPatient] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null) // { patient, visits }
  usePrintIsolation()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    setError(null)
    const [pRes, vRes] = await Promise.all([
      supabase
        .from('patients')
        .select('id, full_name, phone, date_of_birth, created_at')
        .eq('clinic_id', profile.clinic_id)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('visits')
        .select('id, patient_id, visit_date, diagnosis, treatment_plan, medical_notes, doctor:profiles(full_name), medications(name, dosage, duration, instructions)')
        .eq('clinic_id', profile.clinic_id)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3000),
    ])
    if (pRes.error || vRes.error) {
      setError((pRes.error || vRes.error)?.message || 'تعذر تحميل المعاينات')
      setPatients([])
      return
    }
    const m = new Map()
    for (const v of vRes.data || []) {
      if (!m.has(v.patient_id)) m.set(v.patient_id, [])
      m.get(v.patient_id).push(v)
    }
    setVisitsByPatient(m)
    setPatients(pRes.data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    if (patients === null || visitsByPatient === null) return null
    const term = norm(q)
    const list = patients.map((p) => ({ patient: p, visits: visitsByPatient.get(p.id) || [] }))
    const filtered = !term
      ? list
      : list.filter((g) => norm(g.patient.full_name).includes(term) || (g.patient.phone || '').includes(term))
    // الذين لديهم معاينات أولاً، ثم أبجدياً
    return filtered.sort((a, b) => {
      if (a.visits.length && !b.visits.length) return -1
      if (!a.visits.length && b.visits.length) return 1
      return (a.patient.full_name || '').localeCompare(b.patient.full_name || '', 'ar')
    })
  }, [patients, visitsByPatient, q])

  // تصغير الأوراق لتناسب عرض الشاشة (بنفس عرض الطباعة 745px)
  const frameRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const fit = () => {
      const el = frameRef.current
      if (!el) return
      const avail = el.parentElement?.clientWidth || 0
      if (avail > 0) setZoom(Math.min(1, avail / 745))
    }
    if (selected) {
      fit()
      const t = setTimeout(fit, 400)
      window.addEventListener('resize', fit)
      return () => {
        window.removeEventListener('resize', fit)
        clearTimeout(t)
      }
    }
  }, [selected])

  const pick = (g) => setSelected(g.visits.length ? g : null)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="المعاينة"
        subtitle="ابحث باسم المريض لتظهر معايناته الورقية — ويمكن طباعتها"
        actions={
          <Button variant="secondary" size="sm" onClick={load} className="print:hidden">
            <RefreshCw size={14} />
            تحديث
          </Button>
        }
      />

      {/* بحث — ثابت أعلى الصفحة أثناء التمرير. عند اختيار مريض يظهر زر الرجوع للبحث */}
      <div className="sticky top-0 z-10 -mx-1 mb-4 bg-slate-50/95 px-1 py-2 backdrop-blur print:hidden">
        {selected ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>
              <Users size={14} />
              رجوع للبحث
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">{selected.patient.full_name}</span>
              <Tag tone="teal">{selected.visits.length} معاينة</Tag>
            </div>
            <Button size="sm" onClick={() => window.print()}>
              <Printer size={14} />
              طباعة المعاينات
            </Button>
          </div>
        ) : (
          <>
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المريض..." autoFocus />
            {rows !== null && (
              <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
                <Users size={13} />
                {rows.length} مريض{q ? ` (من ${patients.length})` : ''}
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <Card>
          <EmptyState icon={FileSearch} title="تعذر تحميل المعاينات" message={error} action={<Button size="sm" onClick={load}>إعادة المحاولة</Button>} />
        </Card>
      )}

      {/* قائمة المرضى (وضع البحث) */}
      {!error && !selected && patients === null ? (
        <SkeletonRows rows={6} />
      ) : !error && !selected && rows.length === 0 ? (
        <Card>
          <EmptyState icon={FileSearch} title="لا توجد نتائج مطابقة" message="جرّب كلمة بحث أخرى — البحث بالاسم أو الهاتف" />
        </Card>
      ) : (
        !error &&
        !selected && (
          <div className="space-y-3">
            {rows.map((g) => (
              <button
                key={g.patient.id}
                onClick={() => pick(g)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-start shadow-card transition-colors hover:bg-primary-50/30 sm:px-5"
              >
                <Avatar name={g.patient.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{g.patient.full_name}</p>
                  <p className="text-[11px] text-slate-400" dir="ltr">{g.patient.phone || '—'}</p>
                </div>
                {g.visits.length > 0 ? <Tag tone="teal">{g.visits.length} معاينة</Tag> : <Tag>لا معاينات</Tag>}
              </button>
            ))}
          </div>
        )
      )}

      {/* أوراق المعاينة للمريض المختار — هذه المنطقة وحدها تُطبع */}
      {!error && selected && (
        <>
          {selected.visits.length === 0 ? (
            <Card>
              <EmptyState icon={FileSearch} title="لا توجد معاينات لهذا المريض" message="تُنشأ المعاينة تلقائياً عند كتابتها في «الكشف» — ورقة المعاينة الحية" />
            </Card>
          ) : (
            <div className="print-area space-y-5" ref={frameRef}>
              {selected.visits.map((v) => (
                <div key={v.id} className="prescription-paper" style={{ zoom }}>
                  <PrescriptionSheet
                    clinic={profile?.clinic}
                    settings={settings}
                    patient={selected.patient}
                    visit={v}
                    meds={v.medications || []}
                    doctorName={v.doctor?.full_name || profile?.full_name}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-center text-[11px] text-slate-400 print:hidden">
            كل ورقة مطابقة للورقة الأصلية وتُطبع كما هي — بالترتيب من الأحدث.
          </p>
        </>
      )}
    </div>
  )
}
