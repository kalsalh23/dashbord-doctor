import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppProvider, useApp } from './lib/store'
import { APP_SCOPE } from './lib/scope'
import Layout from './components/Layout'
import { Toasts } from './components/ui'
import Login from './pages/Login'
import ReceptionDashboard from './pages/reception/Dashboard'
import Appointments from './pages/reception/Appointments'
import Patients from './pages/reception/Patients'
import PatientProfile from './pages/PatientProfile'
import Payments from './pages/reception/Payments'
import FollowUps from './pages/reception/FollowUps'
import Expenses from './pages/reception/Expenses'
import Settings from './pages/reception/Settings'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import Consultation from './pages/doctor/Consultation'
import Schedule from './pages/doctor/Schedule'
import VisitsLog from './pages/doctor/VisitsLog'
import DoctorFollowUps from './pages/doctor/DoctorFollowUps'
import Favorites from './pages/doctor/Favorites'
import DoctorSettings from './pages/doctor/DoctorSettings'
import DentalDashboard from './pages/doctor/DentalDashboard'
import SuperPanel from './pages/super/SuperPanel'

function FullSpinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="animate-spin text-primary-600" size={28} />
      <span className="text-xs">جارٍ التحميل...</span>
    </div>
  )
}

function homeFor(role) {
  if (role === 'doctor') return '/doctor'
  if (role === 'super_admin' && APP_SCOPE === 'owner') return '/super'
  return '/reception'
}

function UnauthorizedScreen() {
  const { logout } = useApp()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="mb-3 text-3xl">⛔</div>
        <h1 className="text-base font-bold text-slate-800">غير مصرح بالدخول</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          هذا الرابط مخصص لإدارة المنصة فقط. استخدم رابط العيادات لتسجيل الدخول بحساب عملك.
        </p>
        <button onClick={logout} className="mt-5 h-10 w-full rounded-xl bg-primary-700 text-sm font-bold text-white hover:bg-primary-800">
          تسجيل الخروج
        </button>
      </div>
    </div>
  )
}

function RequireAuth() {
  const { session, profile } = useApp()
  if (session === undefined) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (profile === null) return <FullSpinner />
  // suspended clinic: block staff (super admin keeps access to the control panel)
  if (profile.clinic && profile.clinic.is_active === false && profile.role !== 'super_admin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
          <div className="mb-3 text-3xl">🔒</div>
          <h1 className="text-base font-bold text-slate-800">تم إيقاف هذه العيادة مؤقتًا</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            يرجى مراجعة إدارة النظام. يمكن لمدير النظام إعادة تنشيط العيادة من لوحة الإدارة.
          </p>
          <LogoutButton />
        </div>
      </div>
    )
  }
  return <Layout />
}

function LogoutButton() {
  const { logout } = useApp()
  return (
    <button onClick={logout} className="mt-5 h-10 w-full rounded-xl bg-primary-700 text-sm font-bold text-white hover:bg-primary-800">
      تسجيل الخروج
    </button>
  )
}

function RequireSuper({ children }) {
  const { session, profile } = useApp()
  if (session === undefined || profile === null) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (profile.role !== 'super_admin') {
    return APP_SCOPE === 'owner' ? <UnauthorizedScreen /> : <Navigate to={homeFor(profile.role)} replace />
  }
  return children
}

function RequireRole({ role, children }) {
  const { session, effectiveRole } = useApp()
  if (session === undefined) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!effectiveRole) return <FullSpinner />
  if (effectiveRole !== role) return <Navigate to={homeFor(effectiveRole)} replace />
  return children
}

function HomeRedirect() {
  const { session, profile } = useApp()
  if (session === undefined) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <FullSpinner />
  if (APP_SCOPE === 'owner' && profile.role !== 'super_admin') return <UnauthorizedScreen />
  return <Navigate to={homeFor(profile.role)} replace />
}

// the doctor's home screen is chosen by HIS specialty — each specialty gets its own panel
function DoctorHome() {
  const { profile } = useApp()
  const specialtyKey = profile?.specialty_key || profile?.clinic?.specialty_key || 'general'
  if (specialtyKey === 'dentistry') return <DentalDashboard />
  return <DoctorDashboard />
}

function AppRoutes() {
  const { toasts } = useApp()
  return (
    <>
      <Toasts toasts={toasts} />
      {APP_SCOPE === 'owner' ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route path="/super" element={<RequireSuper><SuperPanel /></RequireSuper>} />
          </Route>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<Navigate to="/super" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route path="/reception" element={<RequireRole role="reception"><ReceptionDashboard /></RequireRole>} />
            <Route path="/reception/appointments" element={<RequireRole role="reception"><Appointments /></RequireRole>} />
            <Route path="/reception/patients" element={<RequireRole role="reception"><Patients /></RequireRole>} />
            <Route path="/reception/patients/:id" element={<RequireRole role="reception"><PatientProfile /></RequireRole>} />
            <Route path="/reception/payments" element={<RequireRole role="reception"><Payments /></RequireRole>} />
            <Route path="/reception/expenses" element={<RequireRole role="reception"><Expenses /></RequireRole>} />
            <Route path="/reception/follow-ups" element={<RequireRole role="reception"><FollowUps /></RequireRole>} />
            <Route path="/reception/settings" element={<RequireRole role="reception"><Settings /></RequireRole>} />
            <Route path="/doctor" element={<RequireRole role="doctor"><DoctorHome /></RequireRole>} />
            <Route path="/doctor/schedule" element={<RequireRole role="doctor"><Schedule /></RequireRole>} />
            <Route path="/doctor/patients" element={<RequireRole role="doctor"><Patients doctorMode /></RequireRole>} />
            <Route path="/doctor/patients/:id" element={<RequireRole role="doctor"><PatientProfile /></RequireRole>} />
            <Route path="/doctor/visits" element={<RequireRole role="doctor"><VisitsLog /></RequireRole>} />
            <Route path="/doctor/follow-ups" element={<RequireRole role="doctor"><DoctorFollowUps /></RequireRole>} />
            <Route path="/doctor/favorites" element={<RequireRole role="doctor"><Favorites /></RequireRole>} />
            <Route path="/doctor/settings" element={<RequireRole role="doctor"><DoctorSettings /></RequireRole>} />
            <Route path="/doctor/consultation/:appointmentId" element={<RequireRole role="doctor"><Consultation /></RequireRole>} />
            <Route path="/doctor/consultation/new/:patientId" element={<RequireRole role="doctor"><Consultation /></RequireRole>} />
          </Route>
          <Route path="/" element={<HomeRedirect />} />
          {/* the control panel lives only on the owner link */}
          <Route path="/super" element={<Navigate to="/" replace />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      )}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}
