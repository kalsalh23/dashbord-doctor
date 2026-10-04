import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Pill, ChevronDown, Printer, FolderOpen, Stethoscope, FileText, RefreshCw, Users } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, Button, EmptyState, SkeletonRows, PageHeader, SearchInput, Tag, Avatar, Tabs } from '../../components/ui'
import { formatDateShort } from '../../lib/format'

/**
 * أرشيف المرضى — مبني على جدول المرضى نفسه (كل المرضى يظهرون حتى بدون زيارات)،
 * بحث فوري بالاسم/الهاتف/التشخيص مع تجاهل الهمزات والتاء المربوطة،
 * وترتيب حسب الأحدث زيارة أو أبجدياً — وصول سريع لأرشيف أي مريض.
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

export default function PatientArchive() {
  const { profile } = useApp()
  const [patients, setPatients] = useState(null)
  const [visits, setVisits] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')
  const [openPatient, setOpenPatient] = useState(null)
  const [openVisit, setOpenVisit] = useState(null)
  const nav = useNavigate()

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
        .select('id, patient_id, visit_date, chief_complaint, diagnosis, treatment_plan, medical_notes, doctor:profiles(full_name), medications(name, dosage, duration, instructions)')
        .eq('clinic_id', profile.clinic_id)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3000),
    ])
    if (pRes.error || vRes.error) {
      setError((pRes.error || vRes.error)?.message || 'تعذر تحميل الأرشيف')
      setPatients([])
      setVisits([])
      return
    }
    setPatients(pRes.data || [])
    setVisits(vRes.data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  // كل زيارات كل مريض حسب patient_id (لا يعتمد على الـ join)
  const visitsByPatient = useMemo(() => {
    const m = new Map()
    for (const v of visits || []) {
      if (!m.has(v.patient_id)) m.set(v.patient_id, [])
      m.get(v.patient_id).push(v)
    }
    return m
  }, [visits])

  const rows = useMemo(() => {
    if (patients === null) return null
    const list = patients.map((p) => ({ patient: p, visits: visitsByPatient.get(p.id) || [] }))

    // بحث فوري: الاسم، الهاتف، أو أي تشخيص/شكوى ضمن الزيارات
    const term = norm(q)
    const filtered = !term
      ? list
      : list.filter(
          (g) =>
            norm(g.patient.full_name).includes(term) ||
            (g.patient.phone || '').includes(term) ||
            g.visits.some((v) => norm(v.diagnosis).includes(term) || norm(v.chief_complaint).includes(term))
        )

    if (sort === 'name') {
      filtered.sort((a, b) => (a.patient.full_name || '').localeCompare(b.patient.full_name || '', 'ar'))
    } else {
      // الأحدث زيارة أولاً — المرضى بدون زيارات في النهاية حسب تاريخ التسجيل
      const last = (g) => g.visits[0]?.visit_date || ''
      filtered.sort((a, b) => {
        if (last(a) && last(b)) return last(b).localeCompare(last(a))
        if (last(a)) return -1
        if (last(b)) return 1
        return (b.patient.created_at || '').localeCompare(a.patient.created_at || '')
      })
    }
    return filtered
  }, [patients, visitsByPatient, q, sort])

  const withVisits = rows ? rows.filter((g) => g.visits.length > 0).length : 0

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="أرشيف المرضى"
        subtitle="كل المرضى مع زياراتهم وأدويتهم السابقة — ابحث واضغط على المريض لعرض أرشيحه"
        actions={
          <Button variant="secondary" size="sm" onClick={load} className="print:hidden">
            <RefreshCw size={14} />
            تحديث
          </Button>
        }
      />

      {/* بحث + ترتيب — ثابتان أعلى الصفحة أثناء التمرير */}
      <div className="sticky top-0 z-10 -mx-1 mb-4 space-y-2.5 bg-slate-50/95 px-1 py-2 backdrop-blur">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المريض أو الهاتف أو التشخيص..." autoFocus />
        <div className="flex items-center justify-between gap-2">
          <Tabs
            tabs={[
              { value: 'recent', label: 'الأحدث زيارة' },
              { value: 'name', label: 'الاسم' },
            ]}
            value={sort}
            onChange={setSort}
          />
          {rows !== null && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Users size={13} />
              {rows.length} مريض{q ? ` (من ${patients.length})` : ''} · {withVisits} لديه زيارات
            </p>
          )}
        </div>
      </div>

      {error && (
        <Card>
          <EmptyState icon={Archive} title="تعذر تحميل الأرشيف" message={error} action={<Button size="sm" onClick={load}>إعادة المحاولة</Button>} />
        </Card>
      )}

      {!error && patients === null ? (
        <SkeletonRows rows={6} />
      ) : !error && rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Archive}
            title={q ? 'لا توجد نتائج مطابقة' : 'لا يوجد مرضى بعد'}
            message={q ? 'جرّب كلمة بحث أخرى — البحث يشمل الاسم والهاتف والتشخيص' : 'سيظهر هنا كل مريض يتم تسجيله في العيادة'}
          />
        </Card>
      ) : (
        !error && (
          <div className="space-y-3">
            {rows.map((g) => {
              const open = openPatient === g.patient.id
              const last = g.visits[0]
              return (
                <div key={g.patient.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                  {/* ترويسة المريض — الضغط يفتح أرشيفه */}
                  <button
                    onClick={() => {
                      setOpenPatient(open ? null : g.patient.id)
                      setOpenVisit(null)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-primary-50/30 sm:px-5"
                  >
                    <Avatar name={g.patient.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{g.patient.full_name}</p>
                      <p className="text-[11px] text-slate-400" dir="ltr">{g.patient.phone || '—'}</p>
                    </div>
                    <div className="hidden text-end sm:block">
                      {g.visits.length > 0 ? (
                        <>
                          <Tag tone="teal">{g.visits.length} زيارة</Tag>
                          <p className="mt-1 text-[10px] text-slate-400">آخر زيارة: {formatDateShort(last.visit_date)}</p>
                        </>
                      ) : (
                        <Tag>بدون زيارات</Tag>
                      )}
                    </div>
                    <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 sm:px-5">
                      <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/patients/${g.patient.id}`)}>
                        <FolderOpen size={13} />
                        الملف الكامل للمريض
                      </Button>

                      {g.visits.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
                          لا توجد زيارات مسجلة لهذا المريض بعد
                        </p>
                      ) : (
                        g.visits.map((v) => {
                          const vOpen = openVisit === v.id
                          const meds = v.medications || []
                          return (
                            <div key={v.id} className="rounded-lg border border-slate-200 bg-white">
                              <button
                                onClick={() => setOpenVisit(vOpen ? null : v.id)}
                                className="flex w-full flex-wrap items-center gap-2.5 px-3.5 py-2.5 text-start hover:bg-primary-50/40"
                              >
                                <span className="text-xs font-bold text-slate-800">{formatDateShort(v.visit_date)}</span>
                                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                                  {v.chief_complaint || '—'}{v.diagnosis ? ` — ${v.diagnosis}` : ''}
                                </span>
                                {meds.length > 0 && <Tag tone="teal">{meds.length} دواء</Tag>}
                                <Stethoscope size={14} className="shrink-0 text-primary-500" />
                              </button>

                              {vOpen && (
                                <div className="space-y-2.5 border-t border-slate-100 px-3.5 py-3">
                                  {[
                                    { label: 'الشكوى', value: v.chief_complaint },
                                    { label: 'التشخيص', value: v.diagnosis },
                                    { label: 'خطة العلاج', value: v.treatment_plan },
                                    { label: 'ملاحظات', value: v.medical_notes },
                                  ].filter((r) => r.value?.trim()).map((r) => (
                                    <p key={r.label} className="text-xs leading-relaxed text-slate-600">
                                      <b className="text-slate-400">{r.label}:</b> {r.value}
                                    </p>
                                  ))}
                                  {meds.length > 0 && (
                                    <ul className="space-y-1">
                                      {meds.map((m, i) => (
                                        <li key={i} className="flex flex-wrap items-center gap-x-2 rounded bg-slate-50 px-2.5 py-1.5 text-[11px]">
                                          <Pill size={11} className="text-primary-600" />
                                          <b className="text-slate-700">{m.name}</b>
                                          {m.dosage && <span className="text-slate-500">{m.dosage}</span>}
                                          {m.duration && <span className="text-slate-400">· {m.duration}</span>}
                                          {m.instructions && <span className="text-slate-400">· {m.instructions}</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className="flex flex-wrap justify-between gap-2 border-t border-slate-50 pt-2">
                                    {v.doctor?.full_name && <p className="self-center text-[11px] text-slate-400">الطبيب: {v.doctor.full_name}</p>}
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/visit/${v.id}`)}>
                                        <FileText size={13} />
                                        فتح الكشف
                                      </Button>
                                      <Button size="sm" onClick={() => nav(`/print/prescription/${v.id}`)}>
                                        <Printer size={13} />
                                        الوصفة الطبية
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
