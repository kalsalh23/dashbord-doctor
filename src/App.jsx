import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppProvider, useApp } from './lib/store'
import Layout from './components/Layout'
import { Toasts } from './components/ui'
import Login from './pages/Login'
import ReceptionDashboard from './pages/reception/Dashboard'
import Appointments from './pages/reception/Appointments'
import Patients from './pages/reception/Patients'
import PatientProfile from './pages/PatientProfile'
import Payments from './pages/reception/Payments'
import FollowUps from './pages/reception/FollowUps'
import Settings from './pages/reception/Settings'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import Consultation from './pages/doctor/Consultation'

function FullSpinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="animate-spin text-primary-600" size={28} />
      <span className="text-xs">جارٍ التحميل...</span>
    </div>
  )
}

function homeFor(role) {
  return role === 'doctor' ? '/doctor' : '/reception'
}

function RequireAuth() {
  const { session } = useApp()
  if (session === undefined) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <Layout />
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
  const { session, effectiveRole } = useApp()
  if (session === undefined) return <FullSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(effectiveRole)} replace />
}

function AppRoutes() {
  const { toasts } = useApp()
  return (
    <>
      <Toasts toasts={toasts} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/reception" element={<RequireRole role="reception"><ReceptionDashboard /></RequireRole>} />
          <Route path="/reception/appointments" element={<RequireRole role="reception"><Appointments /></RequireRole>} />
          <Route path="/reception/patients" element={<RequireRole role="reception"><Patients /></RequireRole>} />
          <Route path="/reception/patients/:id" element={<RequireRole role="reception"><PatientProfile /></RequireRole>} />
          <Route path="/reception/payments" element={<RequireRole role="reception"><Payments /></RequireRole>} />
          <Route path="/reception/follow-ups" element={<RequireRole role="reception"><FollowUps /></RequireRole>} />
          <Route path="/reception/settings" element={<RequireRole role="reception"><Settings /></RequireRole>} />
          <Route path="/doctor" element={<RequireRole role="doctor"><DoctorDashboard /></RequireRole>} />
          <Route path="/doctor/patients" element={<RequireRole role="doctor"><Patients doctorMode /></RequireRole>} />
          <Route path="/doctor/patients/:id" element={<RequireRole role="doctor"><PatientProfile /></RequireRole>} />
          <Route path="/doctor/consultation/:appointmentId" element={<RequireRole role="doctor"><Consultation /></RequireRole>} />
          <Route path="/doctor/consultation/new/:patientId" element={<RequireRole role="doctor"><Consultation /></RequireRole>} />
        </Route>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
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
