const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Valida correo y contraseña antes de invocar a Supabase Auth.
 * Devuelve `null` si el formulario es valido, o el mensaje en espanol a mostrar.
 */
export function validateLoginForm(email: string, password: string): string | null {
  const trimmedEmail = email.trim()

  if (!trimmedEmail && !password) {
    return 'Ingresa tu correo electrónico y contraseña.'
  }

  if (!trimmedEmail) {
    return 'Ingresa tu correo electrónico.'
  }

  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return 'Ingresa un correo electrónico válido.'
  }

  if (!password) {
    return 'Ingresa tu contraseña.'
  }

  return null
}
