const fs = require('fs');
const p = 'src/pages/doctor/DoctorDashboard.jsx';
let s = fs.readFileSync(p, 'utf8');

// imports
s = s.replace(
  "import { Hourglass, Stethoscope, CalendarDays, FolderOpen, History } from 'lucide-react'",
  "import { Hourglass, Stethoscope, CalendarDays, FolderOpen, History, Siren } from 'lucide-react'"
);
s = s.replace(
  "import { Card, Button, EmptyState, SkeletonRows, Avatar, Badge, APPT_STATUS, PageHeader } from '../../components/ui'",
  "import { Card, Button, EmptyState, SkeletonRows, Avatar, Badge, APPT_STATUS, PageHeader, Modal, Field, Textarea, Toggle, ConfirmDialog } from '../../components/ui'"
);
s = s.replace(
  "import { todayStr, timeToMin, ageFrom, nowMinutes, minToTime } from '../../lib/format'",
  "import { todayStr, timeToMin, ageFrom, nowMinutes, minToTime } from '../../lib/format'\nimport { friendlyDbError } from '../../lib/hooks'"
);
s = s.replace(
  "import { useApp } from '../../lib/store'",
  "import { useApp, audit } from '../../lib/store'"
);

// state + toast
s = s.replace(
  "  const { profile } = useApp()\n  const [appts, setAppts] = useState(null)",
  "  const { profile, toast } = useApp()\n  const [appts, setAppts] = useState(null)"
);
s = s.replace(
  "  const [lastVisitFor, setLastVisitFor] = useState(null) // patient object for the quick-view modal",
  "  const [lastVisitFor, setLastVisitFor] = useState(null) // patient object for the quick-view modal\n  const [emergencyOpen, setEmergencyOpen] = useState(false)\n  const [emergencyNote, setEmergencyNote] = useState('')\n  const [emergencyCancel, setEmergencyCancel] = useState(true)\n  const [emergencyBusy, setEmergencyBusy] = useState(false)\n  const [emergencyDone, setEmergencyDone] = useState(null)"
);

// runEmergency + todayCount before "const queue ="
const emergencyBlock = `  const runEmergency = async () => {
    setEmergencyBusy(true)
    const { data: count, error } = await supabase.rpc('emergency_broadcast', {
      p_note: emergencyNote.trim(),
      p_cancel: emergencyCancel,
    })
    setEmergencyBusy(false)
    if (error) return toast('error', friendlyDbError(error))
    audit(profile.clinic_id, 'emergency_broadcast', 'appointments', null, { notified: count })
    setEmergencyOpen(false)
    setEmergencyNote('')
    setEmergencyDone(count ?? 0)
    load()
  }

  const queue =`;
s = s.replace('  const queue =', emergencyBlock);

// PageHeader actions
s = s.replace(
  `      <PageHeader
        title="عيادة اليوم"
        subtitle={\`\${profile?.full_name} — \${queue.length + current.length} مريض نشط الآن\`}
      />`,
  `      <PageHeader
        title="عيادة اليوم"
        subtitle={\`\${profile?.full_name} — \${queue.length + current.length} مريض نشط الآن\`}
        actions={
          <Button
            variant="dangerGhost"
            onClick={() => setEmergencyOpen(true)}
            disabled={todayCount === 0}
            title={todayCount === 0 ? 'لا توجد مواعيد اليوم' : 'إشعار جماعي لمرضى اليوم'}
          >
            <Siren size={16} />
            حالة إسعافية
          </Button>
        }
      />`
);

// todayCount before queue — the general dashboard defines queue first; inject todayCount after current/upcoming defs
s = s.replace(
  '  const current = (appts || []).filter((a) => a.status === \'in_consultation\')',
  '  const current = (appts || []).filter((a) => a.status === \'in_consultation\')\n  const todayCount = (appts || []).filter((a) => ![\'cancelled\', \'no_show\'].includes(a.status)).length'
);

// modal + done before final close
s = s.replace(
  '    </div>\n  )\n}',
  `      {/* emergency broadcast */}
      <Modal
        open={emergencyOpen}
        onClose={() => !emergencyBusy && setEmergencyOpen(false)}
        title="حالة إسعافية طارئة"
        subtitle={\`سيصل الإشعار لجميع مواعيد اليوم (\${todayCount} مريض)\`}
        footer={
          <div className="flex justify-start gap-2">
            <Button variant="danger" onClick={runEmergency} loading={emergencyBusy}>
              <Siren size={16} />
              إرسال الاعتذار الجماعي
            </Button>
            <Button variant="secondary" onClick={() => setEmergencyOpen(false)} disabled={emergencyBusy}>
              إلغاء
            </Button>
          </div>
        }
      >
        <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          سيُرسل اعتذار جماعي باسمك لكل مرضى اليوم عبر قنواتهم، مع طلب إعادة الحجز.
        </p>
        <Field label="نص إضافي (اختياري)" hint="مثال: الحالة إسعافية في المستشفى — سنرد عليكم لترتيب موعد بديل">
          <Textarea value={emergencyNote} onChange={(e) => setEmergencyNote(e.target.value)} rows={2} />
        </Field>
        <div className="mt-3">
          <Toggle checked={emergencyCancel} onChange={setEmergencyCancel} label="إلغاء مواعيد اليوم أيضاً (لتحرير الأوقات لإعادة الحجز)" />
        </div>
      </Modal>

      <ConfirmDialog
        open={emergencyDone !== null}
        onClose={() => setEmergencyDone(null)}
        title="تم الإرسال بنجاح"
        message={\`وصل الاعتذار لـ \${emergencyDone} مريض عبر قنواتهم\${emergencyCancel ? '، وأُلغيت مواعيدهم اليوم لتحرير الأوقات' : ''}. أُرسل إشعار للاستقبال بالاتصال وترتيب إعادة الحجز.\`}
        confirmLabel="حسناً"
        onConfirm={() => setEmergencyDone(null)}
      />
    </div>
  )
}`
);

fs.writeFileSync(p, s);
console.log('general dashboard emergency button:', s.includes('حالة إسعافية'), '| rpc:', s.includes('emergency_broadcast'));
