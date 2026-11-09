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

export const createAccessPermissionBodySchema = z.object({
  employeeId: z.string().uuid('Employee id must be a valid UUID'),
  areaId: z.string().uuid('Area id must be a valid UUID'),
  validFrom: z.coerce.date().nullish(),
  validTo: z.coerce.date().nullish(),
  schedule: z.record(z.string(), z.unknown()).nullish(),
})

export type AccessPermissionListQuery = z.infer<typeof accessPermissionListQuerySchema>
export type CreateAccessPermissionBody = z.infer<typeof createAccessPermissionBodySchema>
