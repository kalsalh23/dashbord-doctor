import { useEffect, useState } from 'react'
import { Activity, Loader2, MessageCircle, FolderOpen } from 'lucide-react'
import { useApp } from '../lib/store'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LOGIN_SUPPORT_MESSAGE, supportWhatsAppLink, SUPPORT_WHATSAPP, DEVELOPER_NAME, DEVELOPER_PHONE } from '../lib/config'

export default function Login() {
  const { login, session, effectiveRole } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [noAccounts, setNoAccounts] = useState(false)
  const nav = useNavigate()

  // في النسخة المحلية: إن لم تكن هناك حسابات على هذا الجهاز فهذا يعني أن ملف
  // بيانات العيادة (clinic-data.json) غير موجود بجانب التطبيق — نرشد المستخدم فوراً
  useEffect(() => {
    if (!supabase.__local) return
    let alive = true
    import('../lib/local/client')
      .then(({ localReady }) => localReady)
      .then(() => supabase.from('__users').select('id').limit(1))
      .then(({ data }) => {
        if (alive && (!data || data.length === 0)) setNoAccounts(true)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (session) return <Navigate to={effectiveRole === 'doctor' ? '/doctor' : '/reception'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      // navigation happens through HomeRedirect after session settles
      nav('/', { replace: true })
    } catch (err) {
      setError(
        err?.message?.includes('Invalid login')
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : 'تعذر تسجيل الدخول، حاول مرة أخرى'
      )
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-700 text-white shadow-md">
            <Activity size={28} />
          </span>
          <h1 className="text-lg font-bold text-slate-800">نظام إدارة العيادة</h1>
          <p className="mt-1 text-xs text-slate-500">سجّل الدخول للمتابعة إلى مساحة عمل العيادة</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
          autoComplete="on"
        >
          <label className="label-base" htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            dir="ltr"
            className="input-base mb-4 text-left"
            placeholder="name@clinic.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />

          <label className="label-base" htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            dir="ltr"
            className="input-base mb-2 text-left"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {noAccounts && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900">
              <FolderOpen size={16} className="mt-0.5 shrink-0" />
              <span>
                لا توجد حسابات على هذا الجهاز بعد. ضع ملف بيانات العيادة الذي استلمته{' '}
                <span dir="ltr" className="font-bold">(clinic-data...json)</span>{' '}
                في نفس مجلد التطبيق ثم أعد فتحه. إن لم يصلك الملف فتواصل مع إدارة النظام.
              </span>
            </div>
          )}

          {error && (
            <p className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-700 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            تسجيل الدخول
          </button>

          <a
            href={supportWhatsAppLink(LOGIN_SUPPORT_MESSAGE(email.trim()))}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <MessageCircle size={15} />
            نسيت الحساب أو كلمة المرور؟ تواصل مع الدعم عبر واتساب
          </a>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[11px] text-slate-400">
            الوصول محمي — جميع البيانات مخصصة لعيادتك فقط
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            تطوير: <span className="font-semibold text-slate-500">{DEVELOPER_NAME}</span>
            {' · '}
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-slate-400 underline decoration-slate-200 hover:text-primary-700">
              {DEVELOPER_PHONE}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
