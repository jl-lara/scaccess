import type { UserAccountDto } from '@scaccess/shared'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { getMe } from '../api/authApi'
import { supabase } from '../config/supabase'
import { toSignInMessage } from '../utils/errorMessages'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [userAccount, setUserAccount] = useState<UserAccountDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusRef = useRef<AuthStatus>(status)
  const manualSignOutRef = useRef(false)
  statusRef.current = status

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled || event !== 'SIGNED_OUT' || manualSignOutRef.current) {
        return
      }
      if (statusRef.current === 'signedIn' || statusRef.current === 'unsupported') {
        setUserAccount(null)
        setError('Tu sesión expiró. Inicia sesión de nuevo.')
        setStatus('signedOut')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
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
    manualSignOutRef.current = true
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignora errores de red al cerrar sesion: el estado local se limpia igualmente.
    } finally {
      manualSignOutRef.current = false
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
