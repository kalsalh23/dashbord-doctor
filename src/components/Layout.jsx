import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, Users, Wallet, Repeat, Settings, Stethoscope,
  Bell, LogOut, Menu, X, MoreHorizontal, Activity, Shield,
} from 'lucide-react'
import { useApp } from '../lib/store'
import { supabase } from '../lib/supabase'
import { APP_SCOPE } from '../lib/scope'
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
    { to: '/doctor', label: 'قائمة الانتظار', icon: LayoutDashboard, end: true },
    { to: '/doctor/patients', label: 'المرضى', icon: Users },
  ],
  super: [
    { to: '/super', label: 'لوحة إدارة النظام', icon: Shield, end: true },
  ],
}

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [ref, onClose])
}

function NotificationsBell() {
  const { profile, effectiveRole } = useApp()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const ref = useRef(null)
  const nav = useNavigate()
  useOutsideClose(ref, () => setOpen(false))

  const load = async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15)
    setItems(data || [])
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
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
        <div className="absolute end-0 top-11 z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
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
        <Avatar name={profile?.full_name} className="h-8 w-8 text-xs" />
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

function Brand() {
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
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-700 text-white shadow-sm">
        <Activity size={19} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-800">{profile?.clinic?.name || 'نظام إدارة العيادة'}</div>
        <div className="text-[10px] text-slate-400">{profile?.clinic?.specialty || 'إدارة العيادات الطبية'}</div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { effectiveRole, profile, logout, isSuper, isAdmin } = useApp()
  const [mobileMore, setMobileMore] = useState(false)
  const loc = useLocation()
  let navItems = NAV[effectiveRole] || NAV.reception
  if (APP_SCOPE === 'owner') {
    navItems = NAV.super
  } else {
    navItems = navItems.filter((i) => isAdmin || !i.adminOnly)
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

  return (
    <div className="flex min-h-screen">
      {/* -------- desktop sidebar (right in RTL) -------- */}
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
        </div>
      </aside>

      {/* -------- main column -------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="lg:hidden">
            <Brand />
          </div>
          <p className="hidden text-xs font-medium text-slate-400 lg:block">{formatDateLong(todayStr())}</p>
          <div className="flex items-center gap-1.5">
            <NotificationsBell />
            <div className="hidden sm:block">
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>

        {/* -------- mobile bottom nav -------- */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white lg:hidden">
          <div className="grid grid-cols-5">
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
            {mobileMoreItems.length > 0 ? (
              <button
                onClick={() => setMobileMore(true)}
                className="flex flex-col items-center gap-1 py-2 text-[10px] font-semibold text-slate-500"
              >
                <MoreHorizontal size={20} />
                المزيد
              </button>
            ) : (
              <span />
            )}
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
