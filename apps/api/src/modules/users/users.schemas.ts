import { z } from 'zod'
import { paginationQuerySchema } from '../../utils/pagination.js'

const accountStatusSchema = z.enum(['active', 'disabled'])

const roleCodeSchema = z.string().trim().min(1).max(32)

export const listUsersQuerySchema = paginationQuerySchema.extend({
  status: accountStatusSchema.optional(),
  search: z.string().trim().min(1).max(320).optional(),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export const userIdParamsSchema = z.object({
  id: z.uuid(),
})

export type UserIdParams = z.infer<typeof userIdParamsSchema>

export const createUserSchema = z.object({
  authUserId: z.uuid(),
  email: z.email().max(320),
  employeeId: z.uuid().nullable().optional(),
  status: accountStatusSchema.optional(),
  roleCodes: z.array(roleCodeSchema).max(20).optional(),
})

export type CreateUserBody = z.infer<typeof createUserSchema>

export const updateUserSchema = z
  .object({
    status: accountStatusSchema.optional(),
    employeeId: z.uuid().nullable().optional(),
    roleCodes: z.array(roleCodeSchema).max(20).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field must be provided',
  })

export type UpdateUserBody = z.infer<typeof updateUserSchema>
