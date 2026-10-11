// ============================================================
// محرك قاعدة البيانات المحلية — يحاكي واجهة supabase-js المستخدمة في التطبيق
// Data lives in IndexedDB (persists in the Electron profile), and the whole
// table is cached in memory: clinic-scale data is tiny and single-window.
// ============================================================

const DB_NAME = 'clinic_offline'
const DB_VERSION = 1

let _dbPromise = null
// seed gate: every transaction waits until initial seeding (first run) finishes.
// the seeding routine itself bypasses the gate via setSeeding() to avoid self-deadlock.
let _seedGate = null
let _seeding = false
export function setSeedGate(promise) {
  _seedGate = promise
}
export function setSeeding(v) {
  _seeding = v
}
async function afterSeed() {
  if (_seedGate && !_seeding) await _seedGate
}
function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('rows')) {
        const rows = db.createObjectStore('rows', { keyPath: ['t', 'id'] })
        rows.createIndex('by-table', 't', { unique: false })
      }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function tx(store, mode, fn) {
  return openDB().then(async (db) => {
    await afterSeed()
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode)
      const req = fn(t.objectStore(store))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  })
}

// ---------- in-memory table cache ----------
const _cache = new Map() // table -> Promise<array>

function loadTable(name) {
  if (!_cache.has(name)) {
    _cache.set(
      name,
      tx('rows', 'readonly', (s) => s.index('by-table').getAll(name))
        .then((list) => list.map(({ t, ...rest }) => rest))
        .catch((e) => {
          _cache.delete(name)
          throw e
        })
    )
  }
  return _cache.get(name)
}

function invalidate(name) {
  _cache.delete(name)
}

async function putRows(table, rows) {
  if (!rows.length) return
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const t = db.transaction('rows', 'readwrite')
    const s = t.objectStore('rows')
    for (const r of rows) s.put({ ...r, t: table })
    t.oncomplete = resolve
    t.onerror = () => reject(t.error)
  })
  invalidate(table)
}

async function deleteRows(table, ids) {
  if (!ids.length) return
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const t = db.transaction('rows', 'readwrite')
    const s = t.objectStore('rows')
    for (const id of ids) s.delete([table, id])
    t.oncomplete = resolve
    t.onerror = () => reject(t.error)
  })
  invalidate(table)
}

export async function wipeAll() {
  _cache.clear()
  await tx('rows', 'readwrite', (s) => s.clear())
}

