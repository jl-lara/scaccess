const TIJUANA_TIME_ZONE = 'America/Tijuana'

/**
 * Agrupa un UID RFID en pares hexadecimales en mayusculas separados por espacio.
 * Ignora espacios, guiones y cualquier caracter no hexadecimal; ante una cadena
 * vacia (o sin digitos hex) devuelve cadena vacia.
 */
export function formatCardUid(uid: string): string {
  const hex = uid.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
  if (hex.length === 0) return ''
  return hex.match(/.{1,2}/g)?.join(' ') ?? ''
}

/** Hora local en Tijuana en formato 24h `HH:mm`. */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIJUANA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

/** Fecha corta local en Tijuana (ej. `09/11/2026`). */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: TIJUANA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/** Fecha y hora combinadas en espanol para mostrar en la lista. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${formatDate(iso)} · ${formatTime(iso)}`
}
