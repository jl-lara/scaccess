import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { UserAccountDto } from '@scaccess/shared'
import { supabase } from '../config/supabase'
import { getMe } from '../api/authApi'
import { MobileApiError } from '../api/httpClient'

/**
 * Estado global de autenticacion de la app movil.
 *
 * `loading` es el estado inicial mientras se restaura la sesion de Supabase;
 * las demas pantallas (AppNavigator) deciden que renderizar segun `status`.
 */
export type AuthStatus = 'loading' | 'signedOut' | 'unsupported' | 'signedIn'

export interface AuthContextValue {
  status: AuthStatus
  userAccount: UserAccountDto | null
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toSignInMessage(error: unknown): string {
  if (error instanceof MobileApiError) {
    if (error.status === 0) {
      return 'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.'
    }
    // 401/500 u otros errores de la API tras autenticarse.
    return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials') || lower.includes('invalid login')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('econnrefused') ||
    lower.includes('unable to resolve')
  ) {
    return 'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.'
  }

  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [userAccount, setUserAccount] = useState<UserAccountDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const { data } = await supabase.auth.getSession()

        if (!data.session) {
          if (!cancelled) {
            setUserAccount(null)
            setStatus('signedOut')
          }
          return
        }

        const account = await getMe()
        if (cancelled) return

        if (account.employeeId === null) {
          setUserAccount(null)
          setStatus('unsupported')
        } else {
          setUserAccount(account)
          setStatus('signedIn')
        }
      } catch {
        // 401, red caida o cualquier error al restaurar: se trata como sesion invalida.
        if (!cancelled) {
          setUserAccount(null)
          setStatus('signedOut')
        }
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        throw authError
      }

      const account = await getMe()
      if (account.employeeId === null) {
        setUserAccount(null)
        setStatus('unsupported')
      } else {
        setUserAccount(account)
        setStatus('signedIn')
      }
    } catch (err) {
      setError(toSignInMessage(err))
      setUserAccount(null)
      setStatus('signedOut')
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignora errores de red al cerrar sesion: el estado local se limpia igualmente.
    } finally {
      setUserAccount(null)
      setError(null)
      setStatus('signedOut')
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, userAccount, error, signIn, signOut, clearError }),
    [status, userAccount, error, signIn, signOut, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
