import { z } from 'zod'
import { paginationQuerySchema } from '../../utils/pagination.js'

const booleanQuerySchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
])

export const areaIdParamsSchema = z.object({
  id: z.string().uuid('Area id must be a valid UUID'),
})

export const areaListQuerySchema = paginationQuerySchema.extend({
  isActive: booleanQuerySchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
})

export const createAreaBodySchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(1000).nullish(),
  isActive: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
})

export const updateAreaBodySchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field must be provided',
  })

export type AreaListQuery = z.infer<typeof areaListQuerySchema>
export type CreateAreaBody = z.infer<typeof createAreaBodySchema>
export type UpdateAreaBody = z.infer<typeof updateAreaBodySchema>
