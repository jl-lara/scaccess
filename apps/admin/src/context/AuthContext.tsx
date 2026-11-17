import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { RoleCode, UserAccountDto } from '@scaccess/shared'
import { api, ApiClientError } from '../lib/api'
import { getSupabaseClient } from '../lib/supabase'

const ADMIN_ALLOWED_ROLES: readonly string[] = ['admin', 'operator', 'auditor']

export interface AuthContextValue {
  user: UserAccountDto | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  canWriteCatalog: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function hasAllowedAdminRole(roles: string[]): boolean {
  return roles.some((role) => ADMIN_ALLOWED_ROLES.includes(role))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAccountDto | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadAccountFromBackend = useCallback(async () => {
    try {
      const profile = await api.getMe()
      if (!hasAllowedAdminRole(profile.roles)) {
        await getSupabaseClient().auth.signOut()
        setUser(null)
        setError(
          'Esta cuenta pertenece a un empleado sin privilegios administrativos. Utiliza la aplicacion movil para consultar tu historial personal.',
        )
        return
      }
      setUser(profile)
      setError(null)
    } catch (err) {
      let message = 'No se pudo verificar el perfil del usuario en el servidor.'

      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          message = 'Tu sesion expiro o no es valida. Inicia sesion de nuevo.'
        } else if (err.statusCode === 403) {
          message = 'Esta cuenta no tiene permisos para usar la consola administrativa.'
        } else if (err.statusCode === 404) {
          message = 'La cuenta autenticada no esta registrada en la consola administrativa.'
        } else {
          message = err.message
        }
      }

      setUser(null)
      setError(message)
    }
  }, [])

  useEffect(() => {
    let active = true
    const supabase = getSupabaseClient()

    async function bootstrapSession() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        if (data.session?.access_token) {
          await loadAccountFromBackend()
        } else {
          setUser(null)
        }
      } catch {
        if (active) {
          setUser(null)
          setError(
            'No se pudo verificar la sesion con Supabase Auth. Verifica tu conexion y vuelve a cargar la consola.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void bootstrapSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadAccountFromBackend])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null)
      setLoading(true)
      try {
        const supabase = getSupabaseClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) {
          const normalizedMessage = signInError.message.toLowerCase()
          let message = signInError.message

          if (normalizedMessage.includes('invalid login credentials')) {
            message = 'Credenciales invalidas. Verifica tu correo y contrasena.'
          } else if (
            normalizedMessage.includes('failed to fetch') ||
            normalizedMessage.includes('network')
          ) {
            message =
              'No se pudo conectar con Supabase Auth. Verifica tu conexion a Internet y vuelve a intentarlo.'
          } else if (normalizedMessage.includes('email not confirmed')) {
            message =
              'La cuenta aun no confirma su correo electronico. Revisa tu bandeja de entrada.'
          } else if (normalizedMessage.includes('rate limit')) {
            message =
              'Demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo.'
          }

          throw new Error(message)
        }
        await loadAccountFromBackend()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al iniciar sesion.'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [loadAccountFromBackend],
  )

  const signOut = useCallback(async () => {
    await getSupabaseClient().auth.signOut()
    setUser(null)
    setError(null)
  }, [])

  const isAdmin = Boolean(user?.roles.includes('admin' satisfies RoleCode))
  const canWriteCatalog = Boolean(
    user?.roles.some((role) => role === 'admin' || role === 'operator'),
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAdmin,
      canWriteCatalog,
      signIn,
      signOut,
      refreshProfile: loadAccountFromBackend,
    }),
    [user, loading, error, isAdmin, canWriteCatalog, signIn, signOut, loadAccountFromBackend],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return ctx
}
