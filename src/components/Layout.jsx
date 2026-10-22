import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, Users, Wallet, Repeat, Settings, Stethoscope,
  Bell, LogOut, Menu, X, MoreHorizontal, Activity, Shield, FileText, Pill, Printer, Receipt,
  NotebookPen, Banknote, ArrowRight, ScanSearch, Clock,
} from 'lucide-react'
import { useApp } from '../lib/store'
import { supabase } from '../lib/supabase'
import { APP_SCOPE } from '../lib/scope'
import {
  isNizarStyle, hidesPatientsPage, hidesFavorites, clinicThemeClass, hidesAccountSwitcher, usesLoudAlerts,
  clinicFatimaThemeClass, isFatimaClinic, FATIMA_DOCTOR_NAV_ORDER, FATIMA_SHORT_CLINIC_NAME,
  clinicFadwaThemeClass, isFadwaClinic, clinicRanimThemeClass, isRanimClinic,
  RANIM_DOCTOR_NAV_ORDER, RANIM_SHORT_CLINIC_NAME,
} from '../lib/clinicStyle'
import { playAlert, unlockAudio } from '../lib/alert'
import AccountSwitcher from './AccountSwitcher'
import { DEVELOPER_NAME } from '../lib/config'
import { Avatar, Badge } from './ui'
import { todayStr, formatDateLong } from '../lib/format'

const NAV = {
  reception: [
    { to: '/reception', label: 'الرئيسية', icon: LayoutDashboard, end: true },
    { to: '/reception/appointments', label: 'المواعيد', icon: CalendarDays },
    { to: '/reception/patients', label: 'المرضى', icon: Users },
    { to: '/reception/payments', label: 'المدفوعات', icon: Wallet },
    { to: '/reception/follow-ups', label: 'طلبات المتابعة', icon: Repeat, badge: 'followUps' },
    { to: '/reception/settings', label: 'الإعدادات', icon: Settings, adminOnly: true },
  ],
  doctor: [
    { to: '/doctor', label: 'لوحة اليوم', icon: LayoutDashboard, end: true },
    { to: '/doctor/schedule', label: 'جدول المواعيد', icon: CalendarDays },
    { to: '/doctor/patients', label: 'المرضى', icon: Users },
    { to: '/doctor/expenses', label: 'المصاريف', icon: Receipt },
    { to: '/doctor/archive', label: 'أرشيف المرضى', icon: FileText },
    { to: '/doctor/today-log', label: 'سجلي اليوم', icon: NotebookPen },
    { to: '/doctor/payments', label: 'الدفعات', icon: Banknote },
    { to: '/doctor/favorites', label: 'أدويتي الشائعة', icon: Pill },
    { to: '/doctor/settings', label: 'إعداداتي', icon: Settings },
  ],
  super: [
    { to: '/super', label: 'لوحة إدارة النظام', icon: Shield, end: true },
  ],
}

/**
 * وسم الإشعار — مشتق من نصّه (عنوان + نص) ليعمل بالطريقة نفسها في المتصفح
 * وفي عامل الخدمة (public/sw.js). النتيجة: نفس الحدث لا يتكدّس مرّتين على الشاشة.
 */
export function notificationTag(title, body) {
  const key = String(title || '') + '|' + String(body || '')
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return 'clinic-' + Math.abs(hash)
}

function useOutsideClose(ref, onClose) {  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [ref, onClose])
}