export function uuid() {
  return crypto.randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

// ---------- foreign keys (parent column -> referenced table) ----------
export const FK = {
  profiles: { clinic_id: 'clinics' },
  clinic_settings: { clinic_id: 'clinics' },
  doctor_schedules: { clinic_id: 'clinics', doctor_id: 'profiles' },
  patients: { clinic_id: 'clinics', created_by: 'profiles' },
  medical_information: { clinic_id: 'clinics', patient_id: 'patients' },
  appointments: { clinic_id: 'clinics', patient_id: 'patients', doctor_id: 'profiles', created_by: 'profiles' },
  visits: { clinic_id: 'clinics', patient_id: 'patients', appointment_id: 'appointments', doctor_id: 'profiles' },
  medications: { clinic_id: 'clinics', visit_id: 'visits', patient_id: 'patients' },
  attachments: { clinic_id: 'clinics', patient_id: 'patients', visit_id: 'visits', uploaded_by: 'profiles' },
  payments: { clinic_id: 'clinics', patient_id: 'patients', appointment_id: 'appointments', created_by: 'profiles' },
  follow_up_requests: { clinic_id: 'clinics', patient_id: 'patients', doctor_id: 'profiles', visit_id: 'visits', appointment_id: 'appointments' },
  notifications: { clinic_id: 'clinics', created_by: 'profiles' },
  audit_logs: { clinic_id: 'clinics', user_id: 'profiles' },
  dental_chart_entries: { clinic_id: 'clinics', patient_id: 'patients', visit_id: 'visits' },
  ent_chart_entries: { clinic_id: 'clinics', patient_id: 'patients', visit_id: 'visits' },
  platform_requests: { clinic_id: 'clinics' },
  expenses: { clinic_id: 'clinics', created_by: 'profiles' },
  push_subscriptions: { user_id: 'profiles', clinic_id: 'clinics' },
  dental_pricebook: { clinic_id: 'clinics' },
  medication_catalog: { clinic_id: 'clinics' },
  doctor_favorite_medications: { clinic_id: 'clinics', doctor_id: 'profiles' },
  clinics: {},
}

// ---------- select parsing ----------
// '*, patient:patients(id, full_name), medications(*)' ->
//   [{kind:'col', name:'*'}, {kind:'embed', alias:'patient', table:'patients', cols:[...]}, ...]
function parseSelect(str) {
  if (!str || str === '*') return [{ kind: 'col', name: '*' }]
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map((p) => {
    p = p.trim()
    let m = p.match(/^([\w.]+):\s*([\w.]+)\s*\(([\s\S]*)\)$/)
    if (m) return { kind: 'embed', alias: m[1], table: m[2], cols: parseEmbedCols(m[3]) }
    m = p.match(/^([\w.]+)\s*\(([\s\S]*)\)$/)
    if (m) return { kind: 'embed', alias: m[1], table: m[1], cols: parseEmbedCols(m[2]) }
    return { kind: 'col', name: p }
  })
}

function parseEmbedCols(s) {
  return s
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
}

function shapeEmbedded(rows, cols) {
  if (!cols || cols.includes('*')) return rows.map((r) => ({ ...r }))
  return rows.map((r) => {
    const o = {}
    for (const c of cols) o[c] = r[c] ?? null
    return o
  })
}

function embedValue(parentTable, parentRow, table, alias, cols, tablesMap) {
  const parentFks = FK[parentTable] || {}
  const childFks = FK[table] || {}
  const tableData = tablesMap[table] || []
  // alias hints the fk column: doctor -> doctor_id
  let fkCol = alias && parentFks[`${alias}_id`] === table ? `${alias}_id` : null
  if (!fkCol) {
    for (const [col, target] of Object.entries(parentFks)) if (target === table) { fkCol = col; break }
  }
  if (fkCol) {
    const ref = parentRow[fkCol]
    const matched = ref == null ? [] : tableData.filter((r) => r.id === ref)
    return shapeEmbedded(matched, cols)[0] ?? null
  }
  // one-to-many: the child table holds the fk pointing back to the parent
  let childCol = null
  for (const [col, target] of Object.entries(childFks)) if (target === parentTable) { childCol = col; break }
  if (childCol) {
    const matched = tableData.filter((r) => r[childCol] === parentRow.id)
    return shapeEmbedded(matched, cols)
  }
  return null
}

function shapeRow(row, parsed, table, tablesMap) {
  const hasStar = parsed.some((p) => p.kind === 'col' && p.name === '*')
  if (hasStar && parsed.length === 1) return { ...row }
  const out = {}
  for (const p of parsed) {
    if (p.kind === 'col') {
      if (p.name === '*') Object.assign(out, row)
      else if (p.name in row) out[p.name] = row[p.name]
    } else {
      out[p.alias] = embedValue(table, row, p.table, p.alias, p.cols, tablesMap)
    }
  }
  return out
}

// ---------- filters ----------
const str = (v) => (v == null ? '' : String(v))

function likeMatch(value, pattern, insensitive) {
  const v = str(value)
  const p = str(pattern)
  const re = new RegExp(
    '^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$',
    insensitive ? 'i' : ''
  )
  return re.test(v)
}

function cmp(a, b) {
  if (a == null || b == null) return a == b ? 0 : (a == null ? -1 : 1)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && str(a).trim() !== '' && str(b).trim() !== '') return na - nb
  return str(a) < str(b) ? -1 : str(a) > str(b) ? 1 : 0
}

