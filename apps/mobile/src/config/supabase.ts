import 'react-native-url-polyfill/auto'

import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

import { env } from './env'

/**
 * Adaptador que persiste la sesion de Supabase Auth en SecureStore (Keychain /
 * Keystore) en lugar de AsyncStorage, para no guardar el token en claro.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
