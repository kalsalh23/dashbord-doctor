// ============================================================
// اختبار محرك قاعدة البيانات المحلية + المصادقة عبر fake-indexeddb
//   node scripts/test-offline.mjs
// ============================================================
import { indexedDB as fakeIDB } from 'fake-indexeddb'
import { IDBKeyRange } from 'fake-indexeddb'
globalThis.indexedDB = fakeIDB
globalThis.IDBKeyRange = IDBKeyRange

let passed = 0
let failed = 0
function ok(cond, name) {
  if (cond) {
    passed++
    console.log('  ✓ ' + name)
  } else {
    failed++
    console.log('  ✗ FAIL: ' + name)
  }
}

// ---------- db engine ----------
const { Query, execQuery, loadTable, putRows, wipeAll } = await import('../src/lib/local/db.js')
const from = (t) => new Query(t, execQuery)

console.log('— الاستعلامات الأساسية —')
await wipeAll()
await putRows('patients', [
  { id: 'p1', clinic_id: 'c1', full_name: 'أحمد محمد', phone: '0999111222', date_of_birth: '1990-05-01' },
  { id: 'p2', clinic_id: 'c1', full_name: 'سارة علي', phone: '0999333444', date_of_birth: '1985-09-15' },
  { id: 'p3', clinic_id: 'c2', full_name: 'خالد حسن', phone: '0999555666', date_of_birth: '2000-01-10' },
])

let r = await from('patients').select('*').eq('clinic_id', 'c1')
ok(r.data.length === 2 && r.error === null, 'eq filter')

r = await from('patients').select('id, full_name').eq('clinic_id', 'c1').order('full_name')
ok(r.data.length === 2 && r.data[0].full_name === 'أحمد محمد' && r.data[0].phone === undefined, 'select subset + order')

r = await from('patients').select('*').or('full_name.ilike.%سارة%,phone.ilike.%099911%')
ok(r.data.length === 2, 'or + ilike search')

r = await from('patients').select('*').in('id', ['p1', 'p3'])
ok(r.data.length === 2, 'in filter')

r = await from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', 'c1')
ok(r.count === 2, 'count exact')

r = await from('patients').select('id').eq('id', 'nope').maybeSingle()
ok(r.data === null && r.error === null, 'maybeSingle empty')
r = await from('patients').select('id').eq('id', 'nope').single()
ok(r.error && r.error.code === 'PGRST116', 'single empty -> error')

console.log('— الـ embeds (علاقات الجداول) —')
await putRows('clinics', [{ id: 'c1', name: 'عيادة ١' }])
await putRows('profiles', [
  { id: 'd1', clinic_id: 'c1', full_name: 'د. أحمد', role: 'doctor' },
])
await putRows('appointments', [
  { id: 'a1', clinic_id: 'c1', patient_id: 'p1', doctor_id: 'd1', appointment_date: '2026-10-05', start_time: '17:00', status: 'confirmed' },
  { id: 'a2', clinic_id: 'c1', patient_id: 'p2', doctor_id: null, appointment_date: '2026-10-05', start_time: '17:30', status: 'waiting' },
])
await putRows('visits', [
  { id: 'v1', clinic_id: 'c1', patient_id: 'p1', visit_date: '2026-10-01' },
  { id: 'v2', clinic_id: 'c1', patient_id: 'p1', visit_date: '2026-09-01' },
])
await putRows('medications', [
  { id: 'm1', visit_id: 'v1', name: 'باراسيتامول', dosage: '500' },
  { id: 'm2', visit_id: 'v1', name: 'أموكسيسيلين', dosage: '1g' },
  { id: 'm3', visit_id: 'v2', name: 'ايبوبروفين', dosage: '400' },
])

r = await from('appointments')
  .select('id, appointment_date, start_time, status, patient:patients(id, full_name, phone), doctor:profiles(full_name)')
  .eq('appointment_date', '2026-10-05')
  .order('start_time')
ok(r.data[0].patient.full_name === 'أحمد محمد' && r.data[0].doctor.full_name === 'د. أحمد', 'many-to-one embed with alias')
ok(r.data[1].doctor === null, 'null fk -> null embed')

