// ============================================================
// نقطة التبديل بين النسختين:
//  - الوضع المحلي (الافتراضي): قاعدة بيانات IndexedDB بلا إنترنت
//  - الوضع السحابي (VITE_BACKEND=online): Supabase كما كان
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { localClient } from './local/client'

export const supabase =
  import.meta.env.VITE_BACKEND === 'online'
    ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : localClient
