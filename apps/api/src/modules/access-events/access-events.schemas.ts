import { z } from 'zod'
import { cardUidSchema } from '../../utils/cardUid.js'
import { paginationQuerySchema } from '../../utils/pagination.js'
import {
  accessDecisionSchema,
  accessReasonSchema,
} from '../device-sync/device-sync.schemas.js'

const isoDateFilterSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Must be a valid ISO date',
  })

export const accessEventListQuerySchema = paginationQuerySchema.extend({
  employeeId: z.uuid().optional(),
  deviceId: z.uuid().optional(),
  areaId: z.uuid().optional(),
  decision: accessDecisionSchema.optional(),
  reasonCode: accessReasonSchema.optional(),
  cardUid: cardUidSchema.optional(),
  from: isoDateFilterSchema.optional(),
  to: isoDateFilterSchema.optional(),
})

/**
 * The mobile history only accepts pagination. Employee identity always comes
 * from the authenticated account, never from a client-supplied filter.
 */
export const myAccessEventsQuerySchema = paginationQuerySchema

export const accessEventIdParamsSchema = z.object({
  id: z.uuid(),
})

export type AccessEventListQuery = z.infer<typeof accessEventListQuerySchema>
export type AccessEventIdParams = z.infer<typeof accessEventIdParamsSchema>
