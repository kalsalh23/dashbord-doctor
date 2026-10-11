// ============================================================
// تنفيذ محلي لدوال Postgres (RPC) التي يستدعيها التطبيق
// بنفس سلوك تعريفات SQL في مجلد supabase/ لكن بلا إنترنت.
// ============================================================
import { loadTable, putRows, deleteRows, uuid } from './db.js'

function currentUser() {
  try {
    const raw = localStorage.getItem('cm_local_session')
    return raw ? JSON.parse(raw)?.user || null : null
  } catch {
    return null
  }
}

async function myProfile() {
  const uid = currentUser()?.id
  if (!uid) throw new Error('unauthorized')
  const profiles = await loadTable('profiles')
  const p = profiles.find((x) => x.id === uid)
  if (!p) throw new Error('unauthorized')
  return p
}

// تاريخ اليوم بالتوقيت المحلي — نفس ما يستخدمه التطبيق (todayStr)
// (باستخدام UTC يختلف التاريخ بعد منتصف الليل محلياً فيفشل ربط المواعيد)
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const now = () => new Date().toISOString()

async function getCurrentTimeHHMM() {
  const d = new Date()
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

export async function runRpc(client, authInternal, fn, args) {
  switch (fn) {
    case 'doctor_set_consultation_price': {
      const prof = await myProfile()
      if (!['doctor', 'admin', 'super_admin'].includes(prof.role)) throw new Error('FORBIDDEN')
      const price = Number(args.p_price)
      if (Number.isNaN(price) || price < 0) throw new Error('BAD_PRICE')
      const settings = await loadTable('clinic_settings')
      const s = settings.find((x) => x.clinic_id === prof.clinic_id)
      if (s) await putRows('clinic_settings', [{ ...s, consultation_price: price, updated_at: now() }])
      return null
    }

    case 'emergency_broadcast': {
      const prof = await myProfile()
      if (!['doctor', 'admin', 'super_admin'].includes(prof.role)) throw new Error('FORBIDDEN')
      const cancel = args.p_cancel !== false
      const clinics = await loadTable('clinics')
      const clinicName = clinics.find((c) => c.id === prof.clinic_id)?.name || 'العيادة'
      const appts = await loadTable('appointments')
      const patients = await loadTable('patients')
      const todays = appts.filter(
        (a) =>
          a.clinic_id === prof.clinic_id &&
          a.appointment_date === today() &&
          ['confirmed', 'new', 'arrived', 'waiting', 'in_consultation'].includes(a.status)
      )
      // قائمة المتأثرين ببياناتهم — الشاشة ترسل لهم رسالة الاعتذار (واتساب) واحداً واحداً
      const list = todays.map((a) => {
        const p = patients.find((x) => x.id === a.patient_id)
        return {
          id: a.id,
          start_time: a.start_time,
          patient_name: p?.full_name || '',
          phone: p?.phone || '',
        }
      })
      if (cancel) {
        const cancelled = todays.map((a) => ({
          ...a,
          status: 'cancelled',
          notes: [a.notes, 'أُلغي بسبب حالة إسعافية'].filter(Boolean).join(' — '),
          updated_at: now(),
        }))
        await putRows('appointments', cancelled)
      }
      await putRows('notifications', [
        {
          id: uuid(),
          clinic_id: prof.clinic_id,
          target_role: 'reception',
          title: 'حالة إسعافية — إلغاء مواعيد اليوم',
          body:
            'أُرسل اعتذار جماعي باسم ' + (prof.full_name || 'الطبيب') + ' إلى ' + list.length +
            ' مريض' + (cancel ? ' وأُلغيت مواعيدهم اليوم لتحرير الأوقات' : '') +
            '. يرجى الاتصال بالمرضى وترتيب إعادة الحجز.',
          type: 'cancellation',
          is_read: false,
          created_at: now(),
        },
      ])
      await putRows('audit_logs', [
        {
          id: uuid(),
          clinic_id: prof.clinic_id,
          user_id: prof.id,
          action: 'emergency_broadcast',
          details: { notified: list.length, cancelled: cancel, note: args.p_note || '' },
          created_at: now(),
        },
      ])
      return { count: list.length, cancelled: cancel, list }
    }

    case 'platform_request_accept': {
      const prof = await myProfile()
      const reqs = await loadTable('platform_requests')
      const req = reqs.find((r) => r.id === args.p_request_id)
      if (!req) return { error: 'الطلب غير موجود' }
      if (req.clinic_id !== prof.clinic_id) return { error: 'الطلب يخص عيادة أخرى' }
      if (req.status !== 'new') return { error: 'تم معالجة هذا الطلب مسبقاً' }

      const patients = await loadTable('patients')
      let patient = patients.find((p) => p.clinic_id === req.clinic_id && p.phone === req.patient_phone)
      if (!patient) {
        patient = {
          id: uuid(),
          clinic_id: req.clinic_id,
          full_name: req.patient_name,
          phone: req.patient_phone,
          notes: 'مريض من دليل طيبة الإمام الطبي — أول طلب: ' + today(),
          created_at: now(),
          updated_at: now(),
        }
        await putRows('patients', [patient])
      }
      const m = String(req.preferred_time || '').match(/(\d{1,2}:\d{2})/)
      const start = m ? m[1] : '09:00'
      const [h, min] = start.split(':').map(Number)
      const endH = (h + Math.floor((min + 30) / 60)) % 24
      const endM = (min + 30) % 60
      const end = String(endH).padStart(2, '0') + ':' + String(endM).padStart(2, '0')
      const apptId = uuid()
      await putRows('appointments', [
        {
          id: apptId,
          clinic_id: req.clinic_id,
          patient_id: patient.id,
          appointment_date: req.requested_date || today(),
          start_time: start,
          end_time: end,
          status: 'confirmed',
          notes: 'من دليل طيبة الإمام (' + (req.day_label || '') + ') — ' + (req.preferred_time || ''),
          created_at: now(),
          updated_at: now(),
        },
      ])
      await putRows('platform_requests', [{ ...req, status: 'confirmed' }])
      return { ok: true, appointment_id: apptId, patient_id: patient.id }
    }

    case 'platform_request_reject': {
      const prof = await myProfile()
      const reqs = await loadTable('platform_requests')
      const req = reqs.find((r) => r.id === args.p_request_id)
      if (!req) return { error: 'الطلب غير موجود' }
      if (req.clinic_id !== prof.clinic_id) return { error: 'الطلب يخص عيادة أخرى' }
      if (req.status !== 'new') return { error: 'تم معالجة هذا الطلب مسبقاً' }
      await putRows('platform_requests', [{ ...req, status: 'rejected' }])
      return { ok: true }
    }

    case 'super_clinic_stats': {
      await myProfile()
      const clinics = await loadTable('clinics')
      const patients = await loadTable('patients')
      const appts = await loadTable('appointments')
      const fups = await loadTable('follow_up_requests')
      const t = today()
      return clinics.map((c) => ({
        clinic_id: c.id,
        patients: patients.filter((p) => p.clinic_id === c.id).length,
        appointments_today: appts.filter(
          (a) => a.clinic_id === c.id && a.appointment_date === t && !['cancelled', 'no_show'].includes(a.status)
        ).length,
        pending_followups: fups.filter((f) => f.clinic_id === c.id && f.status === 'pending').length,
      }))
    }

    case 'super_list_users': {
      await myProfile()
      const profiles = await loadTable('profiles')
      const users = await authInternal.allUsers()
      return profiles
        .filter((p) => p.clinic_id === args.p_clinic_id)
        .map((p) => ({
          id: p.id,
          email: users.find((u) => u.id === p.id)?.email || null,
          full_name: p.full_name,
          role: p.role,
          phone: p.phone,
          is_active: p.is_active,
        }))
        .sort((a, b) => (a.role || '').localeCompare(b.role || '') || (a.full_name || '').localeCompare(b.full_name || ''))
    }

    case 'super_create_clinic': {
      const prof = await myProfile()
      if (prof.role !== 'super_admin') throw new Error('FORBIDDEN')
      const clinicId = uuid()
      await putRows('clinics', [
        {
          id: clinicId,
          name: args.p_name,
          specialty: args.p_specialty ?? null,
          phone: args.p_phone ?? null,
          address: args.p_address ?? null,
          is_active: true,
          created_at: now(),
          updated_at: now(),
        },
      ])
      await putRows('clinic_settings', [
        {
          id: uuid(),
          clinic_id: clinicId,
          doctor_name: args.p_doctor_name ?? null,
          consultation_price: args.p_consultation_price ?? 0,
          currency: 'ر.س',
          created_at: now(),
          updated_at: now(),
        },
      ])
      const week = [
        [0, true], [1, true], [2, true], [3, true], [4, true], [5, false], [6, true],
      ]
      await putRows(
        'doctor_schedules',
        week.map(([d, active]) => ({
          id: uuid(),
          clinic_id: clinicId,
          doctor_id: null,
          weekday: d,
          start_time: '17:00',
          end_time: '21:00',
          is_active: active,
          created_at: now(),
          updated_at: now(),
        }))
      )
      return clinicId
    }

    case 'super_create_user': {
      const prof = await myProfile()
      if (prof.role !== 'super_admin') throw new Error('FORBIDDEN')
      if (!['doctor', 'reception', 'admin'].includes(args.p_role)) throw new Error('BAD_ROLE')
      if (!args.p_password || String(args.p_password).length < 6) throw new Error('WEAK_PASSWORD')
      if (await authInternal.emailExists(args.p_email)) throw new Error('EMAIL_EXISTS')
      const newId = uuid()
      await authInternal.createUser({
        id: newId,
        email: args.p_email,
        password: args.p_password,
        full_name: args.p_full_name,
        role: args.p_role,
      })
      const profiles = await loadTable('profiles')
      const existing = profiles.find((p) => p.id === newId)
      if (existing) {
        await putRows('profiles', [
          { ...existing, full_name: args.p_full_name, role: args.p_role, clinic_id: args.p_clinic_id, phone: args.p_phone ?? null, updated_at: now() },
        ])
      } else {
        await putRows('profiles', [
          {
            id: newId,
            clinic_id: args.p_clinic_id,
            full_name: args.p_full_name,
            role: args.p_role,
            phone: args.p_phone ?? null,
            is_active: true,
            created_at: now(),
            updated_at: now(),
          },
        ])
      }
      return newId
    }

    case 'super_reset_password': {
      const prof = await myProfile()
      if (prof.role !== 'super_admin') throw new Error('FORBIDDEN')
      if (!args.p_new_password || String(args.p_new_password).length < 6) throw new Error('WEAK_PASSWORD')
      await authInternal.setPassword(args.p_user_id, args.p_new_password)
      return null
    }

    default:
      throw new Error(`RPC ${fn} is not available in offline mode`)
  }
}

export { getCurrentTimeHHMM }
