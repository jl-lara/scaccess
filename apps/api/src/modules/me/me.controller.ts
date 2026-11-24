import type { MyPermissionsResponseDto, MyProfileResponseDto } from '@scaccess/shared'
import type { Request, Response } from 'express'
import { getAuthenticatedUser } from '../../middleware/auth.js'
import { getValidated } from '../../middleware/validate.js'
import { ApiError } from '../../utils/ApiError.js'
import type { MyPermissionsQuery } from './me.schemas.js'
import { getMyProfile, listMyPermissions } from './me.service.js'

export async function getMyProfileHandler(
  req: Request,
  res: Response<MyProfileResponseDto>,
): Promise<void> {
  const user = getAuthenticatedUser(req, res)

  if (user.employeeId === null) {
    // Defensive guard: requireEmployeeAccount already enforces this.
    throw ApiError.forbidden('Employee account required')
  }

  const profile = await getMyProfile(user.id, user.employeeId)

  res.status(200).json(profile)
}

export async function listMyPermissionsHandler(
  req: Request,
  res: Response<MyPermissionsResponseDto>,
): Promise<void> {
  const user = getAuthenticatedUser(req, res)
  const { query } = getValidated<unknown, MyPermissionsQuery>(res)

  if (user.employeeId === null) {
    // Defensive guard: requireEmployeeAccount already enforces this.
    throw ApiError.forbidden('Employee account required')
  }

  const result = await listMyPermissions(user.employeeId, query)

  res.status(200).json(result)
}
