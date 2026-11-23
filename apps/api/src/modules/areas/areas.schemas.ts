import { z } from 'zod'
import { paginationQuerySchema } from '../../utils/pagination.js'

const booleanQuerySchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
])

const AREA_CODE_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9_-]{2,32}$/
const HAS_LETTER_REGEX = /\p{L}/u

const areaNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((value) => HAS_LETTER_REGEX.test(value), {
    message: 'Area name must contain at least one letter',
  })

export const areaIdParamsSchema = z.object({
  id: z.string().uuid('Area id must be a valid UUID'),
})

export const areaListQuerySchema = paginationQuerySchema.extend({
  isActive: booleanQuerySchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
})

export const createAreaBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(
      AREA_CODE_REGEX,
      'Area code must include letters and only use letters, numbers, underscores or hyphens',
    ),
  name: areaNameSchema,
  description: z.string().trim().max(1000).nullish(),
  isActive: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
})

export const updateAreaBodySchema = z
  .object({
    name: areaNameSchema.optional(),
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
