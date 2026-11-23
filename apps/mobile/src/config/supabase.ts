import 'react-native-url-polyfill/auto'

import { createClient } from '@supabase/supabase-js'

import { env } from './env'
import { appStorage } from './storage'

/**
 * Cliente Supabase Auth usando almacenamiento multiplataforma:
 * SecureStore (Keychain / Keystore) en movil y localStorage protegido en web.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: appStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
