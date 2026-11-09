import { z } from 'zod'

/**
 * Removes common separators (spaces, colons and dashes) and upper-cases the
 * value so a card UID is always stored in its canonical form.
 */
export function normalizeCardUid(rawUid: string): string {
  return rawUid.replace(/[\s:-]/g, '').toUpperCase()
}

/**
 * A valid UID is 8-32 uppercase hexadecimal characters with an even length
 * (complete bytes).
 */
export function isValidCardUid(normalizedUid: string): boolean {
  return /^[0-9A-F]{8,32}$/.test(normalizedUid) && normalizedUid.length % 2 === 0
}

export const cardUidSchema = z
  .string()
  .transform(normalizeCardUid)
  .refine(isValidCardUid, {
    message: 'Card UID must be 8-32 uppercase hex characters with even length',
  })
