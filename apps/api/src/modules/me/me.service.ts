import type {
  MyAccessPermissionDto,
  MyPermissionsResponseDto,
  MyProfileResponseDto,
  ReportLostCredentialResponseDto,
} from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import { ApiError } from '../../utils/ApiError.js'
import { bumpDevicesConfigVersion } from '../../utils/configVersion.js'
import { toUserAccountDto } from '../users/users.service.js'
import type { MyPermissionsQuery, ReportLostCredentialBody } from './me.schemas.js'

export const DEFAULT_LOST_REPORT_REASON = 'Reportada como extraviada por el empleado'

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
      deactivationReason: c.deactivationReason,
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

/**
 * Marks one of the authenticated employee's active RFID credentials as lost
 * and bumps the device sync configuration version.
 */
export async function reportMyCredentialLost(
  employeeId: string,
  credentialId: string,
  input: ReportLostCredentialBody,
): Promise<ReportLostCredentialResponseDto> {
  const prisma = getPrismaClient()
  const credential = await prisma.credential.findUnique({ where: { id: credentialId } })

  if (!credential || credential.employeeId !== employeeId) {
    throw ApiError.notFound('Credential not found')
  }

  if (credential.status !== 'active') {
    throw ApiError.conflict('Only active credentials can be reported as lost')
  }

  const trimmedReason = input.reason?.trim()
  const deactivationReason =
    trimmedReason && trimmedReason.length > 0 ? trimmedReason : DEFAULT_LOST_REPORT_REASON

  const updated = await prisma.credential.update({
    where: { id: credential.id },
    data: {
      status: 'lost',
      deactivatedAt: new Date(),
      deactivationReason,
    },
  })

  await bumpDevicesConfigVersion()

  return {
    credential: {
      id: updated.id,
      cardUid: updated.cardUid,
      label: updated.label,
      status: updated.status,
      issuedAt: updated.issuedAt ? updated.issuedAt.toISOString() : null,
      deactivatedAt: updated.deactivatedAt ? updated.deactivatedAt.toISOString() : null,
      deactivationReason: updated.deactivationReason,
    },
  }
}
