import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { BellRing, Copy, ExternalLink } from 'lucide-react'
import { useApp } from '../lib/store'
import { Card, Button } from './ui'

/**
 * External push setup: staff install the free ntfy app and subscribe to the
 * clinic topic — from then on every notification reaches their phone instantly,
 * even when this app is closed.
 */
export default function PushSetupCard() {
  const { profile, toast } = useApp()
  const [qr, setQr] = useState('')
  const topic = profile?.clinic_id ? 'clinica-' + profile.clinic_id : ''
  const url = topic ? 'https://ntfy.sh/' + topic : ''

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#0f766e', light: '#ffffff' } }).then(setQr)
  }, [url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(topic)
      toast('success', 'تم نسخ اسم القناة')
    } catch {
      toast('error', 'تعذر النسخ — انسخه يدوياً: ' + topic)
    }
  }

  if (!topic) return null

  return (
    <Card title="الإشعارات الفورية على الجوال" subtitle="استلم إشعارات العيادة فوراً حتى لو كان التطبيق مغلقًا">
      <div className="flex flex-wrap items-start gap-5">
        <div className="text-center">
          {qr ? (
            <img src={qr} alt="رمز الاشتراك" className="h-32 w-32 rounded-lg border border-slate-200" />
          ) : (
            <div className="h-32 w-32 animate-pulse rounded-lg bg-slate-100" />
          )}
          <p className="mt-1 text-[10px] text-slate-400">امسح بجوال الفريق</p>
        </div>
        <div className="min-w-0 flex-1">
          <ol className="list-inside list-decimal space-y-1.5 text-xs leading-relaxed text-slate-600">
            <li>ثبّت تطبيق <b className="text-slate-800">ntfy</b> من متجر التطبيقات (مجاني)</li>
            <li>افتح التطبيق واضغط <b className="text-slate-800">Subscribe</b></li>
            <li>الصق اسم القناة أو امسح الرمز أعلاه</li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600" dir="ltr">{topic}</code>
            <Button size="sm" variant="secondary" onClick={copy}>
              <Copy size={13} />
              نسخ
            </Button>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost">
                <ExternalLink size={13} />
                فتح القناة
              </Button>
            </a>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <BellRing size={13} className="mt-0.5 shrink-0 text-primary-500" />
            كل إشعار في النظام (طلب حجز، قبول، متابعة جديدة، إلغاء...) يصل فوراً لكل من اشترك بهذه القناة.
          </p>
        </div>
      </div>
    </Card>
  )
}
