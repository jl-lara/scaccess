import { z } from 'zod'
import { cardUidSchema } from '../../utils/cardUid.js'
import { paginationQuerySchema } from '../../utils/pagination.js'

export const credentialStatusSchema = z.enum(['active', 'blocked', 'lost', 'retired'])

export const credentialIdParamsSchema = z.object({
  id: z.string().uuid('Credential id must be a valid UUID'),
})

export const credentialListQuerySchema = paginationQuerySchema.extend({
  employeeId: z.string().uuid('Employee id must be a valid UUID').optional(),
  status: credentialStatusSchema.optional(),
  cardUid: cardUidSchema.optional(),
})

export const createCredentialBodySchema = z.object({
  employeeId: z.string().uuid('Employee id must be a valid UUID'),
  cardUid: cardUidSchema,
  label: z.string().trim().max(64).nullish(),
  status: credentialStatusSchema.default('active'),
})

export const updateCredentialBodySchema = z
  .object({
    label: z.string().trim().max(64).nullable().optional(),
    status: credentialStatusSchema.optional(),
    deactivationReason: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field must be provided',
  })

export type CredentialListQuery = z.infer<typeof credentialListQuerySchema>
export type CreateCredentialBody = z.infer<typeof createCredentialBodySchema>
export type UpdateCredentialBody = z.infer<typeof updateCredentialBodySchema>
