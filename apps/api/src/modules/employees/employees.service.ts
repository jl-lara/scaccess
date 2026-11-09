import type { EmployeeDto, EmployeeStatus } from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import { Prisma, type Employee } from '../../generated/prisma/client.js'
import { ApiError } from '../../utils/ApiError.js'
import { bumpDevicesConfigVersion } from '../../utils/configVersion.js'
import {
  buildPaginatedResponse,
  toPrismaSkipTake,
  type PaginationQuery,
} from '../../utils/pagination.js'
import type {
  CreateEmployeeBody,
  EmployeeListQuery,
  UpdateEmployeeBody,
} from './employees.schemas.js'

export type ConfigVersionBumper = (areaIds?: string[]) => Promise<void>

export interface EmployeeRecord {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string | null
  department: string | null
  position: string | null
  status: EmployeeStatus
  hiredAt: Date | null
  deactivatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface EmployeeListFilters {
  status?: EmployeeStatus
  department?: string
  search?: string
}

export interface CreateEmployeeInput {
  employeeCode: string
  firstName: string
  lastName: string
  email?: string | null
  department?: string | null
  position?: string | null
  status?: EmployeeStatus
  hiredAt?: Date | null
  deactivatedAt?: Date | null
}

export interface UpdateEmployeeInput {
  employeeCode?: string
  firstName?: string
  lastName?: string
  email?: string | null
  department?: string | null
  position?: string | null
  status?: EmployeeStatus
  hiredAt?: Date | null
  deactivatedAt?: Date | null
}

export interface EmployeeStore {
  list(
    filters: EmployeeListFilters,
    pagination: PaginationQuery,
  ): Promise<{ items: EmployeeRecord[]; total: number }>
  findById(id: string): Promise<EmployeeRecord | null>
  findByEmployeeCode(employeeCode: string): Promise<EmployeeRecord | null>
  findByEmail(email: string): Promise<EmployeeRecord | null>
  create(input: CreateEmployeeInput): Promise<EmployeeRecord>
  update(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord | null>
}

export function toEmployeeDto(employee: EmployeeRecord): EmployeeDto {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    department: employee.department,
    position: employee.position,
    status: employee.status,
    hiredAt: employee.hiredAt ? employee.hiredAt.toISOString() : null,
    deactivatedAt: employee.deactivatedAt ? employee.deactivatedAt.toISOString() : null,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  }
}

function toEmployeeRecord(employee: Employee): EmployeeRecord {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    department: employee.department,
    position: employee.position,
    status: employee.status,
    hiredAt: employee.hiredAt,
    deactivatedAt: employee.deactivatedAt,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  }
}

function buildWhere(filters: EmployeeListFilters): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = {}

  if (filters.status !== undefined) {
    where.status = filters.status
  }

  if (filters.department) {
    where.department = { equals: filters.department, mode: 'insensitive' }
  }

  if (filters.search) {
    where.OR = [
      { employeeCode: { contains: filters.search, mode: 'insensitive' } },
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ]
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

function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaError(error, 'P2002')
}

function buildCreateData(input: CreateEmployeeInput): Prisma.EmployeeCreateInput {
  return {
    employeeCode: input.employeeCode,
    firstName: input.firstName,
    lastName: input.lastName,
    ...(input.email === undefined ? {} : { email: input.email }),
    ...(input.department === undefined ? {} : { department: input.department }),
    ...(input.position === undefined ? {} : { position: input.position }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.hiredAt === undefined ? {} : { hiredAt: input.hiredAt }),
    ...(input.deactivatedAt === undefined ? {} : { deactivatedAt: input.deactivatedAt }),
  }
}

function buildUpdateData(input: UpdateEmployeeInput): Prisma.EmployeeUpdateInput {
  const data: Prisma.EmployeeUpdateInput = {}

  if (input.employeeCode !== undefined) {
    data.employeeCode = input.employeeCode
  }

  if (input.firstName !== undefined) {
    data.firstName = input.firstName
  }

  if (input.lastName !== undefined) {
    data.lastName = input.lastName
  }

  if (input.email !== undefined) {
    data.email = input.email
  }

  if (input.department !== undefined) {
    data.department = input.department
  }

  if (input.position !== undefined) {
    data.position = input.position
  }

  if (input.status !== undefined) {
    data.status = input.status
  }

  if (input.hiredAt !== undefined) {
    data.hiredAt = input.hiredAt
  }

  if (input.deactivatedAt !== undefined) {
    data.deactivatedAt = input.deactivatedAt
  }

  return data
}