function parseScalar(v) {
  if (v === 'null') return null
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

function applyCondition(row, col, op, rawValue) {
  const a = row[col]
  switch (op) {
    case 'eq': {
      const v = parseScalar(rawValue)
      return a === v || (a != null && v != null && str(a) === str(v))
    }
    case 'neq': {
      const v = parseScalar(rawValue)
      return !(a === v || (a != null && v != null && str(a) === str(v)))
    }
    case 'gt': return cmp(a, parseScalar(rawValue)) > 0
    case 'gte': return cmp(a, parseScalar(rawValue)) >= 0
    case 'lt': return cmp(a, parseScalar(rawValue)) < 0
    case 'lte': return cmp(a, parseScalar(rawValue)) <= 0
    case 'like': return likeMatch(a, rawValue, false)
    case 'ilike': return likeMatch(a, rawValue, true)
    case 'is': return rawValue === 'null' ? a == null : rawValue === 'not null' ? a != null : a === parseScalar(rawValue)
    default: return true
  }
}

function makeFilter(col, op, value) {
  if (op === 'in') {
    let raw = Array.isArray(value) ? null : str(value)
    // PostgREST style: '(cancelled,no_show)'
    if (raw && raw.startsWith('(') && raw.endsWith(')')) raw = raw.slice(1, -1)
    const list = Array.isArray(value) ? value : raw.split(',').map((x) => x.trim())
    return (row) => list.some((v) => applyCondition(row, col, 'eq', v))
  }
  if (op === 'or') {
    // only used in this app as `col.op.val,col.op.val` — top-level OR of conditions
    const conds = str(value)
      .split(',')
      .map((c) => c.trim())
      .map((c) => {
        const m = c.match(/^([\w.]+)\.(eq|neq|gt|gte|lt|lte|like|ilike|is)\.(.*)$/)
        return m ? { col: m[1], op: m[2], value: m[3] } : null
      })
      .filter(Boolean)
    return (row) => conds.some((c) => applyCondition(row, c.col, c.op, c.value))
  }
  return (row) => applyCondition(row, col, op, value)
}

// ---------- the query builder ----------
class Query {
  constructor(table, execCtx) {
    this._t = table
    this._select = null
    this._filters = []
    this._orders = []
    this._limit = null
    this._single = false
    this._maybeSingle = false
    this._count = false
    this._mutation = null // {type:'insert'|'update'|'upsert'|'delete', payload, opts}
    this._exec = execCtx
  }

  select(str, opts = {}) {
    this._select = str
    if (opts && opts.count) this._count = true
    return this
  }
  eq(col, v) { this._filters.push(makeFilter(col, 'eq', v)); return this }
  neq(col, v) { this._filters.push(makeFilter(col, 'neq', v)); return this }
  gt(col, v) { this._filters.push(makeFilter(col, 'gt', v)); return this }
  gte(col, v) { this._filters.push(makeFilter(col, 'gte', v)); return this }
  lt(col, v) { this._filters.push(makeFilter(col, 'lt', v)); return this }
  lte(col, v) { this._filters.push(makeFilter(col, 'lte', v)); return this }
  like(col, v) { this._filters.push(makeFilter(col, 'like', v)); return this }
  ilike(col, v) { this._filters.push(makeFilter(col, 'ilike', v)); return this }
  is(col, v) { this._filters.push(makeFilter(col, 'is', v)); return this }
  in(col, v) { this._filters.push(makeFilter(col, 'in', v)); return this }
  or(expr) { this._filters.push(makeFilter(null, 'or', expr)); return this }
  not(col, op, v) {
    const inner = makeFilter(col, op, v)
    this._filters.push((row) => !inner(row))
    return this
  }
  order(col, opts = {}) { this._orders.push({ col, ascending: opts.ascending !== false }); return this }
  limit(n) { this._limit = n; return this }
  single() { this._single = true; return this }
  maybeSingle() { this._maybeSingle = true; return this }

  insert(payload, opts = {}) { this._mutation = { type: 'insert', payload, opts }; return this }
  update(payload) { this._mutation = { type: 'update', payload }; return this }
  upsert(payload, opts = {}) { this._mutation = { type: 'upsert', payload, opts }; return this }
  delete() { this._mutation = { type: 'delete' }; return this }

  then(onRes, onRej) {
    return this._run().then(onRes, onRej)
  }
  catch(fn) { return this._run().catch(fn) }
  finally(fn) { return this._run().finally(fn) }

  async _run() {
    try {
      return await this._exec(this)
    } catch (e) {
      return { data: null, error: { message: e?.message || String(e), code: 'LOCAL_ERROR' } }
    }
  }
}

// ---------- عزل العيادات (يقابل RLS) ----------
// جداول تُقيد تلقائياً بعيادة المستخدم المسجّل في كل استعلام
const SCOPED_TABLES = new Set([
  'clinic_settings', 'doctor_schedules', 'patients', 'medical_information',
  'appointments', 'visits', 'medications', 'attachments', 'payments',
  'follow_up_requests', 'notifications', 'audit_logs', 'dental_chart_entries',
  'ent_chart_entries', 'platform_requests', 'expenses', 'push_subscriptions',
  'dental_pricebook', 'medication_catalog', 'doctor_favorite_medications',
])

async function getScopeClinicId() {
  try {
    if (typeof localStorage === 'undefined') return null
    const uid = JSON.parse(localStorage.getItem('cm_local_session') || 'null')?.user?.id
    if (!uid) return null
    const profiles = await loadTable('profiles')
    return profiles.find((p) => p.id === uid)?.clinic_id || null
  } catch {
    return null
  }
}

async function execQuery(q) {
  const table = q._t
  let rows = await loadTable(table)

  // ===== عزل بيانات العيادات (RLS محلي) =====
  // كل جدول يحمل clinic_id يُقيد تلقائياً بعيادة المستخدم المسجّل —
  // يقابل سياسات RLS في النسخة السحابية. جداول العرض العامة مستثناة.
  if (SCOPED_TABLES.has(table)) {
    const scopeId = await getScopeClinicId()
    if (scopeId) {
      q._filters.push(makeFilter('clinic_id', 'eq', scopeId))
      q._scopeClinicId = scopeId
    }
  }

  if (!q._mutation) {
    let filtered = rows.filter((r) => q._filters.every((f) => f(r)))
    for (const o of q._orders) {
      filtered = [...filtered].sort((a, b) => (o.ascending ? cmp(a[o.col], b[o.col]) : -cmp(a[o.col], b[o.col])))
    }
    if (q._limit != null) filtered = filtered.slice(0, q._limit)

    let count
    if (q._count) count = filtered.length

    const parsed = parseSelect(q._select)
    const tablesMap = { [table]: rows }
    for (const p of parsed) if (p.kind === 'embed' && !(p.table in tablesMap)) tablesMap[p.table] = await loadTable(p.table)
    let data = q._count && !q._select ? null : filtered.map((r) => shapeRow(r, parsed, table, tablesMap))
    if (q._single || q._maybeSingle) {
      if (!filtered.length) {
        if (q._maybeSingle) return { data: null, error: null, count }
        return { data: null, error: { message: 'No rows found', code: 'PGRST116' }, count }
      }
      data = data[0]
    }
    return { data, error: null, count }
  }

  const m = q._mutation
  const now = nowIso()
  let affected = []
  const working = [...rows]

  if (m.type === 'insert' || m.type === 'upsert') {
    const list = Array.isArray(m.payload) ? m.payload : [m.payload]
    const conflictCol = m.opts?.onConflict || 'id'
    for (const item of list) {
      const row = { ...item }
      if (row.id == null) row.id = uuid()
      if (!('created_at' in row)) row.created_at = now
      if (!('updated_at' in row)) row.updated_at = now
      // عزل العيادات: أي صف جديد في جدول مقيّد يُربط بعيادة المستخدم إجبارياً
      if (q._scopeClinicId && SCOPED_TABLES.has(table)) row.clinic_id = q._scopeClinicId
      const idx = working.findIndex((r) => str(r[conflictCol]) === str(row[conflictCol]))
      if (idx >= 0 && m.type === 'upsert') {
        row.id = working[idx].id ?? row.id
        row.created_at = working[idx].created_at ?? row.created_at
        working[idx] = { ...working[idx], ...row }
        affected.push(working[idx])
      } else if (idx >= 0) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }
      } else {
        working.push(row)
        affected.push(row)
      }
    }
    await putRows(table, affected)
  } else if (m.type === 'update') {
    for (let i = 0; i < working.length; i++) {
      if (q._filters.every((f) => f(working[i]))) {
        working[i] = { ...working[i], ...m.payload }
        if ('updated_at' in working[i] && !('updated_at' in m.payload)) working[i].updated_at = now
        affected.push(working[i])
      }
    }
    await putRows(table, affected)
  } else if (m.type === 'delete') {
    affected = working.filter((r) => q._filters.every((f) => f(r)))
    await deleteRows(table, affected.map((r) => r.id))
  }

  const parsed = parseSelect(q._select)
  const tablesMap = { [table]: working }
  for (const p of parsed) if (p.kind === 'embed' && !(p.table in tablesMap)) tablesMap[p.table] = await loadTable(p.table)
  let data = affected.map((r) => shapeRow(r, parsed, table, tablesMap))
  if (q._single || q._maybeSingle) {
    if (!affected.length) {
      if (q._maybeSingle) return { data: null, error: null }
      return { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
    }
    data = data[0]
  }
  return { data, error: null }
}

// ---------- public client assembly lives in ./client.js ----------

export { Query, execQuery, loadTable, putRows, deleteRows, tx, invalidate }
