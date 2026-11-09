import type { AreaDto } from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import { Prisma, type Area } from '../../generated/prisma/client.js'
import { ApiError } from '../../utils/ApiError.js'
import { bumpDevicesConfigVersion } from '../../utils/configVersion.js'
import {
  buildPaginatedResponse,
  toPrismaSkipTake,
  type PaginationQuery,
} from '../../utils/pagination.js'
import type { AreaListQuery, CreateAreaBody, UpdateAreaBody } from './areas.schemas.js'

export interface AreaRecord {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  timezone: string
  createdAt: Date
  updatedAt: Date
}

export interface AreaListFilters {
  isActive?: boolean
  search?: string
}

export interface CreateAreaInput {
  code: string
  name: string
  description?: string | null
  isActive?: boolean
  timezone?: string
}

export interface UpdateAreaInput {
  name?: string
  description?: string | null
  isActive?: boolean
  timezone?: string
}

export interface AreaStore {
  list(
    filters: AreaListFilters,
    pagination: PaginationQuery,
  ): Promise<{ items: AreaRecord[]; total: number }>
  findById(id: string): Promise<AreaRecord | null>
  findByCode(code: string): Promise<AreaRecord | null>
  create(input: CreateAreaInput): Promise<AreaRecord>
  update(id: string, input: UpdateAreaInput): Promise<AreaRecord | null>
}

export type ConfigVersionBumper = (areaIds?: string[]) => Promise<void>

export function toAreaDto(area: AreaRecord): AreaDto {
  return {
    id: area.id,
    code: area.code,
    name: area.name,
    description: area.description,
    isActive: area.isActive,
    timezone: area.timezone,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString(),
  }
}

function toAreaRecord(area: Area): AreaRecord {
  return {
    id: area.id,
    code: area.code,
    name: area.name,
    description: area.description,
    isActive: area.isActive,
    timezone: area.timezone,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
  }
}

function buildWhere(filters: AreaListFilters): Prisma.AreaWhereInput {
  const where: Prisma.AreaWhereInput = {}

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive
  }

  if (filters.search) {
    where.OR = [
      { code: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
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

function buildUpdateData(input: UpdateAreaInput): Prisma.AreaUpdateInput {
  const data: Prisma.AreaUpdateInput = {}

  if (input.name !== undefined) {
    data.name = input.name
  }

  if (input.description !== undefined) {
    data.description = input.description
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive
  }

  if (input.timezone !== undefined) {
    data.timezone = input.timezone
  }

  return data
}

export function createPrismaAreaStore(): AreaStore {
  return {
    async list(filters, pagination) {
      const prisma = getPrismaClient()
      const where = buildWhere(filters)

      const [items, total] = await Promise.all([
        prisma.area.findMany({
          where,
          orderBy: { code: 'asc' },
          ...toPrismaSkipTake(pagination),
        }),
        prisma.area.count({ where }),
      ])

      return { items: items.map(toAreaRecord), total }
    },

    async findById(id) {
      const area = await getPrismaClient().area.findUnique({ where: { id } })
      return area ? toAreaRecord(area) : null
    },

    async findByCode(code) {
      const area = await getPrismaClient().area.findUnique({ where: { code } })
      return area ? toAreaRecord(area) : null
    },

    async create(input) {
      try {
        const area = await getPrismaClient().area.create({
          data: {
            code: input.code,
            name: input.name,
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
            ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
          },
        })

        return toAreaRecord(area)
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw ApiError.conflict('Area code already exists')
        }

        throw error
      }
    },

    async update(id, input) {
      try {
        const area = await getPrismaClient().area.update({
          where: { id },
          data: buildUpdateData(input),
        })

        return toAreaRecord(area)
      } catch (error) {
        if (isPrismaError(error, 'P2025')) {
          return null
        }

        throw error
      }
    },
  }
}

export class AreasService {
  constructor(
    private readonly store: AreaStore,
    private readonly bumpConfigVersion: ConfigVersionBumper = bumpDevicesConfigVersion,
  ) {}

  async list(query: AreaListQuery) {
    const { items, total } = await this.store.list(
      { isActive: query.isActive, search: query.search },
      query,
    )

    return buildPaginatedResponse(items.map(toAreaDto), total, query)
  }

  async getById(id: string): Promise<AreaDto> {
    const area = await this.store.findById(id)

    if (!area) {
      throw ApiError.notFound('Area not found')
    }

    return toAreaDto(area)
  }

  async create(input: CreateAreaBody): Promise<AreaDto> {
    const existing = await this.store.findByCode(input.code)

    if (existing) {
      throw ApiError.conflict('Area code already exists')
    }

    const area = await this.store.create(input)
    await this.bumpConfigVersion([area.id])

    return toAreaDto(area)
  }

  async update(id: string, input: UpdateAreaBody): Promise<AreaDto> {
    const existing = await this.store.findById(id)

    if (!existing) {
      throw ApiError.notFound('Area not found')
    }

    const area = await this.store.update(id, input)

    if (!area) {
      throw ApiError.notFound('Area not found')
    }

    await this.bumpConfigVersion([id])

    return toAreaDto(area)
  }
}

export function createAreasService(
  store: AreaStore = createPrismaAreaStore(),
  bumpConfigVersion: ConfigVersionBumper = bumpDevicesConfigVersion,
): AreasService {
  return new AreasService(store, bumpConfigVersion)
}
