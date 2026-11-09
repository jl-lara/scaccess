import type { CredentialDto, CredentialStatus } from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import { Prisma, type Credential } from '../../generated/prisma/client.js'
import { ApiError } from '../../utils/ApiError.js'
import { bumpDevicesConfigVersion } from '../../utils/configVersion.js'
import {
  buildPaginatedResponse,
  toPrismaSkipTake,
  type PaginationQuery,
} from '../../utils/pagination.js'
import type {
  CreateCredentialBody,
  CredentialListQuery,
  UpdateCredentialBody,
} from './credentials.schemas.js'

export type ConfigVersionBumper = (areaIds?: string[]) => Promise<void>

export interface CredentialRecord {
  id: string
  employeeId: string
  cardUid: string
  label: string | null
  status: CredentialStatus
  issuedAt: Date | null
  deactivatedAt: Date | null
  deactivationReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CredentialListFilters {
  employeeId?: string
  status?: CredentialStatus
  cardUid?: string
}

export interface CreateCredentialInput {
  employeeId: string
  cardUid: string
  label?: string | null
  status?: CredentialStatus
  issuedAt?: Date
  deactivatedAt?: Date | null
}

export interface UpdateCredentialInput {
  label?: string | null
  status?: CredentialStatus
  deactivatedAt?: Date | null
  deactivationReason?: string | null
}

export interface CredentialStore {
  list(
    filters: CredentialListFilters,
    pagination: PaginationQuery,
  ): Promise<{ items: CredentialRecord[]; total: number }>
  findById(id: string): Promise<CredentialRecord | null>
  findByCardUid(cardUid: string): Promise<CredentialRecord | null>
  create(input: CreateCredentialInput): Promise<CredentialRecord>
  update(id: string, input: UpdateCredentialInput): Promise<CredentialRecord | null>
}

export function toCredentialDto(credential: CredentialRecord): CredentialDto {
  return {
    id: credential.id,
    employeeId: credential.employeeId,
    cardUid: credential.cardUid,
    label: credential.label,
    status: credential.status,
    issuedAt: credential.issuedAt ? credential.issuedAt.toISOString() : null,
    deactivatedAt: credential.deactivatedAt ? credential.deactivatedAt.toISOString() : null,
    deactivationReason: credential.deactivationReason,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  }
}

function toCredentialRecord(credential: Credential): CredentialRecord {
  return {
    id: credential.id,
    employeeId: credential.employeeId,
    cardUid: credential.cardUid,
    label: credential.label,
    status: credential.status,
    issuedAt: credential.issuedAt,
    deactivatedAt: credential.deactivatedAt,
    deactivationReason: credential.deactivationReason,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
  }
}

function buildWhere(filters: CredentialListFilters): Prisma.CredentialWhereInput {
  const where: Prisma.CredentialWhereInput = {}

  if (filters.employeeId !== undefined) {
    where.employeeId = filters.employeeId
  }

  if (filters.status !== undefined) {
    where.status = filters.status
  }

  if (filters.cardUid !== undefined) {
    where.cardUid = filters.cardUid
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

function buildUpdateData(input: UpdateCredentialInput): Prisma.CredentialUpdateInput {
  const data: Prisma.CredentialUpdateInput = {}

  if (input.label !== undefined) {
    data.label = input.label
  }

  if (input.status !== undefined) {
    data.status = input.status
  }

  if (input.deactivatedAt !== undefined) {
    data.deactivatedAt = input.deactivatedAt
  }

  if (input.deactivationReason !== undefined) {
    data.deactivationReason = input.deactivationReason
  }

  return data
}

export function createPrismaCredentialStore(): CredentialStore {
  return {
    async list(filters, pagination) {
      const prisma = getPrismaClient()
      const where = buildWhere(filters)

      const [items, total] = await Promise.all([
        prisma.credential.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...toPrismaSkipTake(pagination),
        }),
        prisma.credential.count({ where }),
      ])

      return { items: items.map(toCredentialRecord), total }
    },

    async findById(id) {
      const credential = await getPrismaClient().credential.findUnique({ where: { id } })
      return credential ? toCredentialRecord(credential) : null
    },

    async findByCardUid(cardUid) {
      const credential = await getPrismaClient().credential.findUnique({
        where: { cardUid },
      })
      return credential ? toCredentialRecord(credential) : null
    },

    async create(input) {
      try {
        const credential = await getPrismaClient().credential.create({
          data: {
            employeeId: input.employeeId,
            cardUid: input.cardUid,
            ...(input.label === undefined ? {} : { label: input.label }),
            ...(input.status === undefined ? {} : { status: input.status }),
            ...(input.issuedAt === undefined ? {} : { issuedAt: input.issuedAt }),
            ...(input.deactivatedAt === undefined
              ? {}
              : { deactivatedAt: input.deactivatedAt }),
          },
        })
        return toCredentialRecord(credential)
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw ApiError.conflict('Card UID already registered')
        }

        if (isPrismaError(error, 'P2003')) {
          throw ApiError.badRequest('Employee not found')
        }

        throw error
      }
    },

    async update(id, input) {
      try {
        const credential = await getPrismaClient().credential.update({
          where: { id },
          data: buildUpdateData(input),
        })
        return toCredentialRecord(credential)
      } catch (error) {
        if (isPrismaError(error, 'P2025')) {
          return null
        }

        throw error
      }
    },
  }
}

export class CredentialsService {
  constructor(
    private readonly store: CredentialStore,
    private readonly bumpConfigVersion: ConfigVersionBumper = bumpDevicesConfigVersion,
  ) {}

  async list(query: CredentialListQuery) {
    const { items, total } = await this.store.list(
      {
        employeeId: query.employeeId,
        status: query.status,
        cardUid: query.cardUid,
      },
      query,
    )

    return buildPaginatedResponse(items.map(toCredentialDto), total, query)
  }

  async getById(id: string): Promise<CredentialDto> {
    const credential = await this.store.findById(id)

    if (!credential) {
      throw ApiError.notFound('Credential not found')
    }

    return toCredentialDto(credential)
  }

  async create(input: CreateCredentialBody): Promise<CredentialDto> {
    const existing = await this.store.findByCardUid(input.cardUid)

    if (existing) {
      throw ApiError.conflict('Card UID already registered')
    }

    const status = input.status ?? 'active'
    const now = new Date()

    const credential = await this.store.create({
      ...input,
      status,
      issuedAt: now,
      ...(status === 'active' ? {} : { deactivatedAt: now }),
    })

    await this.bumpConfigVersion()

    return toCredentialDto(credential)
  }

  async update(id: string, input: UpdateCredentialBody): Promise<CredentialDto> {
    const existing = await this.store.findById(id)

    if (!existing) {
      throw ApiError.notFound('Credential not found')
    }

    const changes: UpdateCredentialInput = { ...input }

    if (input.status === 'active') {
      changes.deactivatedAt = null

      if (input.deactivationReason === undefined) {
        changes.deactivationReason = null
      }
    } else if (input.status !== undefined) {
      changes.deactivatedAt = new Date()
    }

    const credential = await this.store.update(id, changes)

    if (!credential) {
      throw ApiError.notFound('Credential not found')
    }

    if (input.status !== undefined) {
      await this.bumpConfigVersion()
    }

    return toCredentialDto(credential)
  }
}

export function createCredentialsService(
  store: CredentialStore = createPrismaCredentialStore(),
  bumpConfigVersion: ConfigVersionBumper = bumpDevicesConfigVersion,
): CredentialsService {
  return new CredentialsService(store, bumpConfigVersion)
}
