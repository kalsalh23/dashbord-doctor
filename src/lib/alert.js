// ============================================================
// تنبيه صوتي داخل التطبيق — بلا ملفات صوت: نغمة تُولَّد عبر WebAudio
//   new       → حجز/موعد جديد (نغمتان متتاليتان)
//   emergency → حالة إسعافية (ثلاث نغمات متكرّرة بأسلوب تنبيه)
//   done      → تأكيد حفظ (نغمة قصيرة هادئة)
// ============================================================

let ctx = null

function audio() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!ctx) ctx = new Ctx()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function beep(c, { freq = 880, at = 0, dur = 0.16, type = 'sine', gain = 0.16 }) {
  const osc = c.createOscillator()
  const amp = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = c.currentTime + at
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(amp).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

/** تشغيل نغمة التنبيه — تُتجاهل بهدوء إن لم يُسمح بالصوت أو لم تُفتح الصفحة بعد */
export function playAlert(kind = 'new') {
  try {
    const c = audio()
    if (!c) return
    if (kind === 'new') {
      beep(c, { freq: 784, at: 0, dur: 0.15 })
      beep(c, { freq: 1046, at: 0.17, dur: 0.2 })
    } else if (kind === 'emergency') {
      for (let i = 0; i < 3; i++) {
        beep(c, { freq: 988, at: i * 0.22, dur: 0.12, type: 'triangle', gain: 0.2 })
        beep(c, { freq: 740, at: i * 0.22 + 0.1, dur: 0.12, type: 'triangle', gain: 0.2 })
      }
    } else {
      beep(c, { freq: 660, at: 0, dur: 0.12, gain: 0.12 })
    }
  } catch {
    /* لا صوت — التنبيه المرئي يكفي */
  }
}

/** فتح قناة الصوت بعد أول لمسة (سياسة المتصفحات) */
export function unlockAudio() {
  try {
    const c = audio()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
  } catch {
    /* تجاهل */
  }
}
