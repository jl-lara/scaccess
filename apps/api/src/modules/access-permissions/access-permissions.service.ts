import type { AccessPermissionDto } from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import { Prisma, type AccessPermission } from '../../generated/prisma/client.js'
import { ApiError } from '../../utils/ApiError.js'
import { bumpDevicesConfigVersion } from '../../utils/configVersion.js'
import {
  buildPaginatedResponse,
  toPrismaSkipTake,
  type PaginationQuery,
} from '../../utils/pagination.js'
import type {
  AccessPermissionListQuery,
  CreateAccessPermissionBody,
} from './access-permissions.schemas.js'

export type ConfigVersionBumper = (areaIds?: string[]) => Promise<void>

export interface AccessPermissionRecord {
  id: string
  employeeId: string
  areaId: string
  validFrom: Date | null
  validTo: Date | null
  schedule: unknown | null
  revokedAt: Date | null
  grantedById: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AccessPermissionListFilters {
  employeeId?: string
  areaId?: string
  activeOnly?: boolean
}

export interface CreateAccessPermissionInput {
  employeeId: string
  areaId: string
  validFrom?: Date | null
  validTo?: Date | null
  schedule?: unknown
  grantedById?: string | null
}

export interface AccessPermissionStore {
  list(
    filters: AccessPermissionListFilters,
    pagination: PaginationQuery,
  ): Promise<{ items: AccessPermissionRecord[]; total: number }>
  findById(id: string): Promise<AccessPermissionRecord | null>
  findActive(employeeId: string, areaId: string): Promise<AccessPermissionRecord | null>
  create(input: CreateAccessPermissionInput): Promise<AccessPermissionRecord>
  revoke(id: string, revokedAt: Date): Promise<AccessPermissionRecord | null>
}

export function toAccessPermissionDto(
  permission: AccessPermissionRecord,
): AccessPermissionDto {
  return {
    id: permission.id,
    employeeId: permission.employeeId,
    areaId: permission.areaId,
    validFrom: permission.validFrom ? permission.validFrom.toISOString() : null,
    validTo: permission.validTo ? permission.validTo.toISOString() : null,
    schedule: permission.schedule,
    revokedAt: permission.revokedAt ? permission.revokedAt.toISOString() : null,
    grantedById: permission.grantedById,
    createdAt: permission.createdAt.toISOString(),
    updatedAt: permission.updatedAt.toISOString(),
  }
}

function toAccessPermissionRecord(permission: AccessPermission): AccessPermissionRecord {
  return {
    id: permission.id,
    employeeId: permission.employeeId,
    areaId: permission.areaId,
    validFrom: permission.validFrom,
    validTo: permission.validTo,
    schedule: permission.schedule,
    revokedAt: permission.revokedAt,
    grantedById: permission.grantedById,
    createdAt: permission.createdAt,
    updatedAt: permission.updatedAt,
  }
}

function buildWhere(filters: AccessPermissionListFilters): Prisma.AccessPermissionWhereInput {
  const where: Prisma.AccessPermissionWhereInput = {}

  if (filters.employeeId !== undefined) {
    where.employeeId = filters.employeeId
  }

  if (filters.areaId !== undefined) {
    where.areaId = filters.areaId
  }

  if (filters.activeOnly) {
    where.revokedAt = null
  }

  return where
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === code) ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === code)
  )
}

export function createPrismaAccessPermissionStore(): AccessPermissionStore {
  return {
    async list(filters, pagination) {
      const prisma = getPrismaClient()
      const where = buildWhere(filters)

      const [items, total] = await Promise.all([
        prisma.accessPermission.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...toPrismaSkipTake(pagination),
        }),
        prisma.accessPermission.count({ where }),
      ])

      return { items: items.map(toAccessPermissionRecord), total }
    },

    async findById(id) {
      const permission = await getPrismaClient().accessPermission.findUnique({
        where: { id },
      })
      return permission ? toAccessPermissionRecord(permission) : null
    },

    async findActive(employeeId, areaId) {
      const permission = await getPrismaClient().accessPermission.findFirst({
        where: { employeeId, areaId, revokedAt: null },
      })
      return permission ? toAccessPermissionRecord(permission) : null
    },

    async create(input) {
      const data: Prisma.AccessPermissionUncheckedCreateInput = {
        employeeId: input.employeeId,
        areaId: input.areaId,
        ...(input.validFrom === undefined ? {} : { validFrom: input.validFrom }),
        ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
        ...(input.schedule === undefined || input.schedule === null
          ? {}
          : { schedule: input.schedule as Prisma.InputJsonValue }),
        ...(input.grantedById === undefined ? {} : { grantedById: input.grantedById }),
      }

      try {
        const permission = await getPrismaClient().accessPermission.create({ data })
        return toAccessPermissionRecord(permission)
      } catch (error) {
        if (isPrismaError(error, 'P2002')) {
          throw ApiError.conflict(
            'Active permission already exists for this employee and area',
          )
        }

        if (isPrismaError(error, 'P2003')) {
          throw ApiError.badRequest('Employee or area not found')
        }

        throw error
      }
    },

    async revoke(id, revokedAt) {
      try {
        const permission = await getPrismaClient().accessPermission.update({
          where: { id },
          data: { revokedAt },
        })
        return toAccessPermissionRecord(permission)
      } catch (error) {
        if (isPrismaError(error, 'P2025')) {
          return null
        }

        throw error
      }
    },
  }
}

export class AccessPermissionsService {
  constructor(
    private readonly store: AccessPermissionStore,
    private readonly bumpConfigVersion: ConfigVersionBumper = bumpDevicesConfigVersion,
  ) {}

  async list(query: AccessPermissionListQuery) {
    const { items, total } = await this.store.list(
      {
        employeeId: query.employeeId,
        areaId: query.areaId,
        activeOnly: query.activeOnly,
      },
      query,
    )

    return buildPaginatedResponse(items.map(toAccessPermissionDto), total, query)
  }

  async create(
    input: CreateAccessPermissionBody,
    grantedById: string,
  ): Promise<AccessPermissionDto> {
    if (
      input.validFrom &&
      input.validTo &&
      input.validTo.getTime() <= input.validFrom.getTime()
    ) {
      throw ApiError.badRequest('validTo must be after validFrom')
    }

    const existing = await this.store.findActive(input.employeeId, input.areaId)

    if (existing) {
      throw ApiError.conflict('Active permission already exists for this employee and area')
    }

    const permission = await this.store.create({
      ...input,
      grantedById,
    })

    await this.bumpConfigVersion([input.areaId])

    return toAccessPermissionDto(permission)
  }

  async revoke(id: string): Promise<AccessPermissionDto> {
    const existing = await this.store.findById(id)

    if (!existing) {
      throw ApiError.notFound('Access permission not found')
    }

    if (existing.revokedAt) {
      throw ApiError.conflict('Access permission is already revoked')
    }

    const permission = await this.store.revoke(id, new Date())

    if (!permission) {
      throw ApiError.notFound('Access permission not found')
    }

    await this.bumpConfigVersion([permission.areaId])

    return toAccessPermissionDto(permission)
  }
}

export function createAccessPermissionsService(
  store: AccessPermissionStore = createPrismaAccessPermissionStore(),
  bumpConfigVersion: ConfigVersionBumper = bumpDevicesConfigVersion,
): AccessPermissionsService {
  return new AccessPermissionsService(store, bumpConfigVersion)
}
