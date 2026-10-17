// ============================================================
// تنبيه صوتي داخل التطبيق — بلا ملفات صوت: نغمة تُولَّد عبر WebAudio
//   new       → حجز/موعد جديد (نغمتان متتاليتان)
//   emergency → حالة إسعافية (ثلاث نغمات متكرّرة بأسلوب تنبيه)
//   done      → تأكيد حفظ (نغمة قصيرة هادئة)
//
// خيار { loud: true } لعيادات الصالات الصاخبة (د. عارف ود. ريام):
// صوت عالٍ (gain أعلى) + نغمات أطول وأكثر تكراراً + ذيل ارتجاج خفيف
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

function beep(c, { freq = 880, at = 0, dur = 0.16, type = 'sine', gain = 0.16, harmonics = 0 }) {
  const t0 = c.currentTime + at
  const amp = c.createGain()
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  // الطبقات التوافقية تزيد حِدّة الصوت وتملأه (تجعل النغمة أعلى وأوضح)
  const oscs = [c.createOscillator()]
  oscs[0].type = type
  oscs[0].frequency.value = freq
  for (let i = 1; i <= harmonics; i++) {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq * (i + 1)
    oscs.push(o)
  }
  for (const o of oscs) o.connect(amp)
  amp.connect(c.destination)
  for (const o of oscs) {
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  }
}

/** تشغيل نغمة التنبيه — تُتجاهل بهدوء إن لم يُسمح بالصوت أو لم تُفتح الصفحة بعد */
export function playAlert(kind = 'new', { loud = false } = {}) {
  try {
    const c = audio()
    if (!c) return
    // voice: صوت عالٍ ومُحسَّن للعيادات الصاخبة
    const G = loud ? 0.95 : 0.16
    const H = loud ? 2 : 0 // طبقات توافقية
    if (kind === 'new') {
      if (loud) {
        // وصول إشعار/حجز موعد: ثلاث نغمات صاعدة تتكرر مرتين — أطول وأعلى
        for (let r = 0; r < 2; r++) {
          const o = r * 0.9
          beep(c, { freq: 784, at: o, dur: 0.2, gain: G, harmonics: H })
          beep(c, { freq: 988, at: o + 0.22, dur: 0.2, gain: G, harmonics: H })
          beep(c, { freq: 1319, at: o + 0.44, dur: 0.34, gain: G, harmonics: H })
        }
      } else {
        beep(c, { freq: 784, at: 0, dur: 0.15 })
        beep(c, { freq: 1046, at: 0.17, dur: 0.2 })
      }
    } else if (kind === 'emergency') {
      const reps = loud ? 5 : 3
      const step = loud ? 0.3 : 0.22
      for (let i = 0; i < reps; i++) {
        beep(c, { freq: 988, at: i * step, dur: loud ? 0.16 : 0.12, type: 'triangle', gain: G, harmonics: H })
        beep(c, { freq: 740, at: i * step + 0.14, dur: loud ? 0.16 : 0.12, type: 'triangle', gain: G, harmonics: H })
      }
    } else {
      beep(c, { freq: 660, at: 0, dur: loud ? 0.22 : 0.12, gain: loud ? G : 0.12, harmonics: H })
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
