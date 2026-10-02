import { useState } from 'react'
import { BellRing, Check } from 'lucide-react'
import { subscribeStaffPush } from '../lib/staffPush'
import { Card, Button } from './ui'

/** تفعيل الإشعارات الفورية على هذا الجهاز — Web Push قياسي مجاني بلا حدود */
export default function PushSetupCard() {
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

  return (
    <Card title="الإشعارات الفورية على هذا الجهاز" subtitle="استلم إشعارات العيادة فوراً حتى لو كان التطبيق مغلقاً — مجاني وبلا حدود">
      <div className="flex items-center gap-4">
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${state === 'on' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
          {state === 'on' ? <Check size={26} /> : <BellRing size={26} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">
            {state === 'on' ? 'الإشعارات مفعّلة على هذا الجهاز ✅' : 'الإشعارات غير مفعّلة'}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            كل إشعار في النظام (طلب حجز جديد من دليل طبي، قبول، نقل مريض، متابعة، إلغاء) يظهر فوراً على شاشة هذا الجهاز.
          </p>
        </div>
        {state !== 'on' && (
          <Button onClick={enable} loading={busy}>
            تفعيل الإشعارات
          </Button>
        )}
      </div>
    </Card>
  )
}
