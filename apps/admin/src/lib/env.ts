const DEFAULT_API_BASE_URL = 'https://scaccess-api.onrender.com'
const DEFAULT_SUPABASE_URL = 'https://vomjmyqxbqgndndvpaqb.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_wtHSrYnWHPT5T2yBvcXuxA_yQkTD4Ln'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export const clientEnv = {
  apiBaseUrl: stripTrailingSlash(
    (import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL,
  ),
  supabaseUrl: stripTrailingSlash(
    (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL,
  ),
  supabaseAnonKey:
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY,
} as const
