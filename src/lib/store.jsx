import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [mode, setMode] = useState(() => localStorage.getItem('ui_mode') || 'reception')
  const [toasts, setToasts] = useState([])

  const toast = useCallback((type, text) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, type, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const loadUserData = useCallback(async (userId) => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*, clinic:clinics(name, specialty)')
      .eq('id', userId)
      .single()
    setProfile(prof || null)
    if (prof?.clinic_id) {
      const { data: st } = await supabase
        .from('clinic_settings')
        .select('*')
        .eq('clinic_id', prof.clinic_id)
        .maybeSingle()
      setSettings(st || null)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null)
      if (data.session?.user) loadUserData(data.session.user.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s || null)
      if (s?.user) loadUserData(s.user.id)
      else {
        setProfile(null)
        setSettings(null)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [loadUserData])

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSettings(null)
  }, [])

  const refreshSettings = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data: st } = await supabase
      .from('clinic_settings')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .maybeSingle()
    setSettings(st || null)
  }, [profile?.clinic_id])

  // admins can switch between the reception and doctor interfaces
  const effectiveRole = profile?.role === 'admin' ? mode : profile?.role || null

  const switchMode = useCallback(
    (m) => {
      if (!profile || profile.role !== 'admin') return
      setMode(m)
      localStorage.setItem('ui_mode', m)
    },
    [profile]
  )

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      settings,
      effectiveRole,
      isAdmin: profile?.role === 'admin',
      mode: effectiveRole,
      switchMode,
      refreshSettings,
      login,
      logout,
      toast,
      toasts,
    }),
    [session, profile, settings, effectiveRole, mode, toasts, switchMode, refreshSettings, login, logout, toast]
  )

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  return useContext(AppCtx)
}

// shared mutation helper: log to audit_logs, best-effort
export async function audit(clinicId, action, entity, entityId, details) {
  try {
    await supabase.from('audit_logs').insert({ clinic_id: clinicId, action, entity, entity_id: entityId, details })
  } catch {
    /* non-blocking */
  }
}

export async function notify(clinicId, targetRole, title, body, type, link, createdBy) {
  try {
    await supabase.from('notifications').insert({
      clinic_id: clinicId,
      target_role: targetRole,
      title,
      body,
      type,
      link,
      created_by: createdBy || null,
    })
  } catch {
    /* non-blocking */
  }
}