function NotificationsBell({ panelTop = 'top-11' }) {
  const { profile, effectiveRole } = useApp()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const seenRef = useRef(null) // معرّفات الإشعارات المعروضة — لتمييز الجديد وتشغيل الصوت
  const swAlertRef = useRef(0) // وقت آخر إشعار وصل عبر web push — يمنع تكرار الصوت
  const ref = useRef(null)
  const nav = useNavigate()
  useOutsideClose(ref, () => setOpen(false))
  // نغمة عالية وطويلة في عيادات الصالات الصاخبة (د. عارف ود. ريام)
  const loud = usesLoudAlerts(profile)

  const load = async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15)
    const list = data || []
    setItems(list)
    // إشعار جديد → تنبيه صوتي داخل التطبيق (حجز جديد، رسالة، حالة إسعافية)
    const ids = list.map((n) => n.id)
    if (seenRef.current !== null) {
      const fresh = list.filter((n) => !seenRef.current.includes(n.id))
      if (fresh.length > 0) {
        const isEmergency = fresh.some((n) => n.type === 'cancellation' || (n.title || '').includes('إسعاف'))
        // منع التكرار: نفس الإشعار قد يصل من قناتين (قاعدة البيانات + web push)
        // نُبقي نسخة واحدة فقط لكل نص إشعار
        const uniqueFresh = []
        const seenText = new Set()
        for (const n of fresh) {
          const key = `${n.type || ''}|${(n.title || '').trim()}|${(n.body || '').trim()}`
          if (seenText.has(key)) continue
          seenText.add(key)
          uniqueFresh.push(n)
        }
        // إن سبق أن وصل الإشعار عبر web push (عامل الخدمة) فلا نعيد الصوت ولا نكرر إشعار النظام
        const pushJustNow = Date.now() - swAlertRef.current < 20000
        if (!pushJustNow) playAlert(isEmergency ? 'emergency' : 'new', { loud })
        // إشعار مجاني من داخل المتصفح — يظهر أعلى الشاشة مع نغمة النظام
        try {
          if (!pushJustNow && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const n = uniqueFresh[0]
            const bn = new Notification(n.title || 'إشعار جديد', {
              body: n.body || '',
              dir: 'rtl',
              lang: 'ar',
              tag: notificationTag(n.title, n.body),
              icon: '/favicon.svg',
            })
            bn.onclick = () => {
              window.focus()
              if (n.link) nav(n.link)
            }
          }
        } catch {
          /* المتصفح لا يدعم إشعارات الويب */
        }
      }
    }
    seenRef.current = ids
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    // أول لمسة تفتح قناة الصوت للتنبيهات (سياسة المتصفحات)
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    // إشعار خارجي وصل والتطبيق مفتوح → شغّل النغمة الداخلية أيضاً
    const onSwMessage = (e) => {
      if (e.data?.type === 'clinic-alert') {
        swAlertRef.current = Date.now()
        playAlert(e.data.kind === 'emergency' ? 'emergency' : 'new', { loud })
      }
    }
    navigator.serviceWorker?.addEventListener('message', onSwMessage)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pointerdown', unlock)
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.clinic_id, effectiveRole])

  const unread = items.filter((n) => !n.is_read).length

  const markAll = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    load()
  }

  const onItemClick = async (n) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setOpen(false)
    load()
    if (n.link) nav(n.link)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="الإشعارات"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute end-0 ${panelTop} z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-bold text-slate-700">الإشعارات</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] font-semibold text-primary-700 hover:underline">
                تحديد الكمقروء
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-400">لا توجد إشعارات</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => onItemClick(n)}
                className={`block w-full border-b border-slate-50 px-4 py-3 text-start hover:bg-slate-50 ${!n.is_read ? 'bg-primary-50/40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {!n.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />}
                  <span className="text-xs font-bold text-slate-700">{n.title}</span>
                </div>
                {n.body && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{n.body}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu({ inline }) {
  const { profile, logout, isSuper, isAdmin, mode, switchMode } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const nav = useNavigate()
  const loc = useLocation()
  useOutsideClose(ref, () => setOpen(false))
  const roleLabel = isSuper ? 'مدير النظام' : isAdmin ? 'مدير العيادة' : mode === 'doctor' ? 'طبيب' : 'استقبال'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-slate-100"
      >
        <Avatar name={profile?.full_name} src={profile?.avatar_url} className="h-8 w-8 text-xs" />
        <span className="hidden text-start sm:block">
          <span className="block max-w-36 truncate text-xs font-bold text-slate-700">{profile?.full_name}</span>
          <span className="block text-[10px] text-slate-400">{roleLabel}</span>
        </span>
      </button>
      {open && (
        <div className={`absolute end-0 z-40 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ${inline ? 'bottom-12' : 'top-12'}`}>
          {(isSuper || isAdmin) && APP_SCOPE !== 'owner' && (
            <>
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold text-slate-400">واجهة العمل</div>
              {[
                ...(isSuper ? [{ m: 'super', label: 'لوحة إدارة النظام', super: true }] : []),
                { m: 'reception', label: 'واجهة الاستقبال' },
                { m: 'doctor', label: 'واجهة الطبيب' },
              ].map((o) => (
                <button
                  key={o.m}
                  onClick={() => {
                    if (o.super) {
                      setOpen(false)
                      nav('/super')
                    } else {
                      switchMode(o.m)
                      setOpen(false)
                      nav(o.m === 'doctor' ? '/doctor' : '/reception')
                    }
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 ${
                    (o.super && loc.pathname.startsWith('/super')) || (!o.super && mode === o.m) ? 'font-bold text-primary-700' : 'text-slate-600'
                  }`}
                >
                  {o.label}
                </button>
              ))}
              <div className="my-1 border-t border-slate-100" />
            </>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={14} />
            تسجيل الخروج
          </button>
        </div>
      )}
    </div>
  )
}

