import { z } from 'zod'
import { paginationQuerySchema } from '../../utils/pagination.js'

const booleanQuerySchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
])

export const accessPermissionIdParamsSchema = z.object({
  id: z.string().uuid('Access permission id must be a valid UUID'),
})

export const accessPermissionListQuerySchema = paginationQuerySchema.extend({
  employeeId: z.string().uuid('Employee id must be a valid UUID').optional(),
  areaId: z.string().uuid('Area id must be a valid UUID').optional(),
  activeOnly: booleanQuerySchema.optional(),
})

const MAX_FUTURE_VALID_TO_MS = 5 * 366 * 24 * 60 * 60 * 1000

export const createAccessPermissionBodySchema = z
  .object({
    employeeId: z.string().uuid('Employee id must be a valid UUID'),
    areaId: z.string().uuid('Area id must be a valid UUID'),
    validFrom: z.coerce.date().nullish(),
    validTo: z.coerce.date().nullish(),
    schedule: z.record(z.string(), z.unknown()).nullish(),
  })
  .superRefine((value, ctx) => {
    if (!value.validTo) {
      return
    }
    if (value.validFrom && value.validTo.getTime() <= value.validFrom.getTime()) {
      return
    }
    const anchorMs = Math.max(Date.now(), value.validFrom ? value.validFrom.getTime() : 0)
    if (value.validTo.getTime() - anchorMs > MAX_FUTURE_VALID_TO_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validTo'],
        message: 'validTo cannot exceed 5 years into the future',
      })
    }
  })

export type AccessPermissionListQuery = z.infer<typeof accessPermissionListQuerySchema>
export type CreateAccessPermissionBody = z.infer<typeof createAccessPermissionBodySchema>
