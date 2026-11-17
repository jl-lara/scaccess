/**
 * Small, dependency-free helpers shared by the administrative forms.
 * The API remains the authority: these checks only provide fast, localized
 * feedback before a request is sent.
 */

const CARD_UID_PATTERN = /^[0-9A-F]{8,32}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeCardUid(rawUid: string): string {
  return rawUid.replace(/[\s:-]/g, '').toUpperCase()
}

export function isValidCardUid(normalizedUid: string): boolean {
  return CARD_UID_PATTERN.test(normalizedUid) && normalizedUid.length % 2 === 0
}

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
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