function Brand({ mobile = false }) {
  const { profile } = useApp()
  if (APP_SCOPE === 'owner') {
    return (
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm">
          <Shield size={18} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-800">لوحة إدارة المنصة</div>
          <div className="text-[10px] text-slate-400">إدارة العيادات والحسابات</div>
        </div>
      </div>
    )
  }
  // عيادة الدكتورة فاطمة: الاسم الكامل طويل («عيادة الدكتورة فاطمة سالم الجاموس»)
  // فيملأ الشريط العلوي على الجوال ويقصّ أزرار الإشعارات والحساب —
  // فيُعرض مختصراً وبسطر واحد، والشريط أخصر.
  const fatima = isFatimaClinic(profile)
  // عيادة الدكتورة رنيم: نفس الفكرة — الاسم مختصر على الجوال
  const ranim = isRanimClinic(profile)
  const compact = mobile && (fatima || ranim)
  const clinicName = compact
    ? fatima
      ? FATIMA_SHORT_CLINIC_NAME
      : RANIM_SHORT_CLINIC_NAME
    : (profile?.clinic?.name || 'نظام إدارة العيادة')
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className={`clinic-brand flex shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white shadow-sm ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}>
        <Activity size={compact ? 17 : 19} />
      </span>
      <div className="min-w-0">
        <div className={`truncate font-bold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>{clinicName}</div>
        <div className={`truncate text-[10px] text-slate-400 ${compact ? 'hidden sm:block' : ''}`}>
          {profile?.clinic?.specialty || 'إدارة العيادات الطبية'}
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { effectiveRole, profile, logout, isSuper, isAdmin, settings } = useApp()
  const [mobileMore, setMobileMore] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  // زر الرجوع يظهر في كل الصفحات عدا الصفحات الرئيسية لكل واجهة
  const isHomePage = ['/', '/reception', '/doctor', '/super'].includes(loc.pathname)
  let navItems = NAV[effectiveRole] || NAV.reception
  if (APP_SCOPE === 'owner') {
    navItems = NAV.super
  } else {
    navItems = navItems.filter((i) => isAdmin || !i.adminOnly)
  }
  // عيادات الأسنان: أدواتها الخاصة — أسعاري، سجلي اليوم، الدفعات
  const isDental = (profile?.specialty_key || profile?.clinic?.specialty_key) === 'dentistry'
  // اختصاص الأنف والأذن والحنجرة: واجهة كشف برسومات خاصة + أدوات مالية
  const isEnt = (profile?.specialty_key || profile?.clinic?.specialty_key) === 'ent'
  if (APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isDental) {
    navItems = [
      { to: '/doctor', label: 'لوحة اليوم', icon: LayoutDashboard, end: true },
      { to: '/doctor/schedule', label: 'جدول المواعيد', icon: CalendarDays },
      { to: '/doctor/patients', label: 'المرضى', icon: Users },
      { to: '/doctor/archive', label: 'أرشيف المرضى', icon: FileText },
      { to: '/doctor/prices', label: 'أسعاري', icon: Wallet },
      { to: '/doctor/today-log', label: 'سجلي اليوم', icon: NotebookPen },
      { to: '/doctor/payments', label: 'الدفعات', icon: Banknote },
      { to: '/doctor/favorites', label: 'أدويتي الشائعة', icon: Pill },
      { to: '/doctor/settings', label: 'إعداداتي', icon: Settings },
    ]
  } else if (APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isEnt) {
    navItems = [
      { to: '/doctor', label: 'لوحة اليوم', icon: LayoutDashboard, end: true },
      { to: '/doctor/schedule', label: 'جدول المواعيد', icon: CalendarDays },
      { to: '/doctor/patients', label: 'المرضى', icon: Users },
      { to: '/doctor/archive', label: 'أرشيف المرضى', icon: FileText },
      { to: '/doctor/today-log', label: 'سجلي اليوم', icon: NotebookPen },
      { to: '/doctor/payments', label: 'الدفعات', icon: Banknote },
      { to: '/doctor/favorites', label: 'أدويتي الشائعة', icon: Pill },
      { to: '/doctor/settings', label: 'إعداداتي', icon: Settings },
    ]
  }
  // عيادة د. نزار (قالب nizar): بلا واجهة مدفوعات — وأضيفت واجهة المعاينة (صور المعاينات الورقية)
  const isNizar = settings?.prescription_template === 'nizar'
  if (APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isNizar) {
    navItems = [
      { to: '/doctor', label: 'لوحة اليوم', icon: LayoutDashboard, end: true },
      { to: '/doctor/schedule', label: 'جدول المواعيد', icon: CalendarDays },
      { to: '/doctor/hours', label: 'أوقات دوامي', icon: Clock },
      { to: '/doctor/exam', label: 'المعاينة', icon: ScanSearch },
      { to: '/doctor/patients', label: 'المرضى', icon: Users },
      { to: '/doctor/archive', label: 'الأرشفة', icon: FileText },
      { to: '/doctor/expenses', label: 'المصاريف', icon: Receipt },
      { to: '/doctor/favorites', label: 'أدويتي الشائعة', icon: Pill },
      { to: '/doctor/settings', label: 'إعداداتي', icon: Settings },
    ]
  } else if (APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isNizarStyle(profile, settings)) {
    // عيادات أسلوب نizar مع قالب مختلف (مثل عيادة د. ريام): تُضاف «أوقات دوامي» بعد جدول المواعيد
    const hoursItem = { to: '/doctor/hours', label: 'أوقات دوامي', icon: Clock }
    const at = navItems.findIndex((i) => i.to === '/doctor/schedule')
    navItems = at >= 0 ? [...navItems.slice(0, at + 1), hoursItem, ...navItems.slice(at + 1)] : [hoursItem, ...navItems]
  }
  // عيادة د. فدوى: واجهة «أوقات دوامي» بعد جدول المواعيد — تحدّد أيام الدوام وأوقاتها (تُبنى منها الحجوزات)
  if (APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isFadwaClinic(profile)) {
    const hoursItem = { to: '/doctor/hours', label: 'أوقات دوامي', icon: Clock }
    const at = navItems.findIndex((i) => i.to === '/doctor/schedule')
    navItems = at >= 0 ? [...navItems.slice(0, at + 1), hoursItem, ...navItems.slice(at + 1)] : [hoursItem, ...navItems]
  }
  // عيادة الدكتورة رنيم النبهان: ترتيب واجهات فريد لها وحدها
  if (APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isRanimClinic(profile)) {
    const byPath = Object.fromEntries(navItems.map((i) => [i.to, i]))
    navItems = RANIM_DOCTOR_NAV_ORDER.map((path) => byPath[path]).filter(Boolean)
  }
  // عيادة الدكتورة فاطمة: ترتيب واجهات فريد لها وحدها
  if (APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isFatimaClinic(profile)) {
    const byPath = Object.fromEntries(navItems.map((i) => [i.to, i]))
    // واجهة «أوقات دوامي» — تحدّد أيام الدوام وأوقاتها التي تُبنى منها مواعيد الحجز
    byPath['/doctor/hours'] = { to: '/doctor/hours', label: 'أوقات دوامي', icon: Clock }
    navItems = FATIMA_DOCTOR_NAV_ORDER.map((path) => byPath[path]).filter(Boolean)
  }
  // مدير النظام وهو داخل لوحة الإدارة: يرى قائمة اللوحة فقط
  if (APP_SCOPE !== 'owner' && isSuper && loc.pathname.startsWith('/super')) {
    navItems = NAV.super
  }
  // عيادة الدكتورة فاطمة: إزالة واجهة المرضى واستبدال «أدويتي الشائعة» بـ «علاجاتي»
  if (APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isFatimaClinic(profile)) {
    navItems = navItems.filter((i) => i.to !== '/doctor/patients')
    const favIdx = navItems.findIndex((i) => i.to === '/doctor/favorites')
    if (favIdx >= 0) {
      navItems = [
        ...navItems.slice(0, favIdx),
        { to: '/doctor/treatments', label: 'علاجاتي', icon: Pill },
        ...navItems.slice(favIdx + 1),
      ]
    }
  }
  // عيادات لا تحتاج واجهة «المرضى» (عيادتا الدكتور عارف والدكتورة ريام)
  if (hidesPatientsPage(profile)) {
    navItems = navItems.filter((i) => i.to !== '/doctor/patients')
  }
  // عيادات لا تحتاج «أدويتي الشائعة» — تُستبدل بـ«أوقات دوامي»
  if (hidesFavorites(profile) && !isFatimaClinic(profile)) {
    navItems = navItems.filter((i) => i.to !== '/doctor/favorites')
  }
  const mobileMain = navItems.slice(0, 4)
  const mobileMoreItems = navItems.slice(4)

  useEffect(() => {
    setMobileMore(false)
    window.scrollTo(0, 0)
  }, [loc.pathname])

  if (!profile) return null

  const linkCls = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
      isActive ? 'bg-primary-50 text-primary-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
    }`

  // عيادات الأسنان: شريط تنقل علوي أفقي بدل الجانبي — كما في برامج الأسنان
  const isDentalNav = APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isDental
  // عيادة النساء والتوليد: شريط حبّات عائم (زجاجي) بدل الشريط الجانبي — تصميم خاص بها
  const isObgynNav = APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && isRanimClinic(profile)
  // لوحة ألوان العيادة — اللون فقط: الفيروزي لعيادة د. عارف، البرقوقي لبقية العيادات
  const themeClass = clinicThemeClass(profile)
  const fatimaThemeClass = clinicFatimaThemeClass(profile)
  // عيادة الدكتورة فدوى: لوحة لافندر بنفسجي فاتح أنثوية — لعيادتها وحدها
  const fadwaThemeClass = clinicFadwaThemeClass(profile)
  // عيادة الدكتورة رنيم: لوحة بترولية عميقة — لعيادتها وحدها
  const ranimThemeClass = clinicRanimThemeClass(profile)
  // عيادة الدكتورة فاطمة: شريط علوي أنحف على الجوال (الاسم الكامل طويل)
  const fatimaCompact = isFatimaClinic(profile)
  const headerH = fatimaCompact ? 'h-12 lg:h-14' : 'h-14'
  const headerTop = fatimaCompact ? 'top-12 lg:top-14' : 'top-14'
  const headerPad = fatimaCompact ? 'px-3 sm:px-6' : 'px-4 sm:px-6'
  const mainPad = fatimaCompact ? 'px-3 pb-24 pt-4 sm:px-6 lg:pb-8' : 'px-4 pb-24 pt-5 sm:px-6 lg:pb-8'

  return (
    <div className={`flex min-h-screen ${themeClass} ${fatimaThemeClass} ${fadwaThemeClass} ${ranimThemeClass}`}>
      {/* -------- desktop sidebar (right in RTL) -------- */}
      {!isDentalNav && !isObgynNav && (
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-s border-slate-200 bg-white lg:flex">
          <div className="px-4 py-4">
            <Brand />
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkCls}>
                <item.icon size={18} className="shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-slate-100 p-3">
            <UserMenu inline />
            <p className="mt-2 text-center text-[10px] text-slate-300">تطوير: {DEVELOPER_NAME}</p>
          </div>
        </aside>
      )}

      {/* -------- main column -------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className={`clinic-topbar sticky top-0 z-30 flex ${headerH} items-center justify-between gap-2 border-b border-slate-200 bg-white/95 backdrop-blur sm:gap-3 ${headerPad}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
            {!isHomePage && (
              <button
                onClick={() => nav(-1)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
                aria-label="رجوع للصفحة السابقة"
                title="رجوع"
              >
                <ArrowRight size={17} />
                <span className="hidden text-xs font-bold sm:block">رجوع</span>
              </button>
            )}
            <div className="min-w-0 flex-1 lg:hidden">
              <Brand mobile />
            </div>
            <p className="hidden text-xs font-medium text-slate-400 lg:block">{formatDateLong(todayStr())}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {APP_SCOPE !== 'owner' && effectiveRole === 'doctor' && !hidesAccountSwitcher(profile) && <AccountSwitcher compact />}
            <NotificationsBell panelTop={fatimaCompact ? 'top-12' : 'top-11'} />
            <UserMenu />
          </div>
        </header>

        {/* شريط التنقل العلوي لعيادات الأسنان */}
        {isDentalNav && (
          <nav className={`clinic-nav sticky ${headerTop} z-20 hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:block`}>
            <div className="flex items-stretch gap-1.5 overflow-x-auto px-4 py-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                      isActive
                        ? 'border-primary-700 bg-primary-700 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-700'
                    }`
                  }
                >
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}

        {/* شريط الحبّات العائم — عيادة النساء والتوليد (تصميم خاص بها) — الشاشات الكبيرة فقط */}
        {isObgynNav && (
          <nav className={`clinic-nav sticky ${headerTop} z-20 hidden border-b border-primary-100 bg-white/90 backdrop-blur lg:block`}>
            <div className="ob-pill-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `ob-pill ${isActive ? 'is-active' : ''}`}
                >
                  <item.icon size={15} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}

        <main className={`flex-1 ${mainPad}`}>
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>

        {/* -------- mobile bottom nav -------- */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white lg:hidden">
          <div className={`grid ${mobileMain.length + 1 >= 5 ? 'grid-cols-5' : mobileMain.length + 1 === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {mobileMain.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2 text-[10px] font-semibold ${isActive ? 'text-primary-700' : 'text-slate-500'}`
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={() => setMobileMore(true)}
              className="flex flex-col items-center gap-1 py-2 text-[10px] font-semibold text-slate-500"
            >
              <MoreHorizontal size={20} />
              المزيد
            </button>
          </div>
        </nav>

        {/* mobile "more" sheet */}
        {mobileMore && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileMore(false)} />
            <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white pb-safe p-4 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">المزيد</span>
                <button onClick={() => setMobileMore(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
                <Avatar name={profile?.full_name} src={profile?.avatar_url} className="h-9 w-9 text-xs" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-700">{profile?.full_name}</p>
                  <p className="text-[10px] text-slate-400">{isSuper ? 'مدير النظام' : isAdmin ? 'مدير العيادة' : effectiveRole === 'doctor' ? 'طبيب' : 'استقبال'}</p>
                </div>
              </div>
              <div className="space-y-1">
                {mobileMoreItems.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={linkCls}>
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ))}
                <div className="my-2 border-t border-slate-100" />
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <LogOut size={18} />
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
