import { useEffect, useRef, useState } from 'react'
import { Camera, Save, Wallet } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Avatar, Button, Card, Field, Input, PageHeader } from '../../components/ui'
import { friendlyDbError } from '../../lib/hooks'
import PushSetupCard from '../../components/PushSetupCard'

export default function DoctorSettings() {
  const { profile, settings, toast, refreshSettings, refreshProfile } = useApp()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [price, setPrice] = useState(settings?.consultation_price ?? 0)
  const [slotMinutes, setSlotMinutes] = useState(settings?.examination_minutes ?? settings?.consultation_minutes ?? settings?.slot_minutes ?? 15)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (settings) {
      setPrice(settings.consultation_price ?? 0)
      setSlotMinutes(settings.examination_minutes ?? settings.consultation_minutes ?? settings.slot_minutes ?? 15)
    }
  }, [settings])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return toast('error', 'اختر Ù…Ù„Ù ØµÙˆØ±Ø©')
    if (file.size > 2 * 1024 * 1024) return toast('error', 'Ø­Ø¬Ù… Ø§Ù„ØµÙˆØ±Ø© ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ø£Ù‚Ù„ Ù…Ù† 2 Ù…ÙŠØºØ§Ø¨Ø§ÙŠØª')
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = profile.id + '/avatar-' + Date.now() + '.' + ext
    const { error } = await supabase.storage.from('profile-avatars').upload(path, file, { contentType: file.type })
    if (error) { setUploading(false); return toast('error', 'تعذر رفع Ø§Ù„ØµÙˆØ±Ø©: ' + error.message) }
    const { data } = supabase.storage.from('profile-avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id)
    setUploading(false)
    if (dbErr) return toast('error', friendlyDbError(dbErr))
    audit(profile.clinic_id, 'update_avatar', 'profiles', profile.id)
    await refreshProfile()
    toast('success', 'ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„ØµÙˆØ±Ø©')
  }

  const removeAvatar = async () => {
    setAvatarUrl('')
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
    if (error) return toast('error', friendlyDbError(error))
    await refreshProfile()
    toast('success', 'ØªÙ…Øª Ø¥Ø²Ø§Ù„Ø© Ø§Ù„ØµÙˆØ±Ø©')
  }

  const save = async () => {
    if (!fullName.trim()) return toast('error', 'Ø§Ù„Ø§Ø³Ù… Ù…Ø·Ù„ÙˆØ¨')
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), phone: phone.trim() || null, avatar_url: avatarUrl || null }).eq('id', profile.id)
    if (error) { setSaving(false); return toast('error', friendlyDbError(error)) }
    const { error: priceErr } = await supabase.rpc('doctor_set_consultation_price', { p_price: Number(price) || 0 })
    if (priceErr) { setSaving(false); return toast('error', friendlyDbError(priceErr)) }
    const v = Math.max(10, Math.min(60, Number(slotMinutes) || 15))
    const { error: settErr } = await supabase.from('clinic_settings').update({ slot_minutes: v, examination_minutes: v, consultation_minutes: v }).eq('clinic_id', profile.clinic_id)
    setSaving(false)
    if (settErr) return toast('error', friendlyDbError(settErr))
    audit(profile.clinic_id, 'doctor_update_settings', 'profiles', profile.id, { price: Number(price) || 0 })
    await Promise.all([refreshProfile(), refreshSettings()])
    toast('success', 'ØªÙ… Ø§Ù„حفظ')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ø¥Ø¹Ø¯Ø§Ø¯Ø§ØªÙŠ" subtitle="Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙƒ Ùˆسعر Ø§Ù„ÙƒØ´Ù Ùˆوقت Ø§Ù„ÙƒØ´Ù" />
      <div className="space-y-5">
        <Card title="Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙŠ">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative">
              <Avatar name={fullName || profile?.full_name} src={avatarUrl || undefined} className="h-20 w-20 text-xl" />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -end-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-white shadow-md hover:bg-primary-800 disabled:opacity-60" title="ØªØºÙŠÙŠØ± Ø§Ù„ØµÙˆØ±Ø©"><Camera size={15} /></button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Ø§Ù„ØµÙˆØ±Ø© Ø§Ù„Ø´Ø®ØµÙŠØ©</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Ø¨Ø­Ø¯ Ø£Ù‚ØµÙ‰ 2 Ù…ÙŠØºØ§Ø¨Ø§ÙŠØª</p>
              {avatarUrl && (<Button size="sm" variant="ghost" className="mt-1 !text-rose-600" onClick={removeAvatar}>Ø¥Ø²Ø§Ù„Ø© Ø§Ù„ØµÙˆØ±Ø©</Button>)}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ø§Ø³Ù…ÙŠ" required><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <Field label="Ø±Ù‚Ù… Ù‡Ø§ØªÙÙŠ"><Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></Field>
          </div>
        </Card>
        <Card title="سعر Ø§Ù„ÙƒØ´Ù Ùˆوقت Ø§Ù„ÙƒØ´Ù" subtitle="ÙŠÙØ·Ø¨Ù‚ Ø¹Ù„Ù‰ Ø§Ù„Ø­Ø¬ÙˆØ²Ø§Øª Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="سعر Ø§Ù„ÙƒØ´Ù"><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <Field label="وقت Ø§Ù„ÙƒØ´Ù (Ø¯Ù‚ÙŠÙ‚Ø©)" hint="Ø¨ÙŠÙ† 10 Ùˆ 60"><Input type="number" min="10" max="60" value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} /></Field>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><Wallet size={13} />Ø§Ù„Ø¹Ù…Ù„Ø©: {settings?.currency || '”'}</p>
        </Card>
        <PushSetupCard />
        <div className="flex justify-end pb-4"><Button size="lg" onClick={save} loading={saving}><Save size={16} />حفظ Ø§Ù„ØªØºÙŠÙŠØ±Ø§Øª</Button></div>
      </div>
    </div>
  )
}