export function createPrismaEmployeeStore(): EmployeeStore {
  return {
    async list(filters, pagination) {
      const prisma = getPrismaClient()
      const where = buildWhere(filters)

      const [items, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          orderBy: { employeeCode: 'asc' },
          ...toPrismaSkipTake(pagination),
        }),
        prisma.employee.count({ where }),
      ])

      return { items: items.map(toEmployeeRecord), total }
    },

    async findById(id) {
      const employee = await getPrismaClient().employee.findUnique({ where: { id } })
      return employee ? toEmployeeRecord(employee) : null
    },

    async findByEmployeeCode(employeeCode) {
      const employee = await getPrismaClient().employee.findUnique({
        where: { employeeCode },
      })
      return employee ? toEmployeeRecord(employee) : null
    },

    async findByEmail(email) {
      const employee = await getPrismaClient().employee.findUnique({ where: { email } })
      return employee ? toEmployeeRecord(employee) : null
    },

    async create(input) {
      try {
        const employee = await getPrismaClient().employee.create({
          data: buildCreateData(input),
        })
        return toEmployeeRecord(employee)
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw ApiError.conflict('Employee code or email already exists')
        }

        throw error
      }
    },

    async update(id, input) {
      try {
        const employee = await getPrismaClient().employee.update({
          where: { id },
          data: buildUpdateData(input),
        })
        return toEmployeeRecord(employee)
      } catch (error) {
        if (isPrismaError(error, 'P2025')) {
          return null
        }

        if (isUniqueConstraintError(error)) {
          throw ApiError.conflict('Employee code or email already exists')
        }

        throw error
      }
    },
  }
}

export class EmployeesService {
  constructor(
    private readonly store: EmployeeStore,
    private readonly bumpConfigVersion: ConfigVersionBumper = bumpDevicesConfigVersion,
  ) {}

  async list(query: EmployeeListQuery) {
    const { items, total } = await this.store.list(
      {
        status: query.status,
        department: query.department,
        search: query.search,
      },
      query,
    )

    return buildPaginatedResponse(items.map(toEmployeeDto), total, query)
  }

  async getById(id: string): Promise<EmployeeDto> {
    const employee = await this.store.findById(id)

    if (!employee) {
      throw ApiError.notFound('Employee not found')
    }

    return toEmployeeDto(employee)
  }

  async create(input: CreateEmployeeBody): Promise<EmployeeDto> {
    const sameCode = await this.store.findByEmployeeCode(input.employeeCode)

    if (sameCode) {
      throw ApiError.conflict('Employee code already exists')
    }

    if (input.email) {
      const sameEmail = await this.store.findByEmail(input.email)

      if (sameEmail) {
        throw ApiError.conflict('Employee email already exists')
      }
    }

    const status = input.status ?? 'active'
    const deactivatedAt =
      status === 'inactive' || status === 'suspended' ? new Date() : null

    const employee = await this.store.create({
      ...input,
      status,
      deactivatedAt,
    })

    await this.bumpConfigVersion()

    return toEmployeeDto(employee)
  }

  async update(id: string, input: UpdateEmployeeBody): Promise<EmployeeDto> {
    const existing = await this.store.findById(id)

    if (!existing) {
      throw ApiError.notFound('Employee not found')
    }

    if (input.employeeCode !== undefined && input.employeeCode !== existing.employeeCode) {
      const sameCode = await this.store.findByEmployeeCode(input.employeeCode)

      if (sameCode && sameCode.id !== id) {
        throw ApiError.conflict('Employee code already exists')
      }
    }

    if (input.email && input.email !== existing.email) {
      const sameEmail = await this.store.findByEmail(input.email)

      if (sameEmail && sameEmail.id !== id) {
        throw ApiError.conflict('Employee email already exists')
      }
    }

    const changes: UpdateEmployeeInput = { ...input }

    if (input.status === 'inactive' || input.status === 'suspended') {
      changes.deactivatedAt = new Date()
    } else if (input.status === 'active') {
      changes.deactivatedAt = null
    }

    const employee = await this.store.update(id, changes)

    if (!employee) {
      throw ApiError.notFound('Employee not found')
    }

    await this.bumpConfigVersion()

    return toEmployeeDto(employee)
  }
}

export function createEmployeesService(
  store: EmployeeStore = createPrismaEmployeeStore(),
  bumpConfigVersion: ConfigVersionBumper = bumpDevicesConfigVersion,
): EmployeesService {
  return new EmployeesService(store, bumpConfigVersion)
}
