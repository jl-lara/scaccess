import { z } from 'zod'

const booleanQuerySchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
])

export const myPermissionsQuerySchema = z.object({
  activeOnly: booleanQuerySchema.optional(),
})

export type MyPermissionsQuery = z.infer<typeof myPermissionsQuerySchema>

export const myCredentialIdParamsSchema = z.object({
  id: z.string().uuid('Credential id must be a valid UUID'),
})

export const reportLostCredentialBodySchema = z
  .object({
    reason: z.string().trim().max(500, 'Reason must be at most 500 characters').optional(),
  })
  .optional()
  .default({})

export type MyCredentialIdParams = z.infer<typeof myCredentialIdParamsSchema>

export type ReportLostCredentialBody = z.infer<typeof reportLostCredentialBodySchema>
