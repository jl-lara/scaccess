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
} from '../../utils/pagination.js'
import type {
  AccessEventListQuery,
  MyAccessEventsQuery,
} from './access-events.schemas.js'

const accessEventInclude = {
  area: { select: { id: true, code: true, name: true } },
  device: { select: { id: true, deviceCode: true, name: true, location: true } },
} as const

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
  area?: { id: string; code: string; name: string } | null
  device?: {
    id: string
    deviceCode: string
    name: string
    location: string | null
  } | null
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
    ...(event.area
      ? {
          area: {
            id: event.area.id,
            code: event.area.code,
            name: event.area.name,
          },
        }
      : {}),
    ...(event.device
      ? {
          device: {
            id: event.device.id,
            deviceCode: event.device.deviceCode,
            name: event.device.name,
            location: event.device.location,
          },
        }
      : {}),
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

function assertValidDateRange(from?: string, to?: string): void {
  if (
    from !== undefined &&
    to !== undefined &&
    new Date(from).getTime() > new Date(to).getTime()
  ) {
    throw ApiError.badRequest('from must be earlier than or equal to to')
  }
}

export async function listAccessEvents(
  query: AccessEventListQuery,
): Promise<PaginatedResponse<AccessEventDto>> {
  assertValidDateRange(query.from, query.to)

  const prisma = getPrismaClient()
  const where = buildAccessEventWhere(query)

  const [events, total] = await Promise.all([
    prisma.accessEvent.findMany({
      where,
      include: accessEventInclude,
      orderBy: { occurredAt: 'desc' },
      ...toPrismaSkipTake(query),
    }),
    prisma.accessEvent.count({ where }),
  ])

  return buildPaginatedResponse(events.map(toAccessEventDto), total, query)
}

export async function getAccessEvent(id: string): Promise<AccessEventDto> {
  const event = await getPrismaClient().accessEvent.findUnique({
    where: { id },
    include: accessEventInclude,
  })

  if (!event) {
    throw ApiError.notFound('Access event not found')
  }

  return toAccessEventDto(event)
}

export async function listMyAccessEvents(
  employeeId: string,
  query: MyAccessEventsQuery,
): Promise<PaginatedResponse<AccessEventDto>> {
  assertValidDateRange(query.from, query.to)

  const prisma = getPrismaClient()
  // Always enforce the authenticated employeeId regardless of query contents.
  const where = buildAccessEventWhere({
    page: query.page,
    pageSize: query.pageSize,
    areaId: query.areaId,
    decision: query.decision,
    from: query.from,
    to: query.to,
    employeeId,
  })

  const [events, total] = await Promise.all([
    prisma.accessEvent.findMany({
      where,
      include: accessEventInclude,
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
  const event = await getPrismaClient().accessEvent.findUnique({
    where: { id },
    include: accessEventInclude,
  })

  // A missing event and another employee's event intentionally share the same
  // response to prevent enumeration of the global history.
  if (!event || event.employeeId !== employeeId) {
    throw ApiError.notFound('Access event not found')
  }

  return toAccessEventDto(event)
}
