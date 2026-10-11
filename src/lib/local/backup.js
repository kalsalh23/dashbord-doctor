// ============================================================
// النسخ الاحتياطي المحلي: تصدير قاعدة البيانات المحلية كاملة
// (كل الجداول + المستخدمون بهاشاتهم) كملف JSON — نفس صيغة
// seed-data.json، فتصلح للنسخ الاحتياطي وللبناء التخصصي للعيادات.
// ============================================================
import { loadTable, FK } from './db.js'

export const ALL_TABLES = [...Object.keys(FK), '__users']

export async function buildLocalBackup() {
  const tables = {}
  for (const t of ALL_TABLES) {
    try {
      tables[t] = await loadTable(t)
    } catch {
      tables[t] = []
    }
  }
  return {
    seed_version: Date.now(),
    exported_at: new Date().toISOString(),
    source: 'local-backup',
    tables,
    users: tables.__users || [],
  }
}

export async function downloadLocalBackup() {
  const data = await buildLocalBackup()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'clinic-backup-' + new Date().toISOString().slice(0, 10) + '.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return Object.entries(data.tables)
    .filter(([, rows]) => rows.length)
    .map(([t, rows]) => `${t}:${rows.length}`)
    .join('، ')
}

// ملف عيادة واحدة: نفس صيغة ملف التوزيع clinic-data-*.json
// يُرسل للطبيب ليضعه بجانب التطبيق العام — يحتوي عيادته وحساباتها فقط
export async function downloadClinicFile(clinic) {
  const full = await buildLocalBackup()
  const tables = {}
  for (const [t, rows] of Object.entries(full.tables)) {
    tables[t] = rows.filter((r) => r.clinic_id === clinic.id)
  }
  tables.clinics = [clinic]
  const staffIds = new Set((tables.profiles || []).map((p) => p.id))
  const users = (full.users || []).filter((u) => staffIds.has(u.id))

  const data = {
    seed_version: Date.now(),
    exported_at: new Date().toISOString(),
    clinic_only: clinic.name,
    tables,
    users,
  }

  const slug = String(clinic.name || 'clinic')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'clinic-data-' + slug + '.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return {
    patients: (tables.patients || []).length,
    staff: users.length,
  }
}
