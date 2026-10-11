// ============================================================
// قائمة حسابات الأطباء على هذا الجهاز (لزر «تبديل الحساب»)
// منطق تخزين صحيح بلا اعتماد على عميل قاعدة البيانات —
// تُحفظ الحسابات التي سجّلت الدخول من هذا الجهاز مع بيانات جلستها،
// فيصبح التبديل بين العيادتين بضغطة واحدة بلا إعادة كلمة المرور.
// (مثال: عيادة الدكتور محمد عارف والدكتورة ريام — تطبيق واحد ولكل حساب لوحته)
// ============================================================

const KEY = 'cm_accounts'

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* لا مساحة تخزين — التبديل لن يعمل لكن التطبيق يستمر */
  }
}

/**
 * حفظ/تحديث حساب في قائمة هذا الجهاز — يُستدعى عند تسجيل الدخول
 * وكلما تغيّرت الجلسة (فتح التطبيق أو تحديث التوكن).
 * session: كائن الجلسة الحالي — session.local_session يوضّح وضع العمل بلا إنترنت.
 */
export function rememberAccount(session, profile, isLocal = false) {
  const userId = session?.user?.id || profile?.id
  if (!userId) return
  const entry = {
    id: userId,
    email: session?.user?.email || profile?.email || '',
    name: profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email || '',
    role: profile?.role || session?.user?.user_metadata?.role || '',
    specialty: profile?.specialty_key || profile?.clinic?.specialty_key || '',
    clinic: profile?.clinic?.name || '',
    // بيانات استعادة الجلسة عند التبديل
    access_token: session?.access_token || null,
    refresh_token: session?.refresh_token || null,
    local_session: isLocal ? session || null : null,
    at: Date.now(),
  }
  write([...read().filter((a) => a.id !== userId), entry])
}

/** الحسابات الأخرى المحفوظة على هذا الجهاز (بدون الحساب الحالي) */
export function otherAccounts(currentUserId) {
  return read()
    .filter((a) => a.id !== currentUserId && (a.access_token || a.local_session))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
}

/** إزالة حساب من قائمة هذا الجهاز (لا يمس الحساب نفسه) */
export function forgetAccount(userId) {
  write(read().filter((a) => a.id !== userId))
}
