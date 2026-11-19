import { z } from 'zod'

/**
 * Configuracion de entorno publica de la app movil.
 *
 * Los valores `EXPO_PUBLIC_*` se inyectan en tiempo de build por Metro/babel
 * (y se pueden sobreescribir desde un `.env`). Se mantienen valores por defecto
 * para que la app funcione aunque no exista `.env`; la clave de Supabase es
 * publica (publishable/anon), no es un secreto.
 */

const DEFAULT_API_BASE_URL = 'https://scaccess-api.onrender.com/api/v1'
const DEFAULT_SUPABASE_URL = 'https://vomjmyqxbqgndndvpaqb.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_wtHSrYnWHPT5T2yBvcXuxA_yQkTD4Ln'

/** Elimina una o mas barras al final de una URL. */
function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

const envSchema = z.object({
  API_BASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
})

const rawEnv = {
  API_BASE_URL: trimTrailingSlashes(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  ),
  SUPABASE_URL: trimTrailingSlashes(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
  ),
  SUPABASE_ANON_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY,
}

export const env = envSchema.parse(rawEnv)
