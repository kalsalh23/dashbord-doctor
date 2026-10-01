import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Pill, ChevronDown } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Card, EmptyState, SkeletonRows, PageHeader, SearchInput, Tag, Tabs } from '../../components/ui'
import { formatDateShort, todayStr } from '../../lib/format'

export default function VisitsLog() {
  const { profile } = useApp()
  const [visits, setVisits] = useState(null)
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('today')
  const [expanded, setExpanded] = useState(null)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('visits')
      .select('id, visit_date, chief_complaint, diagnosis, symptoms, physical_examination, treatment_plan, medical_notes, patient:patients(id, full_name, phone), doctor:profiles(full_name), medications(name, dosage, duration, instructions)')
      .eq('clinic_id', profile.clinic_id)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(150)
    setVisits(data || [])
  }, [profile?.clinic_id])

  useEffect(() => {
    load()
  }, [load])

  const todayCount = useMemo(() => (visits || []).filter((v) => v.visit_date === todayStr()).length, [visits])

  const shown = useMemo(() => {
    let list = visits || []
    if (scope === 'today') list = list.filter((v) => v.visit_date === todayStr())
    const term = q.trim()
    if (term) {
      list = list.filter(
        (v) =>
          (v.patient?.full_name || '').includes(term) ||
          (v.diagnosis || '').includes(term) ||
          (v.chief_complaint || '').includes(term)
      )
    }
    return list
  }, [visits, scope, q])

  return (
    <div className="max-w-3xl">
      <PageHeader title="سجل الكشوفات" subtitle="جميع الزيارات الطبية المسجلة في العيادة" />

      <div className="mb-4">
        <Tabs
          value={scope}
          onChange={setScope}
          tabs={[
            { value: 'today', label: 'زيارات اليوم', count: visits ? todayCount : undefined },
            { value: 'all', label: 'الكل', count: visits ? visits.length : undefined },
          ]}
        />
      </div>

      <div className="mb-4">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المريض أو التشخيص أو الشكوى..." />
      </div>

      {visits === null ? (
        <SkeletonRows rows={6} />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={q ? 'لا توجد نتائج مطابقة' : scope === 'today' ? 'لا توجد زيارات اليوم بعد' : 'لا توجد كشوفات بعد'}
            message={
              q
                ? 'جرّب كلمة بحث أخرى'
                : scope === 'today'
                  ? 'ستظهر هنا الزيارات التي تم إنهاؤها اليوم — بدّل إلى «الكل» للسجل الكامل'
                  : 'ستظهر هنا كل زيارة يتم إنهاؤها من شاشة الكشف'
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {shown.map((v) => {
            const open = expanded === v.id
            const meds = v.medications || []
            return (
              <div key={v.id} className="rounded-xl border border-slate-200 bg-white shadow-card">
                <button onClick={() => setExpanded(open ? null : v.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-start sm:px-5">
                  <span className="w-20 shrink-0 text-sm font-bold text-slate-800">{formatDateShort(v.visit_date)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); nav(`/doctor/patients/${v.patient?.id}`) }}
                    className="min-w-0 flex-1 truncate text-sm font-bold text-primary-700 hover:underline"
                  >
                    {v.patient?.full_name}
                  </button>
                  <div className="hidden min-w-0 flex-[2] sm:block">
                    <p className="truncate text-xs text-slate-500">
                      {v.chief_complaint || '—'}
                      {v.diagnosis ? ` — ${v.diagnosis}` : ''}
                    </p>
                  </div>
                  {meds.length > 0 && <Tag tone="teal">{meds.length} دواء</Tag>}
                  <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="space-y-3 border-t border-slate-100 px-4 py-4 sm:px-5">
                    {[
                      { label: 'الشكوى الرئيسية', value: v.chief_complaint },
                      { label: 'الأعراض', value: v.symptoms },
                      { label: 'الفحص السريري', value: v.physical_examination },
                      { label: 'التشخيص', value: v.diagnosis },
                      { label: 'خطة العلاج', value: v.treatment_plan },
                      { label: 'ملاحظات طبية', value: v.medical_notes },
                    ]
                      .filter((r) => r.value?.trim())
                      .map((r) => (
                        <div key={r.label}>
                          <p className="mb-0.5 text-[11px] font-bold text-slate-400">{r.label}</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{r.value}</p>
                        </div>
                      ))}
                    {meds.length > 0 && (
                      <div>
                        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-400">
                          <Pill size={12} />
                          الأدوية الموصوفة
                        </p>
                        <ul className="space-y-1.5">
                          {meds.map((m, idx) => (
                            <li key={idx} className="flex flex-wrap items-center gap-x-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                              <span className="font-bold text-slate-700">{m.name}</span>
                              {m.dosage && <span className="text-slate-500">{m.dosage}</span>}
                              {m.duration && <span className="text-slate-400">· {m.duration}</span>}
                              {m.instructions && <span className="text-slate-400">· {m.instructions}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-50 pt-3">
                      <span className="text-[10px] text-slate-300">{v.doctor?.full_name || ''}</span>
                      <button onClick={() => nav(`/doctor/patients/${v.patient?.id}`)} className="text-xs font-semibold text-primary-700 hover:underline">
                        فتح ملف المريض كاملاً
                      </button>
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
}
