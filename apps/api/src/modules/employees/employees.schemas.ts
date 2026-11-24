import { z } from 'zod'
import { paginationQuerySchema } from '../../utils/pagination.js'

const PERSON_NAME_REGEX = /^[\p{L}][\p{L}\s'.-]*$/u
const HAS_LETTER_REGEX = /\p{L}/u
const EMPLOYEE_CODE_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9_-]{2,32}$/

const employeeCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(
    EMPLOYEE_CODE_REGEX,
    'Employee code must include letters and only use letters, numbers, underscores or hyphens',
  )

const personNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    PERSON_NAME_REGEX,
    'Name can only contain letters, spaces, apostrophes, dots and hyphens',
  )

const textWithLetterSchema = z
  .string()
  .trim()
  .max(100)
  .refine((value) => value.length === 0 || HAS_LETTER_REGEX.test(value), {
    message: 'Field must contain at least one letter',
  })

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
  employeeCode: employeeCodeSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: z.string().trim().email().max(320).nullish(),
  department: textWithLetterSchema.nullish(),
  position: textWithLetterSchema.nullish(),
  status: employeeStatusSchema.optional(),
  hiredAt: z.coerce.date().nullish(),
})

export const updateEmployeeBodySchema = z
  .object({
    employeeCode: employeeCodeSchema.optional(),
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    email: z.string().trim().email().max(320).nullable().optional(),
    department: textWithLetterSchema.nullable().optional(),
    position: textWithLetterSchema.nullable().optional(),
    status: employeeStatusSchema.optional(),
    hiredAt: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field must be provided',
  })

export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>
export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBodySchema>
