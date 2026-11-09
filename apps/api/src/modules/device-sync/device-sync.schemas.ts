import type { AccessDecision, AccessReason } from '@scaccess/shared'
import { z } from 'zod'
import { cardUidSchema } from '../../utils/cardUid.js'

export const accessDecisionSchema = z.enum(['granted', 'denied'])

export const accessReasonSchema = z.enum([
  'allowed',
  'card_unknown',
  'card_blocked',
  'card_lost',
  'card_retired',
  'employee_inactive',
  'permission_missing',
  'permission_expired',
  'permission_outside_schedule',
  'area_not_allowed',
  'area_inactive',
  'device_error',
])

/**
 * Business coherence between the decision and its reason. It is checked per
 * item (not with a Zod refinement over the whole batch) so one incoherent
 * event is rejected without discarding the rest of the offline batch.
 */
export function isDecisionReasonCoherent(
  decision: AccessDecision,
  reasonCode: AccessReason,
): boolean {
  return decision === 'granted' ? reasonCode === 'allowed' : reasonCode !== 'allowed'
}

export const deviceEventItemSchema = z.object({
  clientEventId: z.string().trim().min(1).max(64),
  cardUid: cardUidSchema,
  deviceId: z.string().trim().min(1).max(64),
  areaId: z.uuid(),
  occurredAt: z.iso.datetime({ offset: true }),
  decision: accessDecisionSchema,
  reasonCode: accessReasonSchema,
  deviceEpoch: z.uuid().optional(),
  deviceSequence: z
    .string()
    .regex(/^\d{1,19}$/, 'deviceSequence must be a numeric string')
    .optional(),
  metadata: z.unknown().optional(),
})

export const deviceEventSyncBodySchema = z.object({
  deviceId: z.string().trim().min(1).max(64),
  events: z.array(deviceEventItemSchema).min(1).max(500),
})

export type DeviceEventSyncBody = z.infer<typeof deviceEventSyncBodySchema>
