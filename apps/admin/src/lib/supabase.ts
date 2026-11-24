import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clientEnv } from './env'

let supabaseClientInstance: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return supabaseClientInstance
}
