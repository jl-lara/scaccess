import { z } from 'zod'
import { paginationQuerySchema } from '../../utils/pagination.js'

/**
 * Zod schemas for the administrative access-device endpoints.
 *
 * Optional text fields accept `null` so PATCH can explicitly clear metadata
 * without deleting the device.
 */
const optionalNullableText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).nullable().optional()

export const deviceStatusSchema = z.enum(['active', 'inactive', 'maintenance'])

export const accessDeviceIdParamsSchema = z.object({
  id: z.uuid(),
})

export const accessDeviceCredentialParamsSchema = z.object({
  id: z.uuid(),
  credentialId: z.uuid(),
})

export const listAccessDevicesQuerySchema = paginationQuerySchema

export const createAccessDeviceBodySchema = z.object({
  deviceCode: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(100),
  location: optionalNullableText(128),
  hardwareModel: optionalNullableText(32),
  firmwareVersion: optionalNullableText(32),
  status: deviceStatusSchema.optional(),
  areaIds: z.array(z.uuid()).optional(),
})

export const updateAccessDeviceBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    location: optionalNullableText(128),
    hardwareModel: optionalNullableText(32),
    firmwareVersion: optionalNullableText(32),
    status: deviceStatusSchema.optional(),
    areaIds: z.array(z.uuid()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type AccessDeviceIdParams = z.infer<typeof accessDeviceIdParamsSchema>
export type AccessDeviceCredentialParams = z.infer<typeof accessDeviceCredentialParamsSchema>
export type CreateAccessDeviceBody = z.infer<typeof createAccessDeviceBodySchema>
export type UpdateAccessDeviceBody = z.infer<typeof updateAccessDeviceBodySchema>
