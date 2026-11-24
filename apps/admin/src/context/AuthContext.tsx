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
import { api, ApiClientError, setUnauthorizedHandler } from '../lib/api'
import { ADMIN_ALLOWED_ROLES } from '../lib/permissions'
import { getSupabaseClient } from '../lib/supabase'

export interface AuthContextValue {
  user: UserAccountDto | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  canWriteCatalog: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  requestPasswordReset?: (email: string) => Promise<void>
  updatePassword?: (newPassword: string) => Promise<void>
  clearError?: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function hasAllowedAdminRole(roles: string[]): boolean {
  return roles.some((role) => ADMIN_ALLOWED_ROLES.includes(role))
}

function localizeSupabaseAuthError(rawMessage: string, fallback: string): string {
  const normalizedMessage = rawMessage.toLowerCase()

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'Credenciales inválidas. Verifica tu correo y contraseña.'
  }
  if (normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('network')) {
    return 'No se pudo conectar con Supabase Auth. Verifica tu conexión a Internet y vuelve a intentarlo.'
  }
  if (normalizedMessage.includes('email not confirmed')) {
    return 'La cuenta aún no confirma su correo electrónico. Revisa tu bandeja de entrada.'
  }
  if (normalizedMessage.includes('rate limit') || normalizedMessage.includes('too many requests')) {
    return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
  }
  if (normalizedMessage.includes('same_password') || normalizedMessage.includes('different from the old')) {
    return 'La nueva contraseña debe ser diferente a la contraseña actual.'
  }
  if (normalizedMessage.includes('weak_password') || normalizedMessage.includes('at least')) {
    return 'La contraseña no cumple con la longitud o complejidad mínima requerida (mínimo 8 caracteres).'
  }
  if (normalizedMessage.includes('session_not_found') || normalizedMessage.includes('auth session missing')) {
    return 'El enlace de recuperación expiró o ya fue utilizado. Solicita uno nuevo.'
  }

  return rawMessage || fallback
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
          'Esta cuenta pertenece a un empleado sin privilegios administrativos. Utiliza la aplicación móvil para consultar tu historial personal.',
        )
        return
      }
      setUser(profile)
      setError(null)
    } catch (err) {
      let message = 'No se pudo verificar el perfil del usuario en el servidor.'

      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          message = 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.'
        } else if (err.statusCode === 403) {
          message = 'Esta cuenta no tiene permisos para usar la consola administrativa.'
        } else if (err.statusCode === 404) {
          message = 'La cuenta autenticada no está registrada en la consola administrativa.'
        } else {
          message = err.message
        }
      }

      setUser(null)
      setError(message)
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(async (reason) => {
      try {
        await getSupabaseClient().auth.signOut()
      } catch {
        // Ignore storage/network errors when clearing expired session state.
      }
      setUser(null)
      setError(reason || 'Tu sesión expiró. Inicia sesión de nuevo.')
    })

    return () => {
      setUnauthorizedHandler(null)
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
            'No se pudo verificar la sesión con Supabase Auth. Verifica tu conexión y vuelve a cargar la consola.',
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
      if (event === 'SIGNED_OUT' || (!session && event !== 'PASSWORD_RECOVERY')) {
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
          throw new Error(
            localizeSupabaseAuthError(signInError.message, 'Error al iniciar sesión.'),
          )
        }
        await loadAccountFromBackend()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al iniciar sesión.'
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

  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null)
    const supabase = getSupabaseClient()
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      ...(redirectTo ? { redirectTo } : {}),
    })
    if (resetError) {
      const msg = localizeSupabaseAuthError(
        resetError.message,
        'No se pudo enviar el enlace de recuperación.',
      )
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    setError(null)
    const supabase = getSupabaseClient()
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      const msg = localizeSupabaseAuthError(
        updateError.message,
        'No se pudo actualizar la contraseña.',
      )
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  const clearError = useCallback(() => {
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
      requestPasswordReset,
      updatePassword,
      clearError,
    }),
    [
      user,
      loading,
      error,
      isAdmin,
      canWriteCatalog,
      signIn,
      signOut,
      loadAccountFromBackend,
      requestPasswordReset,
      updatePassword,
      clearError,
    ],
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
