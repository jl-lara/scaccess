import type {
  AccessDecision,
  AccessEventDto,
  AccessReason,
  PaginatedResponse,
} from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { ApiError } from '../../utils/ApiError.js'
import {
  buildPaginatedResponse,
  toPrismaSkipTake,
  type PaginationQuery,
} from '../../utils/pagination.js'
import type { AccessEventListQuery } from './access-events.schemas.js'

interface AccessEventRecord {
  id: string
  deviceId: string
  clientEventId: string
  deviceEpoch: string | null
  cardUid: string
  employeeId: string | null
  credentialId: string | null
  areaId: string
  decision: AccessDecision
  reasonCode: AccessReason
  occurredAt: Date
  receivedAt: Date
  deviceSequence: bigint | null
  metadata: unknown
  createdAt: Date
}

function toAccessEventDto(event: AccessEventRecord): AccessEventDto {
  return {
    id: event.id,
    deviceId: event.deviceId,
    clientEventId: event.clientEventId,
    deviceEpoch: event.deviceEpoch,
    cardUid: event.cardUid,
    employeeId: event.employeeId,
    credentialId: event.credentialId,
    areaId: event.areaId,
    decision: event.decision,
    reasonCode: event.reasonCode,
    occurredAt: event.occurredAt.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
    deviceSequence:
      event.deviceSequence === null ? null : String(event.deviceSequence),
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  }
}

function buildAccessEventWhere(
  filters: AccessEventListQuery,
): Prisma.AccessEventWhereInput {
  const where: Prisma.AccessEventWhereInput = {}

  if (filters.employeeId) {
    where.employeeId = filters.employeeId
  }
  if (filters.deviceId) {
    where.deviceId = filters.deviceId
  }
  if (filters.areaId) {
    where.areaId = filters.areaId
  }
  if (filters.decision) {
    where.decision = filters.decision
  }
  if (filters.reasonCode) {
    where.reasonCode = filters.reasonCode
  }
  if (filters.cardUid) {
    where.cardUid = filters.cardUid
  }

  if (filters.from !== undefined || filters.to !== undefined) {
    const occurredAt: { gte?: Date; lte?: Date } = {}

    if (filters.from !== undefined) {
      occurredAt.gte = new Date(filters.from)
    }
    if (filters.to !== undefined) {
      occurredAt.lte = new Date(filters.to)
    }

    where.occurredAt = occurredAt
  }

  return where
}

export async function listAccessEvents(
  query: AccessEventListQuery,
): Promise<PaginatedResponse<AccessEventDto>> {
  if (
    query.from !== undefined &&
    query.to !== undefined &&
    new Date(query.from).getTime() > new Date(query.to).getTime()
  ) {
    throw ApiError.badRequest('from must be earlier than or equal to to')
  }

  const prisma = getPrismaClient()
  const where = buildAccessEventWhere(query)

  const [events, total] = await Promise.all([
    prisma.accessEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      ...toPrismaSkipTake(query),
    }),
    prisma.accessEvent.count({ where }),
  ])

  return buildPaginatedResponse(events.map(toAccessEventDto), total, query)
}

export async function getAccessEvent(id: string): Promise<AccessEventDto> {
  const event = await getPrismaClient().accessEvent.findUnique({ where: { id } })

  if (!event) {
    throw ApiError.notFound('Access event not found')
  }

  return toAccessEventDto(event)
}

export async function listMyAccessEvents(
  employeeId: string,
  query: PaginationQuery,
): Promise<PaginatedResponse<AccessEventDto>> {
  const prisma = getPrismaClient()
  const where: Prisma.AccessEventWhereInput = { employeeId }

  const [events, total] = await Promise.all([
    prisma.accessEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      ...toPrismaSkipTake(query),
    }),
    prisma.accessEvent.count({ where }),
  ])

  return buildPaginatedResponse(events.map(toAccessEventDto), total, query)
}

export async function getMyAccessEvent(
  employeeId: string,
  id: string,
): Promise<AccessEventDto> {
  const event = await getPrismaClient().accessEvent.findUnique({ where: { id } })

  // A missing event and another employee's event intentionally share the same
  // response to prevent enumeration of the global history.
  if (!event || event.employeeId !== employeeId) {
    throw ApiError.notFound('Access event not found')
  }

  return toAccessEventDto(event)
}
