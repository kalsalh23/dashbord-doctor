// ============================================================
// التبديل بين حسابات الأطباء على نفس الجهاز
// (مثال: عيادة الدكتور محمد عارف والدكتورة ريام — تطبيق واحد،
//  كل حساب بلوحته وبياناته، وزر للتنقل بينهما بلا إعادة كلمة المرور)
// يعمل في وضعي الإنترنت (جلسة Supabase) والعمل بلا إنترنت (الجلسة المحلية).
// ============================================================
import { supabase } from './supabase'
import { rememberAccount, otherAccounts, forgetAccount } from './accountStore'

export { rememberAccount, otherAccounts, forgetAccount }

/** التبديل إلى حساب آخر: تُستعاد جلسته ثم يُعاد تحميل التطبيق */
export async function switchToAccount(entry) {
  if (!entry) return { ok: false, error: 'no_account' }
  try {
    if (entry.local_session) {
      // وضع العمل بلا إنترنت: استعادة الجلسة المحلية المحفوظة
      const { error } = await supabase.auth.restoreSession(entry.local_session)
      if (error) return { ok: false, error: error.message }
    } else if (entry.access_token && entry.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: entry.access_token,
        refresh_token: entry.refresh_token,
      })
      if (error) return { ok: false, error: error.message }
    } else {
      return { ok: false, error: 'no_session' }
    }
    window.location.reload()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'failed' }
  }
}
