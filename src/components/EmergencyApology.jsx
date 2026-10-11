import { useEffect, useState } from 'react'
import { MessageCircle, Check, PhoneOff } from 'lucide-react'
import { Modal, Button, Textarea, Tag } from './ui'
import { useApp } from '../lib/store'
import { supabase } from '../lib/supabase'
import { normalizePhone } from '../lib/format'

/**
 * إرسال اعتذار الحالة الإسعافية — عيادة د. نزار (قالب nizar)
 * بعد ضغط «حالة إسعافية» تظهر قائمة مرضى اليوم المتأثرين:
 * رسالة اعتذار واحدة قابلة للتعديل تُرسل لكل مريض عبر واتساب
 * (يُفتح wa.me برسالة جاهزة) ويُسجَّل الإرسال في ملاحظات موعده.
 */
export default function EmergencyApology({ open, onClose, targets }) {
  const { profile, settings, toast } = useApp()
  const [message, setMessage] = useState('')
  const [sentIds, setSentIds] = useState(() => new Set())
  const [busyId, setBusyId] = useState(null)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const doctorName = settings?.doctor_name || profile?.clinic?.name || 'الطبيب'
  const list = targets?.list || []

  useEffect(() => {
    if (!open || !targets) return
    setSentIds(new Set())
    const extra = targets.note ? ` ${targets.note}` : ''
    setMessage(
      `عزيزي {patient}، نعتذر منكم — ${doctorName} لن يستقبل مرضاه اليوم بسبب حالة إسعافية طارئة.${extra} سيتم التواصل معكم لإعادة الحجز في أقرب فرصة. شكراً لتفهمكم.`
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targets])

  if (!targets) return null

  const textFor = (p) =>
    message.replaceAll('{patient}', p.patient_name || '').replaceAll('{doctor}', doctorName)

  const send = async (p) => {
    const phone = normalizePhone(p.phone, settings?.whatsapp_country_code)
    if (!phone) return toast('error', 'لا يوجد رقم واتساب صالح لهذا المريض')
    // التطبيق يعمل بلا إنترنت — لكن فتح واتساب نفسه يحتاج اتصالاً على الجهاز
    if (!navigator.onLine) {
      toast('error', 'لا يوجد اتصال إنترنت — انسخ الرسالة (زر النسخ) وأرسلها من هاتفك عند توفر الاتصال')
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(textFor(p))}`, '_blank', 'noopener')
    setBusyId(p.id)
    try {
      const { data: row } = await supabase.from('appointments').select('notes').eq('id', p.id).maybeSingle()
      await supabase
        .from('appointments')
        .update({
          notes: [row?.notes, `أُرسل اعتذار واتساب — ${new Date().toTimeString().slice(0, 5)}`].filter(Boolean).join(' — '),
        })
        .eq('id', p.id)
      setSentIds((s) => new Set([...s, p.id]))
    } catch {
      toast('error', 'تعذر تسجيل الإرسال — أُرسلت الرسالة لكن لم تُسجل')
      setSentIds((s) => new Set([...s, p.id]))
    } finally {
      setBusyId(null)
    }
  }

  const copyFor = async (p) => {
    const text = textFor(p)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // احتياط للبيئات بلا حافظة حديثة: تحديد مؤقت + أمر نسخ قديم
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch { ok = false }
      ta.remove()
      if (!ok) return toast('error', 'تعذر النسخ — حدد نص الرسالة أعلاه وانسخه يدوياً')
    }
    toast('success', `نُسخت رسالة ${p.patient_name} — ألصقها في واتساب عند توفر الاتصال`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="إرسال اعتذار لمرضى اليوم"
      subtitle={`${list.length} مريض${targets.cancelled ? ' — أُلغيت مواعيدهم اليوم' : ''} · أُرسل لـ ${sentIds.size} من ${list.length}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            يُفتح واتساب برسالة جاهزة على رقم كل مريض — اضغط إرسال في واتساب ثم «أرسلت» ليُسجل في النظام.
          </p>
          <Button variant="secondary" onClick={onClose}>
            إنهاء
          </Button>
        </div>
      }
    >
      <p className="label-base">نص الاعتذار (يُرسل للجميع — استخدم {'{patient}'} لاسم المريض)</p>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />

      {!online && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] leading-relaxed text-rose-700">
          لا يوجد اتصال إنترنت على هذا الجهاز — فتح واتساب لن يعمل الآن.
          استخدم زر «نسخ» بجانب كل مريض وأرسل الرسالة من هاتفك عند توفر الاتصال. (قائمة المرضى والرسائل كلها من قاعدة بيانات التطبيق المحلية — لا تحتاج إنترنت)
        </p>
      )}

      <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {list.map((p) => {
          const sent = sentIds.has(p.id)
          const noPhone = !normalizePhone(p.phone, settings?.whatsapp_country_code)
          return (
            <li key={p.id} className={`flex flex-wrap items-center gap-3 px-3.5 py-2.5 ${sent ? 'bg-emerald-50/50' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{p.patient_name || '—'}</p>
                <p className="text-[11px] text-slate-400">
                  موعد <span dir="ltr">{p.start_time?.slice(0, 5)}</span>
                  {p.phone && <span dir="ltr"> · {p.phone}</span>}
                </p>
              </div>
              {sent ? (
                <Tag tone="teal">
                  <Check size={11} />
                  أُرسل الاعتذار
                </Tag>
              ) : noPhone ? (
                <Tag tone="amber">
                  <PhoneOff size={11} />
                  بلا واتساب — اتصال يدوي
                </Tag>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => copyFor(p)}>
                    نسخ
                  </Button>
                  <Button size="sm" variant={busyId === p.id ? 'secondary' : 'primary'} loading={busyId === p.id} onClick={() => send(p)}>
                    <MessageCircle size={14} />
                    واتساب
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
