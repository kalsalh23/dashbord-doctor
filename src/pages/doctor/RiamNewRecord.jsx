import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Upload, X } from 'lucide-react'
import { useApp, audit } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { Button, Card, Field, Input, Textarea } from '../../components/ui'
import { friendlyDbError } from '../../lib/hooks'
import { todayStr } from '../../lib/format'

export default function RiamNewRecord() {
  const { profile, toast } = useApp()
  const nav = useNavigate()
  const [patientQuery, setPatientQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [phone, setPhone] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [importantNotes, setImportantNotes] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const search = async () => {
      if (!profile?.clinic_id || patientQuery.trim().length < 2) {
        setPatients([])
        return
      }
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone')
        .eq('clinic_id', profile.clinic_id)
        .ilike('full_name', `%${patientQuery.trim()}%`)
        .order('full_name')
        .limit(10)
    setPatients(data || [])
    }
    const t = setTimeout(search, 300)
    return () => clearTimeout(t)
  }, [patientQuery, profile?.clinic_id])

  const selectPatient = (p) => {
    setSelectedPatient(p)
    setPatientQuery(p.full_name)
    setPhone(p.phone || '')
    setShowResults(false)
  }

  const addFiles = (e) => {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''
    if (selected.length === 0) return
    setFiles((prev) => [...prev, ...selected].slice(0, 20))
  }

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const save = async () => {
    if (!selectedPatient && !patientQuery.trim()) {
      return toast('error', 'اسم المريض مطلوب')
    }
    if (!phone.trim()) {
      return toast('error', 'رقم الهاتف مطلوب')
    }
    setSaving(true)
    let patientId = selectedPatient?.id

    try {
      if (!patientId) {
        const now = new Date()
        const { data: created, error: cErr } = await supabase
          .from('patients')
          .insert({
            clinic_id: profile.clinic_id,
            full_name: patientQuery.trim(),
            phone: phone.trim(),
            created_by: profile.id,
          })
          .select('id')
          .single()
        if (cErr) throw cErr
        patientId = created.id
      } else if (phone.trim() !== (selectedPatient.phone || '')) {
        await supabase.from('patients').update({ phone: phone.trim() }).eq('id', patientId)
      }

      const { data: visit, error: vErr } = await supabase
        .from('visits')
        .insert({
          clinic_id: profile.clinic_id,
          patient_id: patientId,
          doctor_id: profile.id,
          visit_date: todayStr(),
          diagnosis: diagnosis.trim() || null,
          medical_notes: importantNotes.trim() || null,
        })
        .select('id')
        .single()
      if (vErr) throw vErr

      for (const file of files) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${profile.clinic_id}/${patientId}/${visit.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('attachments')
          .upload(path, file, { contentType: file.type })
        if (upErr) continue
        const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path)
        await supabase.from('attachments').insert({
          clinic_id: profile.clinic_id,
          patient_id: patientId,
          visit_id: visit.id,
          name: file.name,
          category: 'imaging',
          file_type: file.type,
          storage_path: path,
          file_url: pub.publicUrl,
          uploaded_by: profile.id,
        })
      }

      audit(profile.clinic_id, 'create_new_record', 'visits', visit.id, { patient_id: patientId })
      toast('success', 'تم حفظ السجل بنجاح')
      nav('/doctor')
    } catch (err) {
      toast('error', friendlyDbError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => nav(-1)}>
          <ArrowLeft size={16} />
          رجوع
        </Button>
        <h1 className="text-lg font-black text-slate-800">سجل جديد</h1>
      </div>
      <Card>
        <div className="space-y-4">
          <div className="relative">
            <Field label="اسم المريض" required>
              <Input
                value={patientQuery}
                onChange={(e) => {
                  setPatientQuery(e.target.value)
                  setSelectedPatient(null)
                  setShowResults(true)
                }}
                onFocus={() => setShowResults(true)}
                placeholder="اكتب اسم المريض..."
              />
            </Field>
            {showResults && patients.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPatient(p)}
                    className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-right hover:bg-slate-50"
                  >
                    <span className="text-sm font-semibold text-slate-800">{p.full_name}</span>
                    {p.phone && <span className="text-xs text-slate-500">{p.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Field label="رقم الهاتف" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </Field>
          <Field label="التشخيص">
            <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </Field>
          <Field label="معلومات هامة">
            <Textarea value={importantNotes} onChange={(e) => setImportantNotes(e.target.value)} rows={4} />
          </Field>
          <Field label="رفع صور مختلفة">
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2">
                <Upload size={20} className="text-slate-400" />
                <span className="text-xs text-slate-500">اضغط لرفع صور (يمكن رفع عدة صور)</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="truncate text-xs text-slate-700">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-rose-600">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>
          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>
              <Save size={16} />
              حفظ السجل
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
