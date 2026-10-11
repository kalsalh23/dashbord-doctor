import { useState } from 'react'
import { Repeat2, LogIn, Trash2, Info } from 'lucide-react'
import { Button, Modal } from './ui'
import { useApp } from '../lib/store'
import { otherAccounts, forgetAccount, switchToAccount } from '../lib/accountSwitch'
import { specialtyLabel } from '../lib/specialties'

/**
 * زر «تبديل الحساب» — للتنقل بين حسابي الطبيبين على نفس الجهاز
 * (مثل عيادة الدكتور محمد عارف والدكتورة ريام: تطبيق واحد ولكل حساب لوحته وبياناته).
 */
export default function AccountSwitcher({ className = '' }) {
  const { session, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [busy, setBusy] = useState(null)

  const openMenu = () => {
    setAccounts(otherAccounts(session?.user?.id))
    setOpen(true)
  }

  const switchTo = async (acc) => {
    setBusy(acc.id)
    const res = await switchToAccount(acc)
    if (!res.ok) {
      toast('error', 'تعذر التبديل — سجّل الدخول بهذا الحساب مرة أخرى')
      setBusy(null)
    }
  }

  const remove = (acc) => {
    forgetAccount(acc.id)
    setAccounts((list) => list.filter((a) => a.id !== acc.id))
  }

  return (
    <>
      <Button variant="secondary" className={className} onClick={openMenu} title="التنقل بين حسابي الدكتور والدكتورة">
        <Repeat2 size={16} />
        تبديل الحساب
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="تبديل الحساب" subtitle="اختر الحساب الذي تريد الانتقال إليه — كل حساب بلوحته وبياناته المستقلة">
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <Info size={15} className="mb-1 inline" /> لا توجد حسابات أخرى محفوظة على هذا الجهاز.
            سجّل الدخول بالحساب الآخر مرة واحدة (ثم ارجع لهذا الحساب) ليظهر هنا ويصبح التبديل بضغطة واحدة.
          </div>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{a.name || a.email}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {a.clinic || '—'}
                    {a.specialty ? ` · ${specialtyLabel(a.specialty)}` : ''}
                  </p>
                </div>
                <Button size="sm" loading={busy === a.id} onClick={() => switchTo(a)}>
                  <LogIn size={14} />
                  دخول
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(a)} title="إزالة من القائمة">
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  )
}
