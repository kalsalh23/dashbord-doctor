import { useCallback, useEffect, useState } from 'react'
import { useApp } from './store'
import { supabase } from './supabase'

export function useSchedules() {
  const { profile } = useApp()
  const [schedules, setSchedules] = useState([])
  const reload = useCallback(async () => {
    if (!profile?.clinic_id) return
    const { data } = await supabase
      .from('doctor_schedules')
      .select('*')
      .eq('clinic_id', profile.clinic_id)
      .order('weekday')
    setSchedules(data || [])
  }, [profile?.clinic_id])
  useEffect(() => {
    reload()
  }, [reload])
  return [schedules, reload]
}

// booked map for a date: { '17:30': appointment }
export async function fetchBookedMap(clinicId, dateStr) {
  const { data } = await supabase
    .from('appointments')
    .select('id, start_time, status, patient:patients(full_name)')
    .eq('clinic_id', clinicId)
    .eq('appointment_date', dateStr)
    .not('status', 'in', '(cancelled,no_show)')
  const map = {}
  for (const a of data || []) map[a.start_time.slice(0, 5)] = a
  return map
}

export function friendlyDbError(err, duplicateMsg) {
  const msg = err?.message || ''
  if (msg.includes('EMAIL_EXISTS')) {
    return 'البريد الإلكتروني مستخدم مسبقًا'
  }
  if (msg.includes('WEAK_PASSWORD')) {
    return 'كلمة المرور قصيرة — 6 أحرف على الأقل'
  }
  if (msg.includes('duplicate key') || err?.code === '23505') {
    return duplicateMsg || 'هذه البيانات مستخدمة مسبقًا'
  }
  if (msg.includes('FORBIDDEN') || msg.includes('row-level security')) {
    return 'لا تملك صلاحية تنفيذ هذا الإجراء'
  }
  return 'حدث خطأ غير متوقع، حاول مرة أخرى'
}
