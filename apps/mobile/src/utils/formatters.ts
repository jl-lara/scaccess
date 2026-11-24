export const TIJUANA_TIME_ZONE = 'America/Tijuana'

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ONE_DAY_MS = 86_400_000

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

/**
 * Convierte una fecha ISO a clave de dia `YYYY-MM-DD` en zona horaria de Tijuana.
 * Devuelve cadena vacia ante fechas invalidas.
 */
export function formatDateKey(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIJUANA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return ''
  return `${year}-${month}-${day}`
}

/**
 * Formatea una clave `YYYY-MM-DD` como encabezado de dia en espanol
 * (`Hoy`, `Ayer` o fecha completa capitalizada en Tijuana).
 */
export function formatDayHeading(
  dateKey: string,
  now: Date = new Date(),
): string {
  if (!DATE_KEY_PATTERN.test(dateKey)) return 'Fecha desconocida'

  const todayKey = Number.isNaN(now.getTime())
    ? ''
    : formatDateKey(now.toISOString())
  if (todayKey && dateKey === todayKey) return 'Hoy'

  if (todayKey) {
    const yesterdayKey = formatDateKey(
      new Date(new Date(`${todayKey}T12:00:00Z`).getTime() - ONE_DAY_MS).toISOString(),
    )
    if (dateKey === yesterdayKey) return 'Ayer'
  }

  const anchor = new Date(`${dateKey}T12:00:00Z`)
  if (Number.isNaN(anchor.getTime())) return 'Fecha desconocida'

  const formatted = new Intl.DateTimeFormat('es-MX', {
    timeZone: TIJUANA_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(anchor)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}