r = await from('visits').select('id, visit_date, medications(*), patient:patients(full_name)').eq('patient_id', 'p1').order('visit_date', { ascending: false })
ok(Array.isArray(r.data[0].medications) && r.data[0].medications.length === 2, 'one-to-many embed (medications)')
ok(r.data[0].patient.full_name === 'أحمد محمد', 'embedded patient on visit')

r = await from('patients').select('id, full_name, visits(visit_date)').eq('id', 'p1')
ok(r.data[0].visits.length === 2, 'one-to-many embed (visits on patients)')

console.log('— التعديلات —')
r = await from('patients').insert({ id: 'p4', clinic_id: 'c1', full_name: 'وليد نور', phone: '0999777888' }).select().single()
ok(r.data && r.data.id === 'p4' && r.data.created_at && r.data.updated_at, 'insert adds id/created_at')

r = await from('patients').insert({ id: 'p4', clinic_id: 'c1', full_name: 'مكرر', phone: 'x' })
ok(r.error && r.error.code === '23505', 'insert duplicate -> error')

r = await from('patients').update({ phone: '0111222333' }).eq('id', 'p4').select().single()
ok(r.data.phone === '0111222333', 'update + select single')

r = await from('patients').upsert({ endpoint: 'e1', val: 1 }, { onConflict: 'endpoint' }).select().single()
r = await from('patients').upsert({ endpoint: 'e1', val: 2 }, { onConflict: 'endpoint' }).select().single()
ok(r.data.val === 2, 'upsert onConflict')
await from('patients').delete().eq('endpoint', 'e1')

r = await from('patients').delete().eq('id', 'p4')
ok(r.error === null, 'delete')
r = await from('patients').select('*').eq('id', 'p4').maybeSingle()
ok(r.data === null, 'deleted row gone')

// persistence across cache invalidation
const { invalidate } = await import('../src/lib/local/db.js')
invalidate('patients')
r = await from('patients').select('*').eq('id', 'p1')
ok(r.data.length === 1, 'persisted after cache invalidation')

console.log('— gte/lte على التواريخ والأوقات —')
r = await from('appointments').select('*').gte('start_time', '17:15')
ok(r.data.length === 1 && r.data[0].id === 'a2', 'time range filter')

console.log('— not مع in (نمط PostgREST) —')
r = await from('appointments').select('*').not('status', 'in', '(cancelled,no_show)')
ok(r.data.length === 2, 'not in excludes cancelled')
r = await from('appointments').select('*').eq('appointment_date', '2026-10-05').not('status', 'in', '(cancelled,no_show)').order('start_time')
ok(r.data.length === 2 && r.data[0].status === 'confirmed', 'not chained with eq/order')

console.log('— المصادقة المحلية —')
// localStorage shim
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
// Node 22 يوفر globalThis.crypto أصلًا

const { createLocalAuth } = await import('../src/lib/local/auth.js')
const auth = createLocalAuth()
const bcrypt = (await import('bcryptjs')).default
await putRows('__users', [
  { id: 'u1', email: 'doc@demo.com', password_hash: bcrypt.hashSync('123456', 10), raw_user_meta_data: { full_name: 'د. تجربة', role: 'doctor' } },
])

let r1 = await auth.signInWithPassword({ email: 'doc@demo.com', password: 'wrong' })
ok(r1.error && !r1.session, 'wrong password rejected')
r1 = await auth.signInWithPassword({ email: 'Doc@Demo.com ', password: '123456' })
ok(r1.data.session && r1.data.user.id === 'u1', 'login ok (case/trim insensitive)')

let events = []
const sub = auth.onAuthStateChange((ev, s) => events.push(ev + ':' + !!s))
await new Promise((res) => setTimeout(res, 10))
ok(events[0] === 'INITIAL_SESSION:true', 'INITIAL_SESSION fired after subscribe')
await auth.signOut()
ok(events.includes('SIGNED_OUT:false'), 'SIGNED_OUT fired')
const sess = await auth.getSession()
ok(sess.data.session === null, 'session cleared after signOut')
sub.data.subscription.unsubscribe()

