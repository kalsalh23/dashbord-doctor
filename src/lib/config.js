// Platform support & developer contact info.
// Override via env vars (VITE_SUPPORT_PHONE / VITE_DEVELOPER_NAME) if needed.
import { normalizePhone } from './format'

export const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '0952639157'
export const SUPPORT_WHATSAPP = normalizePhone(SUPPORT_PHONE, '963')
export const DEVELOPER_NAME = import.meta.env.VITE_DEVELOPER_NAME || 'م. قصي مهند الصالح'
export const DEVELOPER_PHONE = SUPPORT_PHONE

export function supportWhatsAppLink(message) {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`
}

export const LOGIN_SUPPORT_MESSAGE = (email) =>
  'مرحبًا، أحتاج دعمًا في تسجيل الدخول إلى نظام إدارة العيادة (نسيت الحساب أو كلمة المرور).' +
  (email ? `\nالبريد المستخدم: ${email}` : '')
