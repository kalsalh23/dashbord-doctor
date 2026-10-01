import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Users, FolderOpen, PencilLine } from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, EmptyState, SearchInput, SkeletonRows, Avatar, PageHeader } from '../../components/ui'
import PatientFormModal from '../../components/PatientFormModal'
import { ageFrom, formatDateShort, genderLabel } from '../../lib/format'

export default function Patients({ doctorMode = false }) {
  const { profile } = useApp()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const nav = useNavigate()

  const load = useCallback(async () => {
    if (!profile?.clinic_id) return
    const query = supabase
      .from('patients')
      .select('id, full_name, phone, date_of_birth, gender, visits(visit_date)')
      .eq('clinic_id', profile.clinic_id)
      .order('created_at', { ascending: false })
      .limit(200)
    const term = q.trim()
    if (term) query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
    const { data } = await query
    setRows(data || [])
  }, [profile?.clinic_id, q])

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const lastVisit = (p) => {
    const ds = (p.visits || []).map((v) => v.visit_date).sort()
    return ds.length ? ds[ds.length - 1] : null
  }

  return (
    <div>
      <PageHeader
        title={doctorMode ? 'ملفات المرضى' : 'المرضى'}
        subtitle={doctorMode ? 'ابحث عن المريض وافتح ملفه الطبي' : 'إدارة سجل المرضى وحجوزاتهم'}
        actions={
          !doctorMode && (
            <Button onClick={() => setFormOpen(true)}>
              <UserPlus size={16} />
              مريض جديد
            </Button>
          )
        }
      />

      <div className="mb-4">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف..." />
      </div>

      <Card bodyClass="!p-0">
        {rows === null ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? 'لا توجد نتائج مطابقة' : 'لا يوجد مرضى بعد'}
            message={q ? 'تأكد من الاسم أو رقم الهاتف وحاول مرة أخرى' : 'ابدأ بإضافة أول مريض للعيادة'}
            action={
              !doctorMode && !q && (
                <Button size="sm" onClick={() => setFormOpen(true)}>إضافة مريض</Button>
              )
            }
          />
        ) : (
          <>
            {/* desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-slate-100 text-start text-xs text-slate-400">
                  <th className="px-5 py-3 text-start font-semibold">المريض</th>
                  <th className="px-5 py-3 text-start font-semibold">الهاتف</th>
                  <th className="px-5 py-3 text-start font-semibold">العمر</th>
                  <th className="px-5 py-3 text-start font-semibold">آخر زيارة</th>
                  <th className="px-5 py-3 text-start font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.full_name} className="h-9 w-9 text-xs" />
                        <button onClick={() => nav(`${p.id}`)} className="font-bold text-slate-800 hover:text-primary-700">
                          {p.full_name}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600" dir="ltr">{p.phone}</td>
                    <td className="px-5 py-3 text-slate-600">{p.date_of_birth ? ageFrom(p.date_of_birth) + ' سنة' : '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{lastVisit(p) ? formatDateShort(lastVisit(p)) : 'لا يوجد'}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => nav(`${p.id}`)}>
                          <FolderOpen size={14} />
                          الملف
                        </Button>
                        {!doctorMode && (
                          <Button size="sm" variant="ghost" onClick={() => nav(`${p.id}?edit=1`)}>
                            <PencilLine size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((p) => (
                <li key={p.id}>
                  <button onClick={() => nav(`${p.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
                    <Avatar name={p.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{p.full_name}</p>
                      <p className="text-xs text-slate-500">
                        <span dir="ltr">{p.phone}</span>
                        {p.date_of_birth ? ` · ${ageFrom(p.date_of_birth)} سنة · ${genderLabel(p.gender)}` : ''}
                      </p>
                    </div>
                    <FolderOpen size={16} className="text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <PatientFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  )
}
