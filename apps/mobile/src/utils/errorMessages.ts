import { MobileApiError } from '../api/MobileApiError'

const NETWORK_PATTERNS = [
  'fetch',
  'network',
  'timeout',
  'timed out',
  'econnrefused',
  'unable to resolve',
  'abort',
]

function looksLikeNetworkFailure(message: string): boolean {
  const lower = message.toLowerCase()
  return NETWORK_PATTERNS.some((pattern) => lower.includes(pattern))
}

/** Traduce errores de inicio de sesion (Supabase Auth + `/auth/me`) a espanol claro. */
export function toSignInMessage(error: unknown): string {
  if (error instanceof MobileApiError) {
    if (error.status === 0 && error.code === 'TIMEOUT') {
      return 'El servidor tardó demasiado en responder. Puede estar iniciando; inténtalo de nuevo.'
    }
    if (error.status === 0) {
      return 'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.'
    }
    if (error.status === 401) {
      return 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.'
    }
    if (error.status === 403) {
      return 'Tu cuenta está deshabilitada o no tiene permisos para acceder.'
    }
    if (error.status === 404) {
      return 'Tu cuenta de acceso no está registrada en el sistema. Contacta a un administrador.'
    }
    if (error.status >= 500) {
      return 'El servidor encontró un error temporal. Inténtalo de nuevo en unos momentos.'
    }
    return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid login') ||
    lower.includes('invalid_credentials')
  ) {
    return 'Correo o contraseña incorrectos.'
  }

  if (lower.includes('email not confirmed')) {
    return 'Tu correo aún no ha sido confirmado.'
  }

  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  }

  if (looksLikeNetworkFailure(lower)) {
    return 'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.'
  }

  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

/** Traduce errores de carga y paginacion del historial personal. */
export function toHistoryError(error: unknown): string {
  if (error instanceof MobileApiError) {
    if (error.status === 401) {
      return 'Tu sesión expiró. Cierra sesión e ingresa de nuevo.'
    }
    if (error.status === 403) {
      return 'Esta cuenta no tiene acceso al historial de empleado.'
    }
    if (error.status === 0 && error.code === 'TIMEOUT') {
      return 'El servidor tardó demasiado en responder. Inténtalo de nuevo.'
    }
    if (error.status === 0) {
      return 'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.'
    }
    if (error.status >= 500) {
      return 'El servidor encontró un error al consultar el historial. Inténtalo de nuevo.'
    }
    return 'No se pudo cargar el historial. Inténtalo de nuevo.'
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  if (looksLikeNetworkFailure(message)) {
    return 'Sin conexión o el servidor tarda en responder. Inténtalo de nuevo.'
  }

  return 'No se pudo cargar el historial. Inténtalo de nuevo.'
}

/** Traduce errores al consultar el detalle de un evento propio. */
export function toDetailError(error: unknown): string {
  if (error instanceof MobileApiError) {
    if (error.status === 401) {
      return 'Tu sesión expiró. Cierra sesión e ingresa de nuevo.'
    }
    if (error.status === 403) {
      return 'No tienes permiso para consultar este evento.'
    }
    if (error.status === 404) {
      return 'El evento solicitado ya no está disponible.'
    }
    if (error.status === 0 && error.code === 'TIMEOUT') {
      return 'El servidor tardó demasiado en responder. Inténtalo de nuevo.'
    }
    if (error.status === 0) {
      return 'Sin conexión a Internet. Revisa tu conexión e inténtalo de nuevo.'
    }
    if (error.status >= 500) {
      return 'El servidor encontró un error al cargar el detalle. Inténtalo de nuevo.'
    }
    return 'No se pudo cargar el detalle del evento. Verifica tu conexión e inténtalo de nuevo.'
  }

  if (error instanceof Error && looksLikeNetworkFailure(error.message)) {
    return 'Sin conexión a Internet o el servidor tarda en responder. Inténtalo de nuevo.'
  }

  return 'No se pudo cargar el detalle del evento. Verifica tu conexión e inténtalo de nuevo.'
}
