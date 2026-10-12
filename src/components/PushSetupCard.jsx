import { useState } from 'react'
import { BellRing, Check, Smartphone, Volume2 } from 'lucide-react'
import { subscribeStaffPush } from '../lib/staffPush'
import { useApp } from '../lib/store'
import { Card, Button } from './ui'

/** تفعيل الإشعارات الفورية على هذا الجهاز — Web Push قياسي مجاني بلا حدود */
export default function PushSetupCard() {
  const { profile } = useApp()
  const [state, setState] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem('staff_push_on') === '1'
      ? 'on'
      : 'off'
  )
  const [busy, setBusy] = useState(false)

  const enable = async () => {
    setBusy(true)
    const r = await subscribeStaffPush()
    setBusy(false)
    if (r === 'ok') {
      localStorage.setItem('staff_push_on', '1')
      setState('on')
    } else if (r === 'denied') {
      alert('تم رفض إذن الإشعارات — فعّله من إعدادات المتصفح لهذا الموقع')
    } else if (r === 'unsupported') {
      alert('هذا المتصفح لا يدعم الإشعارات الفورية')
    } else {
      alert('تعذر التفعيل — أعد المحاولة')
    }
  }

  // قناة التنبيه الصوتي الخارجي على الهاتف (ntfy) — تعمل حتى لو أُغلق التطبيق
  const ntfyTopic = profile?.clinic_id ? `staff-clinic-${profile.clinic_id}` : ''

  return (
    <>
      <Card title="الإشعارات الفورية على هذا الجهاز" subtitle="استلم إشعارات العيادة فوراً حتى لو كان التطبيق مغلقاً — مجاني وبلا حدود">
        <div className="flex items-center gap-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${state === 'on' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {state === 'on' ? <Check size={26} /> : <BellRing size={26} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">
              {state === 'on' ? 'الإشعارات مفعّلة على هذا الجهاز ✅' : 'الإشعارات غير مفعّلة'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
              كل إشعار في النظام (حجز جديد، قبول، نقل مريض، متابعة، إلغاء) يظهر فوراً على شاشة هذا الجهاز.
            </p>
          </div>
          {state !== 'on' && (
            <Button onClick={enable} loading={busy}>
              تفعيل الإشعارات
            </Button>
          )}
        </div>
      </Card>

      {/* تنبيه صوتي خارجي على هاتف الطبيب — عبر تطبيق ntfy المجاني */}
      {ntfyTopic && (
        <Card
          className="mt-3"
          title="تنبيه صوتي على هاتفك (خارج التطبيق)"
          subtitle="مع تنبيه داخل التطبيق — حتى لو كان الجوال مغلقاً أو التطبيق مغلقاً"
        >
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Volume2 size={26} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">اشترك في قناة عيادتك في تطبيق ntfy</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                ثبّت تطبيق <b>ntfy</b> على هاتفك (من Google Play أو App Store) واشترك في القناة التالية — سيصلك كل حجز جديد
                والحالات الإسعافية بصوت واهتزاز. القناة خاصة بعيادتك فقط.
              </p>
              <p className="mt-1.5 select-all rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs text-slate-700" dir="ltr">
                https://ntfy.sh/{ntfyTopic}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(`https://ntfy.sh/${ntfyTopic}`)
                  alert('تم نسخ رابط القناة — الصقه في تطبيق ntfy (اشترك/Subscribe)')
                }}
              >
                <Smartphone size={15} />
                نسخ رابط القناة
              </Button>
              <Button variant="secondary" onClick={() => window.open(`https://ntfy.sh/${ntfyTopic}`, '_blank')}>
                فتح القناة
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
