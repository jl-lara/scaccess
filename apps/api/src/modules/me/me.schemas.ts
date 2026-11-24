import { z } from 'zod'

const booleanQuerySchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
])

export const myPermissionsQuerySchema = z.object({
  activeOnly: booleanQuerySchema.optional(),
})

export type MyPermissionsQuery = z.infer<typeof myPermissionsQuerySchema>
