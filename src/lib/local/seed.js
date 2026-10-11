// ============================================================
// التهيئة الأولى: تحميل seed-data.json (نسخة البيانات المصدرية)
// في IndexedDB عند أول تشغيل — أو تحديث الحسابات والإعدادات عند
// وصول ملف أحدث (نسخة عيادة أعيد إرسالها بعد إنشاء حسابات جديدة).
// ============================================================
import { tx, wipeAll, putRows, deleteRows, loadTable, setSeeding } from './db.js'

export const SEED_URL = '/seed-data.json'

// جداول الحسابات والإعدادات التي يديرها مدير النظام — تُحدَّث من ملف البيانات
// الأحدث. بيانات العمل (مرضى، زيارات، مواعيد، مدفوعات...) لا تُمس أبداً.
const ADMIN_TABLES = ['clinics', 'clinic_settings', 'doctor_schedules', 'profiles', '__users']
const CATALOG_TABLES = ['medication_catalog', 'dental_pricebook']

async function applyAccountUpdate(seed) {
  // 1) تحديث/إضافة صفوف الحسابات والإعدادات من الملف
  //    ملفات التوزيع تخزّن المستخدمين في المستوى الأعلى (seed.users) — تُدمج مع tables.__users
  for (const t of ADMIN_TABLES) {
    let incoming = seed.tables?.[t] || []
    if (t === '__users') {
      const byId = new Map()
      for (const u of [...incoming, ...(seed.users || [])]) byId.set(u.id, u)
      incoming = [...byId.values()]
    }
    if (incoming.length) await putRows(t, incoming)
  }
  // 2) حذف الحسابات التي أزالها مدير النظام — لعيادات الملف فقط
  //    (لا نلمس حسابات عيادات أخرى قد تكون على نفس الجهاز)
  const fileClinicIds = new Set((seed.tables?.clinics || []).map((c) => c.id))
  const incomingProfileIds = new Set((seed.tables?.profiles || []).map((p) => p.id))
  if (fileClinicIds.size) {
    const localProfiles = await loadTable('profiles')
    const stale = localProfiles.filter((p) => fileClinicIds.has(p.clinic_id) && !incomingProfileIds.has(p.id))
    if (stale.length) {
      await deleteRows('profiles', stale.map((p) => p.id))
      await deleteRows('__users', stale.map((p) => p.id))
    }
  }
  // 3) كتالوجات مرجعية مشتركة — تُستبدل بالنسخة الأحدث
  for (const t of CATALOG_TABLES) {
    const incoming = seed.tables?.[t] || []
    const local = await loadTable(t)
    if (local.length && !incoming.length) continue // لا نفرغ كتالوجاً بملف بلا بيانات
    await deleteRows(t, local.map((r) => r.id))
    if (incoming.length) await putRows(t, incoming)
  }
  // 4) جلسة مستخدم حُذف حسابه → تسجيل خول صامت
  try {
    const uid = JSON.parse(localStorage.getItem('cm_local_session') || 'null')?.user?.id
    if (uid) {
      const profiles = await loadTable('profiles')
      if (!profiles.some((p) => p.id === uid)) localStorage.removeItem('cm_local_session')
    }
  } catch { /* تجاهل */ }
}

export async function ensureSeeded() {
  setSeeding(true)
  try {
    const kv = async (k) => tx('kv', 'readonly', (s) => s.get(k))
    const setKv = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k))

    let seed = null
    try {
      const res = await fetch(SEED_URL, { cache: 'no-store' })
      if (res.ok) seed = await res.json()
    } catch {
      /* offline file missing — start empty */
    }

    const current = await kv('seed_version')
    const hasTables = !!(seed?.tables && Object.keys(seed.tables).length)

    // الجهاز مبذور مسبقاً: اقبل ملفاً أحدث فقط — يحدّث الحسابات والإعدادات
    // دون المساس ببيانات العمل (هكذا تصل الحسابات الجديدة لجهاز الطبيب)
    if (current && current !== 0) {
      if (hasTables && seed.seed_version && Number(seed.seed_version) > Number(current)) {
        await applyAccountUpdate(seed)
        await setKv('seed_version', seed.seed_version)
      }
      return
    }
    if (!seed) return
    if (current === 0 && !hasTables) return

    await wipeAll()
    for (const [table, rows] of Object.entries(seed.tables || {})) {
      if (Array.isArray(rows) && rows.length) await putRows(table, rows)
    }
    if (Array.isArray(seed.users) && seed.users.length) {
      await putRows('__users', seed.users)
    }
    await setKv('seed_version', seed.seed_version)
  } finally {
    setSeeding(false)
  }
}
