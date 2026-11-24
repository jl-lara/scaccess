import type {
  MyAccessPermissionDto,
  MyPermissionsResponseDto,
  MyProfileResponseDto,
} from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import { ApiError } from '../../utils/ApiError.js'
import { toUserAccountDto } from '../users/users.service.js'
import type { MyPermissionsQuery } from './me.schemas.js'

/**
 * Loads the authenticated employee's account, employee record, and assigned
 * RFID credentials in parallel.
 */
export async function getMyProfile(
  userId: string,
  employeeId: string,
): Promise<MyProfileResponseDto> {
  const prisma = getPrismaClient()

  const [account, employee, credentials] = await Promise.all([
    prisma.userAccount.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    }),
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.credential.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!account) {
    throw ApiError.notFound('User account not found')
  }

  if (!employee) {
    throw ApiError.notFound('Employee not found')
  }

  return {
    account: toUserAccountDto(account),
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: employee.department,
      position: employee.position,
      status: employee.status,
      hiredAt: employee.hiredAt ? employee.hiredAt.toISOString().slice(0, 10) : null,
    },
    credentials: credentials.map((c) => ({
      id: c.id,
      cardUid: c.cardUid,
      label: c.label,
      status: c.status,
      issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
      deactivatedAt: c.deactivatedAt ? c.deactivatedAt.toISOString() : null,
    })),
  }
}

/**
 * Lists the authenticated employee's area access permissions sorted by area
 * name (Spanish locale).
 */
export async function listMyPermissions(
  employeeId: string,
  query: MyPermissionsQuery,
): Promise<MyPermissionsResponseDto> {
  const prisma = getPrismaClient()
  const activeOnly = query.activeOnly ?? true
  const where = activeOnly ? { employeeId, revokedAt: null } : { employeeId }

  const permissions = await prisma.accessPermission.findMany({
    where,
    include: { area: true },
    orderBy: { createdAt: 'desc' },
  })

  const data: MyAccessPermissionDto[] = permissions
    .map((permission) => ({
      id: permission.id,
      areaId: permission.areaId,
      validFrom: permission.validFrom ? permission.validFrom.toISOString() : null,
      validTo: permission.validTo ? permission.validTo.toISOString() : null,
      schedule: permission.schedule,
      revokedAt: permission.revokedAt ? permission.revokedAt.toISOString() : null,
      area: {
        id: permission.area.id,
        code: permission.area.code,
        name: permission.area.name,
        description: permission.area.description,
        isActive: permission.area.isActive,
        timezone: permission.area.timezone,
      },
    }))
    .sort((a, b) => a.area.name.localeCompare(b.area.name, 'es'))

  return { data }
}
