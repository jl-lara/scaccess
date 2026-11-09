import { z } from 'zod'
import { paginationQuerySchema } from '../../utils/pagination.js'

export const employeeStatusSchema = z.enum(['active', 'inactive', 'suspended'])

export const employeeIdParamsSchema = z.object({
  id: z.string().uuid('Employee id must be a valid UUID'),
})

export const employeeListQuerySchema = paginationQuerySchema.extend({
  status: employeeStatusSchema.optional(),
  department: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(100).optional(),
})

export const createEmployeeBodySchema = z.object({
  employeeCode: z.string().trim().min(1).max(32),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320).nullish(),
  department: z.string().trim().max(100).nullish(),
  position: z.string().trim().max(100).nullish(),
  status: employeeStatusSchema.optional(),
  hiredAt: z.coerce.date().nullish(),
})

export const updateEmployeeBodySchema = z
  .object({
    employeeCode: z.string().trim().min(1).max(32).optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email().max(320).nullable().optional(),
    department: z.string().trim().max(100).nullable().optional(),
    position: z.string().trim().max(100).nullable().optional(),
    status: employeeStatusSchema.optional(),
    hiredAt: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field must be provided',
  })

export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>
export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBodySchema>
