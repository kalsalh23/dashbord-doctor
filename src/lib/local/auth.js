// ============================================================
// المصادقة المحلية — بديل Supabase Auth بلا إنترنت
// المستخدمون في جدول __users (يُملأ من seed-data.json) وكلمات المرور
// محفوظة بنفس هاشات bcrypt القادمة من Supabase فيُحفظ نفس كلمات المرور.
// ============================================================
import bcrypt from 'bcryptjs'
import { tx, loadTable, putRows } from './db.js'

const SESSION_KEY = 'cm_local_session'
const USERS = '__users'

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESSION_KEY)
}

const listeners = new Set()
function emit(event, session) {
  for (const cb of [...listeners]) {
    try {
      cb(event, session)
    } catch {
      /* listener errors must not break auth */
    }
  }
}

function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: u.raw_user_meta_data || {},
    app_metadata: { provider: 'email', providers: ['email'] },
    created_at: u.created_at,
  }
}

export function createLocalAuth() {
  let current = readSession()

  return {
    async getSession() {
      return { data: { session: current }, error: null }
    },

    async getUser() {
      return { data: { user: current?.user || null }, error: null }
    },

    async signInWithPassword({ email, password }) {
      const em = String(email || '').trim().toLowerCase()
      const users = await loadTable(USERS)
      const user = users.find((u) => String(u.email || '').toLowerCase() === em)
      if (!user || !user.password_hash || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
        return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', code: 400 } }
      }
      current = {
        user: publicUser(user),
        access_token: 'local',
        refresh_token: 'local',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }
      writeSession(current)
      emit('SIGNED_IN', current)
      return { data: { user: current.user, session: current }, error: null }
    },

    async signOut() {
      current = null
      writeSession(null)
      emit('SIGNED_OUT', null)
      return { error: null }
    },

    // استعادة جلسة محفوظة — للتبديل بين حسابات الأطباء على نفس الجهاز
    async restoreSession(session) {
      if (!session?.user) return { data: { session: null }, error: { message: 'INVALID_SESSION' } }
      current = session
      writeSession(current)
      emit('SIGNED_IN', current)
      return { data: { session: current }, error: null }
    },

    onAuthStateChange(cb) {
      listeners.add(cb)
      // match supabase-js: an INITIAL_SESSION event fires right after subscribing
      Promise.resolve().then(() => cb('INITIAL_SESSION', current))
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(cb)
            },
          },
        },
      }
    },

    // internal helpers used by the local rpc implementations
    __internal: {
      async createUser({ id, email, password, full_name, role }) {
        const hash = bcrypt.hashSync(String(password), 10)
        const row = {
          id: id || crypto.randomUUID(),
          email: String(email).trim().toLowerCase(),
          password_hash: hash,
          raw_user_meta_data: { full_name, role },
          created_at: new Date().toISOString(),
        }
        await putRows(USERS, [row])
        return row
      },
      async setPassword(userId, newPassword) {
        const users = await loadTable(USERS)
        const u = users.find((x) => x.id === userId)
        if (!u) throw new Error('USER_NOT_FOUND')
        u.password_hash = bcrypt.hashSync(String(newPassword), 10)
        await putRows(USERS, [u])
      },
      async findEmail(userId) {
        const users = await loadTable(USERS)
        return users.find((x) => x.id === userId)?.email || null
      },
      async emailExists(email) {
        const users = await loadTable(USERS)
        const em = String(email).trim().toLowerCase()
        return users.some((u) => String(u.email || '').toLowerCase() === em)
      },
      async allUsers() {
        return loadTable(USERS)
      },
    },
  }
}
