import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react'

/**
 * لوحة رسم حرّ — للرسوم اليدوية أثناء الكشف
 * تُستخدم للتعليق على الرسم التشريحي (طبقة شفافة فوقه) أو للرسم الحر.
 *
 * props:
 *   - value      : رابط صورة (dataURL) محفوظ — null إن لم يوجد رسم
 *   - onChange   : (dataURL|null) => void  — يُستدعى بعد كل خط مرسوم
 *   - height     : ارتفاع اللوحة بالبكسل
 *   - transparent: خلفية شفافة (للتعليق فوق الرسم التشريحي)
 *   - readOnly   : عرض الرسم المحفوظ فقط بلا أدوات
 */

const COLORS = [
  { key: 'red', value: '#e11d48' },
  { key: 'ink', value: '#0f172a' },
  { key: 'blue', value: '#0284c7' },
  { key: 'green', value: '#059669' },
  { key: 'amber', value: '#d97706' },
]

const WIDTHS = { thin: 2, mid: 4, thick: 7 }

export default function SketchCanvas({
  value = null,
  onChange,
  height = 260,
  transparent = true,
  readOnly = false,
  className = '',
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [strokes, setStrokes] = useState([])
  const [activeStroke, setActiveStroke] = useState(null)
  const [color, setColor] = useState(COLORS[0].value)
  const [width, setWidth] = useState(WIDTHS.mid)
  const [erasing, setErasing] = useState(false)
  const [size, setSize] = useState({ w: 0, h: height })

  /* ---------- قياس اللوحة ---------- */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) })
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  /* ---------- رسم الخطوط على اللوحة ---------- */
  const paint = useCallback((ctx, list, w, h) => {
    ctx.clearRect(0, 0, w, h)
    for (const s of list) {
      if (!s.points.length) continue
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = s.color
      ctx.lineWidth = (s.width / 100) * Math.min(w, h) * 0.6 + 1
      ctx.globalAlpha = s.erase ? 1 : 0.95
      ctx.beginPath()
      ctx.moveTo(s.points[0].x * w, s.points[0].y * h)
      for (let i = 1; i < s.points.length; i++) {
        const p = s.points[i]
        const prev = s.points[i - 1]
        // منحنى ناعم (mid-point quadratic)
        const mx = ((prev.x + p.x) / 2) * w
        const my = ((prev.y + p.y) / 2) * h
        ctx.quadraticCurveTo(prev.x * w, prev.y * h, mx, my)
      }
      const last = s.points[s.points.length - 1]
      ctx.lineTo(last.x * w, last.y * h)
      ctx.stroke()
      ctx.restore()
    }
  }, [])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(size.w * dpr)
    cv.height = Math.round(size.h * dpr)
    const ctx = cv.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, strokes, size.w, size.h)
  }, [strokes, size, paint])

  /* ---------- تصدير الرسم كصورة ---------- */
  const exportImage = useCallback(
    (list) => {
      const w = Math.round(size.w * 2)
      const h = Math.round(size.h * 2)
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const ctx = out.getContext('2d')
      if (!transparent) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
      }
      paint(ctx, list, w, h)
      try {
        return out.toDataURL('image/png')
      } catch {
        return null
      }
    },
    [size, transparent, paint]
  )

  /* ---------- تفاعل الرسم ---------- */
  const pointFrom = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width))),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height))),
    }
  }

  const onPointerDown = (e) => {
    if (readOnly) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const s = { color: erasing ? '#ffffff' : color, width, erase: erasing, points: [pointFrom(e)] }
    setActiveStroke(s)
    setStrokes((prev) => [...prev, s])
  }

  const onPointerMove = (e) => {
    if (!activeStroke) return
    const p = pointFrom(e)
    setStrokes((prev) => {
      if (!prev.length) return prev
      const last = { ...prev[prev.length - 1], points: [...prev[prev.length - 1].points, p] }
      return [...prev.slice(0, -1), last]
    })
  }

  const onPointerUp = () => {
    if (!activeStroke) return
    setActiveStroke(null)
    // تُصدَّر الصورة بعد استقرار آخر خط
    setTimeout(() => {
      setStrokes((current) => {
        if (current.length) onChange?.(exportImage(current))
        return current
      })
    }, 0)
  }

  const undo = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1)
      onChange?.(next.length ? exportImage(next) : null)
      return next
    })
  }

  const clear = () => {
    setStrokes([])
    onChange?.(null)
  }

  /* ---------- عرض صورة محفوظة (وضع القراءة فقط) ---------- */
  if (readOnly) {
    if (!value) {
      return (
        <div
          className={`flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400 ${className}`}
          style={{ height }}
        >
          لا توجد رسوم محفوظة لهذه الزيارة
        </div>
      )
    }
    return (
      <img
        src={value}
        alt="رسوم الكشف"
        className={`w-full rounded-2xl border border-slate-200 bg-white ${className}`}
      />
    )
  }

  return (
    <div className={className}>
      {/* أدوات الرسم */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setColor(c.value)
                setErasing(false)
              }}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                !erasing && color === c.value ? 'scale-110 border-slate-700' : 'border-transparent'
              }`}
              style={{ background: c.value }}
              aria-label={`لون ${c.key}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {Object.entries(WIDTHS).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setWidth(v)}
              className={`flex h-6 w-8 items-center justify-center rounded-lg transition-colors ${
                width === v ? 'bg-primary-600' : 'hover:bg-slate-100'
              }`}
              aria-label="سماكة الخط"
            >
              <span
                className={`block rounded-full ${width === v ? 'bg-white' : 'bg-slate-500'}`}
                style={{ width: v + 1, height: v + 1 }}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setErasing((v) => !v)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold transition-colors ${
            erasing ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {erasing ? <Eraser size={14} /> : <Pencil size={14} />}
          ممحاة
        </button>

        <button
          type="button"
          onClick={undo}
          disabled={strokes.length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <Undo2 size={14} />
          تراجع
        </button>

        <button
          type="button"
          onClick={clear}
          disabled={strokes.length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-40"
        >
          <Trash2 size={14} />
          مسح
        </button>
      </div>

      {/* مساحة الرسم */}
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{ height }}
      >
        {!transparent && <div className="pointer-events-none absolute inset-0 bg-white" />}
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ cursor: 'crosshair' }}
        />
      </div>
    </div>
  )
}

export { COLORS as SKETCH_COLORS }
