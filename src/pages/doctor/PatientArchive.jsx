import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Pill, ChevronDown, Printer, FolderOpen } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, EmptyState, SkeletonRows, PageHeader, SearchInput, Tag, Avatar } from '../../components/ui'
import { formatDateShort } from '../../lib/format'

/**
 * أرشيف المرضى — أرشيف كل مريض من معايناته وأدويته السابقة، مع طباعة الوصفة.
 */
export default function PatientArchive() {
  const { profile } = useApp()
  const [visits, setVisits] = useState(null)
  const [q, setQ] = useState('')
  const [openPatient, setOpenPatient] = useState(null)
  const [openVisit, setOpenVisit] = useState(null)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('visits')
      .select('id, visit_date, chief_complaint, diagnosis, treatment_plan, symptoms, physical_examination, medical_notes, specialty_data, patient:patients(id, full_name, phone), doctor:profiles(full_name), medications(name, dosage, duration, instructions)')
      .eq('clinic_id', profile.clinic_id)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)
    setVisits(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  // group visits by patient
  const byPatient = useMemo(() => {
    const m = new Map()
    for (const v of visits || []) {
      const pid = v.patient?.id
      if (!pid) continue
      if (!m.has(pid)) m.set(pid, { patient: v.patient, visits: [] })
      m.get(pid).visits.push(v)
    }
    return Array.from(m.values())
  }, [visits])

  const shown = useMemo(() => {
    const term = q.trim()
    if (!term) return byPatient
    return byPatient.filter(
      (g) =>
        (g.patient?.full_name || '').includes(term) ||
        (g.patient?.phone || '').includes(term) ||
        g.visits.some((v) => (v.diagnosis || '').includes(term))
    )
  }, [byPatient, q])

  return (
    <div className="max-w-3xl">
      <PageHeader title="أرشيف المرضى" subtitle="أرشيف كل مريض: معايناته وأدويته السابقة — مع طباعة الوصفة" />

      <div className="mb-4">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المريض أو الهاتف أو التشخيص..." />
      </div>

      {visits === null ? (
        <SkeletonRows rows={6} />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Archive}
            title={q ? 'لا توجد نتائج مطابقة' : 'الأرشيف فارغ'}
            message={q ? 'جرّب كلمة بحث أخرى' : 'ستُنشأ الأرشيفات تلقائياً مع كل كشف يُنجز'}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((g) => {
            const open = openPatient === g.patient.id
            const last = g.visits[0]
            return (
              <div key={g.patient.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                {/* patient header */}
                <button onClick={() => setOpenPatient(open ? null : g.patient.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start sm:px-5">
                  <Avatar name={g.patient.full_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{g.patient.full_name}</p>
                    <p className="text-[11px] text-slate-400" dir="ltr">{g.patient.phone}</p>
                  </div>
                  <div className="hidden text-end sm:block">
                    <Tag tone="teal">{g.visits.length} زيارة</Tag>
                    <p className="mt-1 text-[10px] text-slate-400">آخر زيارة: {formatDateShort(last.visit_date)}</p>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 sm:px-5">
                    {g.visits.map((v) => {
                      const vOpen = openVisit === v.id
                      const meds = v.medications || []
                      return (
                        <div key={v.id} className="rounded-lg border border-slate-200 bg-white">
                          <button onClick={() => setOpenVisit(vOpen ? null : v.id)} className="flex w-full flex-wrap items-center gap-2.5 px-3.5 py-2.5 text-start">
                            <span className="text-xs font-bold text-slate-800">{formatDateShort(v.visit_date)}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                              {v.chief_complaint || '—'}{v.diagnosis ? ` — ${v.diagnosis}` : ''}
                            </span>
                            {meds.length > 0 && <Tag tone="teal">{meds.length} دواء</Tag>}
                            <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${vOpen ? 'rotate-180' : ''}`} />
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
                              <div className="flex justify-between border-t border-slate-50 pt-2">
                                <Button size="sm" variant="secondary" onClick={() => nav(`/doctor/patients/${v.patient?.id}`)}>
                                  <FolderOpen size={13} />
                                  الملف الكامل
                                </Button>
                                <Button size="sm" onClick={() => nav(`/print/prescription/${v.id}`)}>
                                  <Printer size={13} />
                                  الوصفة الطبية
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
