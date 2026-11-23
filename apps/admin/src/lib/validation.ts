/**
 * Small, dependency-free helpers shared by the administrative forms.
 * The API remains the authority: these checks only provide fast, localized
 * feedback before a request is sent.
 */

const CARD_UID_PATTERN = /^[0-9A-F]{8,32}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PERSON_NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u
const HAS_LETTER_PATTERN = /\p{L}/u
const ALPHANUM_CODE_PATTERN = /^(?=.*[A-Za-z])[A-Za-z0-9_-]{2,32}$/

export function normalizeCardUid(rawUid: string): string {
  return rawUid.replace(/[\s:-]/g, '').toUpperCase()
}

export function isValidCardUid(normalizedUid: string): boolean {
  return CARD_UID_PATTERN.test(normalizedUid) && normalizedUid.length % 2 === 0
}

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function isValidPersonName(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && PERSON_NAME_PATTERN.test(trimmed)
}

export function hasLetters(value: string): boolean {
  return HAS_LETTER_PATTERN.test(value.trim())
}

export function isValidAreaCode(value: string): boolean {
  return ALPHANUM_CODE_PATTERN.test(value.trim())
}

export function isValidEmployeeCode(value: string): boolean {
  return ALPHANUM_CODE_PATTERN.test(value.trim())
}

/**
 * Suggests the next consecutive employee code based on existing records.
 * Uses the most frequent prefix (defaulting to "EMP-") and preserves zero padding.
 */
export function suggestNextEmployeeCode(
  employees: readonly { employeeCode: string }[],
): string {
  const prefixCounts = new Map<string, number>()
  const maxByPrefix = new Map<string, { max: number; padWidth: number }>()

  for (const emp of employees) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*?-)(\d+)$/.exec(emp.employeeCode.trim())
    if (!match) continue
    const prefix = match[1] ?? 'EMP-'
    const digits = match[2] ?? '0'
    const num = Number.parseInt(digits, 10)
    if (!Number.isFinite(num)) continue

    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1)
    const prev = maxByPrefix.get(prefix)
    if (!prev || num > prev.max) {
      maxByPrefix.set(prefix, { max: num, padWidth: Math.max(3, digits.length) })
    } else if (digits.length > prev.padWidth) {
      prev.padWidth = digits.length
    }
  }

  let bestPrefix = 'EMP-'
  let bestCount = 0
  for (const [prefix, count] of prefixCounts.entries()) {
    if (count > bestCount) {
      bestCount = count
      bestPrefix = prefix
    }
  }

  const stats = maxByPrefix.get(bestPrefix)
  const nextNumber = (stats?.max ?? 0) + 1
  const padWidth = stats?.padWidth ?? 3
  return `${bestPrefix}${String(nextNumber).padStart(padWidth, '0')}`
}

export function toLocalDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toLocalDateTimeInputValue(date = new Date()): string {
  const datePart = toLocalDateInputValue(date)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${datePart}T${hours}:${minutes}`
}

export function getMaxPermissionDateValue(fromDate = new Date()): string {
  const limit = new Date(fromDate)
  limit.setFullYear(limit.getFullYear() + 5)
  return toLocalDateInputValue(limit)
}

/**
 * Converts the value of an `<input type="datetime-local">` to an ISO string.
 * Returns null for empty or unparseable values.
 */
export function toIsoDateTime(value: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * Converts the value of an `<input type="date">` to an ISO string anchored at
 * the start of that local day.
 */
export function toIsoDate(value: string): string | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}

export function formatMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) {
    return 'Sin metadatos'
  }
  try {
    const serialized = JSON.stringify(metadata, null, 2)
    return serialized ?? String(metadata)
  } catch {
    return String(metadata)
  }
}