console.log('— عزل العيادات (RLS محلي) —')
await putRows('profiles', [
  { id: 'u_c1', clinic_id: 'c1', full_name: 'موظف عيادة ١', role: 'reception' },
  { id: 'u_c2', clinic_id: 'c2', full_name: 'موظف عيادة ٢', role: 'reception' },
])
// جلسة موظف عيادة c1
store.set('cm_local_session', JSON.stringify({ user: { id: 'u_c1' }, access_token: 'local' }))

r = await from('patients').select('*') // جدول patients فيه مرضى c1 وc2
ok(r.data.length === 2 && r.data.every((p) => p.clinic_id === 'c1'), 'select auto-scoped to user clinic (2 of 3)')

r = await from('patients').select('*').eq('id', 'p3') // مريض عيادة أخرى
ok(r.data.length === 0, 'cross-clinic row invisible')

r = await from('patients').insert({ full_name: 'جديد بلا عيادة', phone: '000' }).select().single()
ok(r.data.clinic_id === 'c1', 'insert injects user clinic_id')
await from('patients').delete().eq('phone', '000')

// جلسة موظف عيادة c2 يرى بياناته هو
store.set('cm_local_session', JSON.stringify({ user: { id: 'u_c2' } }))
r = await from('patients').select('*')
ok(r.data.length === 1 && r.data[0].id === 'p3', 'switching user switches visible clinic')

// بلا جلسة (كما في الاختبارات/التشغيل قبل الدخول) — لا قيد
store.delete('cm_local_session')
r = await from('patients').select('*')
ok(r.data.length === 3, 'no session -> no scoping (login/bootstrap path)')

console.log('— تبديل الحساب بين طبيبين على نفس الجهاز —')
// reload وهمي حتى لا تُعاد تحميل الصفحة أثناء الاختبار
globalThis.window = { location: { reload() { globalThis.__reloaded = (globalThis.__reloaded || 0) + 1 } } }
const { rememberAccount, otherAccounts, forgetAccount } = await import('../src/lib/accountStore.js')

// حفظ حساب الدكتور (عيادة c1) والانتقال لحساب الدكتورة (عيادة c2)
await auth.restoreSession({ user: { id: 'u_c1' }, access_token: 'local' })
const sessionArif = (await auth.getSession()).data.session
rememberAccount(sessionArif, { id: 'u_c1', full_name: 'د. محمد عارف', role: 'doctor', clinic_id: 'c1', clinic: { name: 'عيادة عارف' } }, true)

await auth.restoreSession({ user: { id: 'u_c2' }, access_token: 'local' })
const sessionRiam = (await auth.getSession()).data.session
rememberAccount(sessionRiam, { id: 'u_c2', full_name: 'د. ريام نصر', role: 'doctor', clinic_id: 'c2', clinic: { name: 'عيادة ريام' } }, true)

let list = otherAccounts('u_c2')
ok(list.length === 1 && list[0].name === 'د. محمد عارف', 'قائمة التبديل تعرض الحساب الآخر فقط')

// التبديل الفعلي: استعادة جلسة الحساب المختار (نفس ما يفعله زر التبديل في الوضع المحلي)
const restored = await auth.restoreSession(list[0].local_session)
ok(!restored.error && restored.data.session.user.id === 'u_c1', 'restoreSession يعيد جلسة الحساب المختار')
r = await from('patients').select('*')
ok(r.data.length === 2 && r.data.every((p) => p.clinic_id === 'c1'), 'بعد التبديل: البيانات معزولة على عيادة الحساب الجديد')

// إزالة حساب من القائمة لا تمس الحساب نفسه
forgetAccount('u_c2')
ok(otherAccounts('u_c1').length === 0, 'forgetAccount يحذف الحساب من قائمة الجهاز')
store.delete('cm_local_session')
store.delete('cm_accounts')

console.log(`\nالنتيجة: ${passed} نجح، ${failed} فشل`)
process.exit(failed ? 1 : 0)
