import type { AccountStatus, PaginatedResponse, UserAccountDto } from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { ApiError } from '../../utils/ApiError.js'
import {
  buildPaginatedResponse,
  toPrismaSkipTake,
  type PaginationQuery,
} from '../../utils/pagination.js'

const userAccountInclude = {
  userRoles: {
    include: { role: true },
  },
} satisfies Prisma.UserAccountInclude

type UserAccountWithRoles = Prisma.UserAccountGetPayload<{
  include: typeof userAccountInclude
}>

export interface ListUsersFilters extends PaginationQuery {
  status?: AccountStatus
  search?: string
}

export interface CreateUserInput {
  authUserId: string
  email: string
  employeeId?: string | null
  status?: AccountStatus
  roleCodes?: string[]
}

export interface UpdateUserInput {
  status?: AccountStatus
  employeeId?: string | null
  roleCodes?: string[]
}

export function toUserAccountDto(account: UserAccountWithRoles): UserAccountDto {
  return {
    id: account.id,
    authUserId: account.authUserId,
    employeeId: account.employeeId,
    email: account.email,
    status: account.status,
    roles: account.userRoles.map((userRole) => userRole.role.code).sort(),
    lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}

function buildUserWhere(filters: ListUsersFilters): Prisma.UserAccountWhereInput {
  const where: Prisma.UserAccountWhereInput = {}

  if (filters.status) {
    where.status = filters.status
  }

  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { employee: { is: { employeeCode: { contains: search, mode: 'insensitive' } } } },
      { employee: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
      { employee: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
    ]
  }

  return where
}

export async function listUsers(
  filters: ListUsersFilters,
): Promise<PaginatedResponse<UserAccountDto>> {
  const prisma = getPrismaClient()
  const where = buildUserWhere(filters)

  const [accounts, total] = await Promise.all([
    prisma.userAccount.findMany({
      where,
      ...toPrismaSkipTake(filters),
      orderBy: { createdAt: 'desc' },
      include: userAccountInclude,
    }),
    prisma.userAccount.count({ where }),
  ])

  return buildPaginatedResponse(
    accounts.map((account) => toUserAccountDto(account)),
    total,
    filters,
  )
}

export async function getUserById(userId: string): Promise<UserAccountDto> {
  const account = await getPrismaClient().userAccount.findUnique({
    where: { id: userId },
    include: userAccountInclude,
  })

  if (!account) {
    throw ApiError.notFound('User account not found')
  }

  return toUserAccountDto(account)
}

async function resolveRoleIds(roleCodes: string[]): Promise<string[]> {
  const uniqueCodes = [...new Set(roleCodes)]
  if (uniqueCodes.length === 0) {
    return []
  }

  const roles = await getPrismaClient().role.findMany({
    where: { code: { in: uniqueCodes } },
    select: { id: true, code: true },
  })

  if (roles.length !== uniqueCodes.length) {
    const foundCodes = new Set(roles.map((role) => role.code))
    throw ApiError.badRequest('Unknown role codes', {
      roleCodes: uniqueCodes.filter((code) => !foundCodes.has(code)),
    })
  }

  return roles.map((role) => role.id)
}

async function assertEmployeeExists(employeeId: string): Promise<void> {
  const employee = await getPrismaClient().employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  })

  if (!employee) {
    throw ApiError.badRequest('employeeId does not reference an existing employee', {
      employeeId,
    })
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

export async function createUser(
  input: CreateUserInput,
  currentUserId: string,
): Promise<UserAccountDto> {
  const prisma = getPrismaClient()

  const [accountByAuthUserId, accountByEmail, accountByEmployeeId] = await Promise.all([
    prisma.userAccount.findUnique({
      where: { authUserId: input.authUserId },
      select: { id: true },
    }),
    prisma.userAccount.findUnique({
      where: { email: input.email },
      select: { id: true },
    }),
    input.employeeId
      ? prisma.userAccount.findUnique({
          where: { employeeId: input.employeeId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])

  if (accountByAuthUserId) {
    throw ApiError.conflict('authUserId is already linked to a user account')
  }

  if (accountByEmail) {
    throw ApiError.conflict('email is already linked to a user account')
  }

  if (accountByEmployeeId) {
    throw ApiError.conflict('employeeId is already linked to a user account')
  }

  if (input.employeeId) {
    await assertEmployeeExists(input.employeeId)
  }

  const roleIds = input.roleCodes ? await resolveRoleIds(input.roleCodes) : []

  try {
    const account = await prisma.userAccount.create({
      data: {
        authUserId: input.authUserId,
        email: input.email,
        employeeId: input.employeeId ?? null,
        ...(input.status ? { status: input.status } : {}),
        ...(roleIds.length > 0
          ? {
              userRoles: {
                create: roleIds.map((roleId) => ({
                  roleId,
                  assignedById: currentUserId,
                })),
              },
            }
          : {}),
      },
      include: userAccountInclude,
    })

    return toUserAccountDto(account)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw ApiError.conflict('User account conflicts with an existing record')
    }
    throw error
  }
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
  currentUserId: string,
): Promise<UserAccountDto> {
  const prisma = getPrismaClient()

  const existingAccount = await prisma.userAccount.findUnique({
    where: { id: userId },
    select: { id: true, employeeId: true },
  })

  if (!existingAccount) {
    throw ApiError.notFound('User account not found')
  }

  if (input.employeeId !== undefined && input.employeeId !== null) {
    if (input.employeeId !== existingAccount.employeeId) {
      await assertEmployeeExists(input.employeeId)

      const accountByEmployeeId = await prisma.userAccount.findUnique({
        where: { employeeId: input.employeeId },
        select: { id: true },
      })

      if (accountByEmployeeId && accountByEmployeeId.id !== userId) {
        throw ApiError.conflict('employeeId is already linked to a user account')
      }
    }
  }

  const roleIds = input.roleCodes ? await resolveRoleIds(input.roleCodes) : null

  const data: Prisma.UserAccountUncheckedUpdateInput = {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.employeeId !== undefined ? { employeeId: input.employeeId } : {}),
    ...(roleIds !== null
      ? {
          userRoles: {
            deleteMany: {},
            ...(roleIds.length > 0
              ? {
                  create: roleIds.map((roleId) => ({
                    roleId,
                    assignedById: currentUserId,
                  })),
                }
              : {}),
          },
        }
      : {}),
  }

  try {
    const account = await prisma.userAccount.update({
      where: { id: userId },
      data,
      include: userAccountInclude,
    })

    return toUserAccountDto(account)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw ApiError.conflict('User account conflicts with an existing record')
    }
    throw error
  }
}
