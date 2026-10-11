// ============================================================
// تجميع عميل قاعدة البيانات المحلية — نفس شكل عميل supabase-js
// المستخدم في التطبيق: from / rpc / auth / storage
// ============================================================
import { setSeedGate } from './db.js'
import { ensureSeeded } from './seed.js'
import { createLocalAuth } from './auth.js'
import { createLocalStorage } from './storage.js'
import { runRpc } from './rpc.js'
import { Query, execQuery } from './db.js'

// أول شيء: اضمن تحميل البيانات المصدرية قبل أي استعلام
export const localReady = ensureSeeded().catch(() => {})
setSeedGate(localReady)

const auth = createLocalAuth()

export const localClient = {
  __local: true,
  from(table) {
    return new Query(table, execQuery)
  },
  async rpc(fn, args = {}) {
    try {
      const data = await runRpc(this, auth.__internal, fn, args)
      return { data, error: null }
    } catch (e) {
      return { data: null, error: { message: e?.message || String(e) } }
    }
  },
  auth,
  storage: createLocalStorage(),
}
