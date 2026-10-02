import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Shield, Plus, Building2, UserPlus, KeyRound, Power, PencilLine, Users as UsersIcon,
  CalendarDays, Repeat, Activity, Search,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import {
  Button, Card, Field, Input, Select, Modal, ConfirmDialog, Badge, EmptyState, Spinner,
  PageHeader, Tag, SearchInput,
} from '../../components/ui'
import { money, formatDateShort } from '../../lib/format'
import { friendlyDbError } from '../../lib/hooks'
import { SPECIALTIES } from '../../lib/specialties'

const ROLE_BADGE = {
  doctor: { label: 'طبيب', cls: 'bg-teal-50 text-teal-800 border-teal-200' },
  reception: { label: 'استقبال', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  admin: { label: 'مدير العيادة', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  super_admin: { label: 'مدير النظام', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}


const EMPTY_CLINIC_FORM = {
  name: '', specialty_key: 'general', phone: '', address: '', doctor_name: '', consultation_price: 0,
}
const EMPTY_USER_FORM = { full_name: '', email: '', password: '', phone: '', role: 'doctor', specialty_key: 'general' }

export default function SuperPanel() {
  const { profile, toast } = useApp()
  const [clinics, setClinics] = useState(null)
  const [stats, setStats] = useState([])
  const [usersByClinic, setUsersByClinic] = useState({})
  const [q, setQ] = useState('')

  const [clinicModal, setClinicModal] = useState(null) // null | {form} | {form, editing}
  const [clinicForm, setClinicForm] = useState(EMPTY_CLINIC_FORM)
  const [savingClinic, setSavingClinic] = useState(false)

  const [userModalFor, setUserModalFor] = useState(null) // clinic row
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)
  const [savingUser, setSavingUser] = useState(false)

  const [pwModalFor, setPwModalFor] = useState(null) // user row
  const [newPassword, setNewPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const [confirmToggle, setConfirmToggle] = useState(null) // clinic row
  const [busyToggle, setBusyToggle] = useState(false)

  const load = useCallback(async () => {
    const [cRes, stRes] = await Promise.all([
      supabase.from('clinics').select('*').order('created_at', { ascending: false }),
      supabase.rpc('super_clinic_stats'),
    ])
    const list = cRes.data || []
    setClinics(list)
    const statsMap = {}
    for (const row of stRes.data || []) statsMap[row.clinic_id] = row
    setStats(statsMap)
    const usersRes = await Promise.all(
      list.map((c) => supabase.rpc('super_list_users', { p_clinic_id: c.id }))
    )
    const map = {}
    list.forEach((c, i) => {
      map[c.id] = usersRes[i].data || []
    })
    setUsersByClinic(map)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => {
    const term = q.trim()
    if (!term) return clinics || []
    return (clinics || []).filter(
      (c) => c.name.includes(term) || (c.specialty || '').includes(term) || (c.phone || '').includes(term)
    )
  }, [clinics, q])

  /* ---------- clinic create / edit ---------- */
  const openClinicModal = (clinic) => {
    setClinicForm(
      clinic
        ? {
            name: clinic.name || '',
            specialty_key: clinic.specialty_key || 'general',
            phone: clinic.phone || '',
            address: clinic.address || '',
            doctor_name: '',
            consultation_price: 0,
          }
        : { ...EMPTY_CLINIC_FORM }
    )
    setClinicModal(clinic ? { editing: clinic } : {})
  }

  const saveClinic = async () => {
    if (!clinicForm.name.trim()) return toast('error', 'اسم العيادة مطلوب')
    setSavingClinic(true)
    try {
      if (clinicModal?.editing) {
        const specLabel = SPECIALTIES.find((s) => s.key === clinicForm.specialty_key)?.label || ''
        const { error } = await supabase
          .from('clinics')
          .update({
            name: clinicForm.name.trim(),
            specialty: clinicForm.specialty_key === 'general' ? (clinicModal.editing.specialty || specLabel) : specLabel,
            specialty_key: clinicForm.specialty_key,
            phone: clinicForm.phone.trim() || null,
            address: clinicForm.address.trim() || null,
          })
          .eq('id', clinicModal.editing.id)
        if (error) throw error
      } else {
        const specLabel = SPECIALTIES.find((s) => s.key === clinicForm.specialty_key)?.label || ''
        const { data, error } = await supabase.rpc('super_create_clinic', {
          p_name: clinicForm.name.trim(),
          p_specialty: specLabel,
          p_phone: clinicForm.phone.trim() || null,
          p_address: clinicForm.address.trim() || null,
          p_consultation_price: Number(clinicForm.consultation_price) || 0,
          p_doctor_name: clinicForm.doctor_name.trim() || null,
          p_specialty_key: clinicForm.specialty_key,
        })
        if (error) throw error
        toast('success', 'تم إنشاء العيادة بنجاح — أضف الآن حساب الطبيب')
      }
      setClinicModal(null)
      load()
    } catch (e) {
      toast('error', friendlyDbError(e))
    } finally {
      setSavingClinic(false)
    }
  }

  /* ---------- user create ---------- */
  const saveUser = async () => {
    const f = userForm
    if (!f.full_name.trim() || !f.email.trim() || !f.password) {
      return toast('error', 'الاسم والبريد وكلمة المرور مطلوبة')
    }
    if (f.password.length < 6) return toast('error', 'كلمة المرور 6 أحرف على الأقل')
    setSavingUser(true)
    try {
      const { error } = await supabase.rpc('super_create_user', {
        p_email: f.email.trim(),
        p_password: f.password,
        p_full_name: f.full_name.trim(),
        p_role: f.role,
        p_clinic_id: userModalFor.id,
        p_phone: f.phone.trim() || null,
        p_specialty_key: f.role === 'doctor' ? f.specialty_key : 'general',
      })
      if (error) throw error
      toast('success', `تم إنشاء حساب ${f.role === 'doctor' ? 'الطبيب' : 'الموظف'} — سلّم البريد وكلمة المرور للعيادة`)
      setUserModalFor(null)
      setUserForm(EMPTY_USER_FORM)
      load()
    } catch (e) {
      toast('error', friendlyDbError(e))
    } finally {
      setSavingUser(false)
    }
  }

  /* ---------- password reset ---------- */
  const savePassword = async () => {
    if (!newPassword || newPassword.length < 6) return toast('error', 'كلمة المرور 6 أحرف على الأقل')
    setSavingPw(true)
    try {
      const { error } = await supabase.rpc('super_reset_password', {
        p_user_id: pwModalFor.id,
        p_new_password: newPassword,
      })
      if (error) throw error
      toast('success', 'تم تحديث كلمة المرور')
      setPwModalFor(null)
      setNewPassword('')
    } catch (e) {
      toast('error', friendlyDbError(e))
    } finally {
      setSavingPw(false)
    }
  }

  /* ---------- activate / deactivate ---------- */
  const toggleClinic = async () => {
    const c = confirmToggle
    if (!c) return
    setBusyToggle(true)
    const { error } = await supabase.from('clinics').update({ is_active: !c.is_active }).eq('id', c.id)
    setBusyToggle(false)
    setConfirmToggle(null)
    if (error) return toast('error', friendlyDbError(error))
    toast('success', c.is_active ? 'تم إيقاف العيادة' : 'تم تنشيط العيادة')
    load()
  }

  if (clinics === null) return <Spinner />

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="لوحة إدارة النظام"
        subtitle="إنشاء العيادات وحسابات الأطباء وإدارتها"
        actions={
          <Button onClick={() => openClinicModal(null)}>
            <Plus size={16} />
            عيادة جديدة
          </Button>
        }
      />

      <div className="mb-4">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن عيادة بالاسم أو التخصص..." />
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title={q ? 'لا توجد نتائج' : 'لا توجد عيادات بعد'}
            message={q ? 'جرّب كلمة بحث أخرى' : 'ابدأ بإنشاء أول عيادة ثم أضف حساب طبيب لها'}
            action={!q && <Button size="sm" onClick={() => openClinicModal(null)}>إنشاء عيادة</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((c) => {
            const st = stats[c.id] || {}
            const users = usersByClinic[c.id] || []
            return (
              <Card key={c.id} bodyClass="!p-0">
                {/* clinic header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.is_active ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-400'}`}>
                      <Building2 size={20} />
                    </span>
                    <div>
                      <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        {c.name}
                        <Badge
                          map={{
                            a: { label: 'نشطة', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            b: { label: 'موقوفة', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
                          }}
                          value={c.is_active ? 'a' : 'b'}
                        />
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {c.specialty || '—'}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => openClinicModal(c)} title="تعديل بيانات العيادة">
                      <PencilLine size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant={c.is_active ? 'dangerGhost' : 'success'}
                      onClick={() => setConfirmToggle(c)}
                    >
                      <Power size={14} />
                      {c.is_active ? 'إيقاف' : 'تشغيل'}
                    </Button>
                  </div>
                </div>

                {/* stats */}
                <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 border-b border-slate-100 text-center">
                  <div className="px-3 py-3">
                    <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                      <UsersIcon size={12} />
                      المرضى
                    </p>
                    <p className="mt-0.5 text-base font-bold text-slate-800">{Number(st.patients ?? 0)}</p>
                  </div>
                  <div className="px-3 py-3">
                    <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                      <CalendarDays size={12} />
                      مواعيد اليوم
                    </p>
                    <p className="mt-0.5 text-base font-bold text-slate-800">{Number(st.appointments_today ?? 0)}</p>
                  </div>
                  <div className="px-3 py-3">
                    <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                      <Repeat size={12} />
                      متابعات معلقة
                    </p>
                    <p className="mt-0.5 text-base font-bold text-slate-800">{Number(st.pending_followups ?? 0)}</p>
                  </div>
                </div>

                {/* staff */}
                <div className="px-4 py-3 sm:px-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-600">حسابات العيادة</p>
                    <Button size="sm" onClick={() => { setUserModalFor(c); setUserForm({ ...EMPTY_USER_FORM }) }}>
                      <UserPlus size={13} />
                      إضافة حساب
                    </Button>
                  </div>
                  {users.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
                      لا توجد حسابات بعد — أضف طبيبًا وموظف استقبال
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {users.map((u) => (
                        <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                              {u.full_name}
                              <Badge map={ROLE_BADGE} value={u.role} />
                              {u.role === 'doctor' && u.specialty_key && u.specialty_key !== 'general' && (
                                <Tag tone="teal">{SPECIALTIES.find((s) => s.key === u.specialty_key)?.label || u.specialty_key}</Tag>
                              )}
                              {u.id === profile.id && <Tag>أنت</Tag>}
                            </p>
                            <p className="text-[11px] text-slate-400" dir="ltr">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                          </div>
                          <Button size="sm" variant="secondary" onClick={() => { setPwModalFor(u); setNewPassword('') }}>
                            <KeyRound size={13} />
                            كلمة المرور
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* create / edit clinic */}
      <Modal
        open={!!clinicModal}
        onClose={() => setClinicModal(null)}
        title={clinicModal?.editing ? 'تعديل بيانات العيادة' : 'عيادة جديدة'}
        subtitle={clinicModal?.editing ? undefined : 'ستُنشأ العيادة بإعدادات وساعات عمل افتراضية قابلة للتعديل'}
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={saveClinic} loading={savingClinic}>
              {clinicModal?.editing ? 'حفظ التعديلات' : 'إنشاء العيادة'}
            </Button>
            <Button variant="secondary" onClick={() => setClinicModal(null)} disabled={savingClinic}>إلغاء</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="اسم العيادة" required className="sm:col-span-2">
            <Input value={clinicForm.name} onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })} placeholder="مثال: عيادة د. أحمد السالم" />
          </Field>
          <Field label="اسم الطبيب" hint="يظهر في رسائل التذكير">
            <Input value={clinicForm.doctor_name} onChange={(e) => setClinicForm({ ...clinicForm, doctor_name: e.target.value })} placeholder="د. ..." />
          </Field>
          <Field label="التخصص" hint="يحدد أدوات الواجهة الخاصة بالعيادة">
            <Select value={clinicForm.specialty_key} onChange={(e) => setClinicForm({ ...clinicForm, specialty_key: e.target.value })}>
              {SPECIALTIES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="هاتف العيادة">
            <Input value={clinicForm.phone} onChange={(e) => setClinicForm({ ...clinicForm, phone: e.target.value })} dir="ltr" />
          </Field>
          {!clinicModal?.editing && (
            <Field label="سعر الكشف">
              <Input type="number" min="0" value={clinicForm.consultation_price} onChange={(e) => setClinicForm({ ...clinicForm, consultation_price: e.target.value })} />
            </Field>
          )}
          <Field label="العنوان" className="sm:col-span-2">
            <Input value={clinicForm.address} onChange={(e) => setClinicForm({ ...clinicForm, address: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* add staff user */}
      <Modal
        open={!!userModalFor}
        onClose={() => setUserModalFor(null)}
        title="إضافة حساب للعيادة"
        subtitle={userModalFor?.name}
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={saveUser} loading={savingUser}>إنشاء الحساب</Button>
            <Button variant="secondary" onClick={() => setUserModalFor(null)} disabled={savingUser}>إلغاء</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="نوع الحساب" required className="sm:col-span-2">
            <Select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="doctor">طبيب</option>
              <option value="reception">موظف استقبال</option>
              <option value="admin">مدير عيادة (وصول كامل لعيادته)</option>
            </Select>
          </Field>
          {userForm.role === 'doctor' && (
            <Field label="اختصاص الطبيب" required hint="يحدد لوحته والأدوات التي تظهر له (مثل مخطط الأسنان)" className="sm:col-span-2">
              <Select value={userForm.specialty_key} onChange={(e) => setUserForm({ ...userForm, specialty_key: e.target.value })}>
                {SPECIALTIES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="الاسم الكامل" required className="sm:col-span-2">
            <Input value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} placeholder="د. أحمد السالم" />
          </Field>
          <Field label="البريد الإلكتروني" required hint="يُستخدم لتسجيل الدخول">
            <Input type="email" dir="ltr" className="text-left" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="doctor@clinic.com" />
          </Field>
          <Field label="كلمة المرور" required hint="6 أحرف على الأقل — سلّمها للعيادة">
            <Input dir="ltr" className="text-left" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="••••••••" />
          </Field>
          <Field label="رقم الهاتف">
            <Input dir="ltr" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* reset password */}
      <Modal
        open={!!pwModalFor}
        onClose={() => setPwModalFor(null)}
        title="كلمة مرور جديدة"
        subtitle={pwModalFor?.full_name + ' — ' + pwModalFor?.email}
        footer={
          <div className="flex justify-start gap-2">
            <Button onClick={savePassword} loading={savingPw}>تحديث كلمة المرور</Button>
            <Button variant="secondary" onClick={() => setPwModalFor(null)} disabled={savingPw}>إلغاء</Button>
          </div>
        }
      >
        <Field label="كلمة المرور الجديدة" required hint="6 أحرف على الأقل">
          <Input dir="ltr" className="text-left" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
        </Field>
      </Modal>

      {/* suspend confirm */}
      <ConfirmDialog
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        title={confirmToggle?.is_active ? 'إيقاف العيادة' : 'تنشيط العيادة'}
        message={
          confirmToggle?.is_active
            ? `سيتم منع جميع حسابات عيادة «${confirmToggle?.name}» من الوصول للنظام فورًا. لن يتم حذف أي بيانات.`
            : `سيتم إعادة تمكين الوصول لحسابات عيادة «${confirmToggle?.name}».`
        }
        confirmLabel={confirmToggle?.is_active ? 'نعم، إيقاف' : 'نعم، تشغيل'}
        danger={confirmToggle?.is_active}
        loading={busyToggle}
        onConfirm={toggleClinic}
      />
    </div>
  )
}
