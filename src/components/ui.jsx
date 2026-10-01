import { useEffect } from 'react'
import { X, Loader2, Search, CheckCircle2, AlertTriangle, Info, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'

/* ------------------------------ Button ------------------------------ */
const btnVariants = {
  primary: 'bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm',
  dangerGhost: 'text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
}
const btnSizes = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
}

export function Button({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

/* ------------------------------ Card ------------------------------ */
export function Card({ title, subtitle, actions, children, className = '', bodyClass = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="text-sm font-bold text-slate-800">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-4 sm:p-5 ${bodyClass}`}>{children}</div>
    </section>
  )
}

/* ------------------------------ Badges ------------------------------ */
export const APPT_STATUS = {
  new: { label: 'طلب جديد', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  confirmed: { label: 'مؤكد', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  arrived: { label: 'وصل', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  waiting: { label: 'بانتظار الكشف', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  in_consultation: { label: 'قيد الكشف', cls: 'bg-teal-50 text-teal-800 border-teal-200' },
  completed: { label: 'مكتمل', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'ملغى', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  no_show: { label: 'لم يحضر', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export const PAY_STATUS = {
  paid: { label: 'مدفوع', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  due_later: { label: 'مستحق لاحقًا', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
}

export const FU_STATUS = {
  pending: { label: 'قيد الانتظار', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  scheduled: { label: 'تم الحجز', cls: 'bg-teal-50 text-teal-800 border-teal-200' },
  completed: { label: 'مكتمل', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'ملغى', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}

export function Badge({ map, value, className = '' }) {
  const item = map[value] || { label: value, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${item.cls} ${className}`}>
      {item.label}
    </span>
  )
}

export function Tag({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    teal: 'bg-primary-50 text-primary-800',
    amber: 'bg-amber-50 text-amber-800',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${tones[tone]} ${className}`}>{children}</span>
}

/* ------------------------------ Form fields ------------------------------ */
export function Field({ label, required, children, hint, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label-base">{label}{required && <span className="text-rose-500"> *</span>}</label>}
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

export const Input = (props) => <input {...props} className={`input-base ${props.className || ''}`} />
export const Textarea = (props) => <textarea {...props} className={`input-base min-h-[80px] resize-y ${props.className || ''}`} />
export const Select = ({ children, ...props }) => (
  <select {...props} className={`input-base ${props.className || ''}`}>{children}</select>
)

export function SearchInput({ value, onChange, placeholder, className = '', autoFocus }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="input-base pr-9"
        type="search"
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
      aria-pressed={checked}
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary-700' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? '-translate-x-4' : '-translate-x-0.5'}`} />
      </span>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </button>
  )
}

/* ------------------------------ Modal ------------------------------ */
export function Modal({ open, onClose, title, subtitle, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="إغلاق">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, title, message, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', danger, loading, onConfirm }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-start gap-2">
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  )
}

/* ------------------------------ States ------------------------------ */
export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={22} />
      </div>
      <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'جارٍ التحميل...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-10 text-slate-400 ${className}`}>
      <Loader2 className="animate-spin text-primary-600" size={24} />
      <span className="text-xs">{label}</span>
    </div>
  )
}

export function SkeletonRows({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, tone = 'slate', hint, to }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    teal: 'bg-primary-50 text-primary-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-colors h-full">
      {Icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={18} />
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-0.5 text-xl font-bold leading-6 text-slate-800">{value}</div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</div>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-colors ${value === t.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t.label}
          {t.count != null && <span className="ms-1 text-[10px] text-slate-400">({t.count})</span>}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, className = 'h-10 w-10 text-sm' }) {
  const letter = (name || '؟').trim().charAt(0)
  return (
    <span className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary-50 font-bold text-primary-800 ring-1 ring-primary-100 ${className}`}>
      {letter}
    </span>
  )
}

/* ------------------------------ Toasts ------------------------------ */
export function Toasts({ toasts }) {
  const icons = {
    success: <CheckCircle2 size={17} className="text-emerald-500" />,
    error: <AlertTriangle size={17} className="text-rose-500" />,
    info: <Info size={17} className="text-blue-500" />,
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-lg"
        >
          {icons[t.type] || icons.info}
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-bold text-slate-800 sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
