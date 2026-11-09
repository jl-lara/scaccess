import type {
  AccessDeviceDto,
  DeviceCredentialIssuedDto,
  DeviceStatus,
  DeviceSyncStateDto,
  PaginatedResponse,
} from '@scaccess/shared'
import { generateDeviceToken } from '../../middleware/deviceAuth.js'
import { getPrismaClient } from '../../config/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { ApiError } from '../../utils/ApiError.js'
import {
  buildPaginatedResponse,
  toPrismaSkipTake,
  type PaginationQuery,
} from '../../utils/pagination.js'
import type {
  CreateAccessDeviceBody,
  UpdateAccessDeviceBody,
} from './access-devices.schemas.js'

interface AccessDeviceAreaRecord {
  areaId: string
}

interface AccessDeviceRecord {
  id: string
  deviceCode: string
  name: string
  location: string | null
  status: DeviceStatus
  hardwareModel: string | null
  firmwareVersion: string | null
  configVersion: bigint
  lastSeenAt: Date | null
  provisionedAt: Date | null
  createdAt: Date
  updatedAt: Date
  deviceAreas: AccessDeviceAreaRecord[]
}

interface DeviceSyncStateRecord {
  deviceId: string
  configVersion: bigint
  lastSyncRequestedAt: Date | null
  lastSyncCompletedAt: Date | null
  lastEventReceivedAt: Date | null
  lastEventOccurredAt: Date | null
  pendingEventCountReported: number | null
  lastErrorCode: string | null
  lastErrorAt: Date | null
  updatedAt: Date
}

const DEVICE_INCLUDE = {
  deviceAreas: { select: { areaId: true } },
} as const

function toIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

function toAccessDeviceDto(device: AccessDeviceRecord): AccessDeviceDto {
  return {
    id: device.id,
    deviceCode: device.deviceCode,
    name: device.name,
    location: device.location,
    status: device.status,
    hardwareModel: device.hardwareModel,
    firmwareVersion: device.firmwareVersion,
    configVersion: String(device.configVersion),
    lastSeenAt: toIsoString(device.lastSeenAt),
    provisionedAt: toIsoString(device.provisionedAt),
    areaIds: device.deviceAreas.map((deviceArea) => deviceArea.areaId).sort(),
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  }
}

function toDeviceSyncStateDto(state: DeviceSyncStateRecord): DeviceSyncStateDto {
  return {
    deviceId: state.deviceId,
    configVersion: String(state.configVersion),
    lastSyncRequestedAt: toIsoString(state.lastSyncRequestedAt),
    lastSyncCompletedAt: toIsoString(state.lastSyncCompletedAt),
    lastEventReceivedAt: toIsoString(state.lastEventReceivedAt),
    lastEventOccurredAt: toIsoString(state.lastEventOccurredAt),
    pendingEventCountReported: state.pendingEventCountReported,
    lastErrorCode: state.lastErrorCode,
    lastErrorAt: toIsoString(state.lastErrorAt),
    updatedAt: state.updatedAt.toISOString(),
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

async function assertAreasExist(areaIds: string[]): Promise<void> {
  if (areaIds.length === 0) {
    return
  }

  const areas = await getPrismaClient().area.findMany({
    where: { id: { in: areaIds } },
    select: { id: true },
  })
  const foundAreaIds = new Set(areas.map((area) => area.id))
  const missingAreaIds = areaIds.filter((areaId) => !foundAreaIds.has(areaId))

  if (missingAreaIds.length > 0) {
    throw ApiError.badRequest('One or more areas do not exist', {
      areaIds: missingAreaIds,
    })
  }
}

export async function listAccessDevices(
  query: PaginationQuery,
): Promise<PaginatedResponse<AccessDeviceDto>> {
  const prisma = getPrismaClient()
  const [devices, total] = await Promise.all([
    prisma.accessDevice.findMany({
      include: DEVICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      ...toPrismaSkipTake(query),
    }),
    prisma.accessDevice.count(),
  ])

  return buildPaginatedResponse(devices.map(toAccessDeviceDto), total, query)
}

export async function getAccessDevice(id: string): Promise<AccessDeviceDto> {
  const device = await getPrismaClient().accessDevice.findUnique({
    where: { id },
    include: DEVICE_INCLUDE,
  })

  if (!device) {
    throw ApiError.notFound('Access device not found')
  }

  return toAccessDeviceDto(device)
}

export async function createAccessDevice(
  input: CreateAccessDeviceBody,
): Promise<AccessDeviceDto> {
  const prisma = getPrismaClient()
  const areaIds = [...new Set(input.areaIds ?? [])]

  await assertAreasExist(areaIds)

  const existingDevice = await prisma.accessDevice.findUnique({
    where: { deviceCode: input.deviceCode },
  })

  if (existingDevice) {
    throw ApiError.conflict('Device code already exists', {
      deviceCode: input.deviceCode,
    })
  }

  try {
    const device = await prisma.accessDevice.create({
      data: {
        deviceCode: input.deviceCode,
        name: input.name,
        location: input.location ?? null,
        hardwareModel: input.hardwareModel ?? null,
        firmwareVersion: input.firmwareVersion ?? null,
        status: input.status ?? 'active',
        configVersion: 0n,
        ...(areaIds.length > 0
          ? {
              deviceAreas: {
                createMany: {
                  data: areaIds.map((areaId) => ({ areaId })),
                  skipDuplicates: true,
                },
              },
            }
          : {}),
        syncState: {
          create: { configVersion: 0n },
        },
      },
      include: DEVICE_INCLUDE,
    })

    return toAccessDeviceDto(device)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw ApiError.conflict('Device code already exists', {
        deviceCode: input.deviceCode,
      })
    }

    throw error
  }
}

export async function updateAccessDevice(
  id: string,
  input: UpdateAccessDeviceBody,
): Promise<AccessDeviceDto> {
  const prisma = getPrismaClient()
  const existingDevice = await prisma.accessDevice.findUnique({
    where: { id },
    include: DEVICE_INCLUDE,
  })

  if (!existingDevice) {
    throw ApiError.notFound('Access device not found')
  }

  const replacedAreaIds =
    input.areaIds === undefined ? undefined : [...new Set(input.areaIds)]

  if (replacedAreaIds) {
    await assertAreasExist(replacedAreaIds)
  }

  const data: Prisma.AccessDeviceUpdateInput = {}

  if (input.name !== undefined) {
    data.name = input.name
  }
  if (input.location !== undefined) {
    data.location = input.location
  }
  if (input.hardwareModel !== undefined) {
    data.hardwareModel = input.hardwareModel
  }
  if (input.firmwareVersion !== undefined) {
    data.firmwareVersion = input.firmwareVersion
  }
  if (input.status !== undefined) {
    data.status = input.status
  }

  if (replacedAreaIds !== undefined) {
    data.deviceAreas = {
      deleteMany: {},
      ...(replacedAreaIds.length > 0
        ? {
            createMany: {
              data: replacedAreaIds.map((areaId) => ({ areaId })),
              skipDuplicates: true,
            },
          }
        : {}),
    }
    data.configVersion = { increment: 1n }
  }

  const device = await prisma.accessDevice.update({
    where: { id },
    data,
    include: DEVICE_INCLUDE,
  })

  if (replacedAreaIds !== undefined) {
    const syncState = await prisma.deviceSyncState.findUnique({
      where: { deviceId: id },
    })

    if (syncState) {
      await prisma.deviceSyncState.update({
        where: { deviceId: id },
        data: { configVersion: device.configVersion },
      })
    }
  }

  return toAccessDeviceDto(device)
}

export async function issueDeviceCredential(
  deviceId: string,
): Promise<DeviceCredentialIssuedDto> {
  const prisma = getPrismaClient()
  const device = await prisma.accessDevice.findUnique({ where: { id: deviceId } })

  if (!device) {
    throw ApiError.notFound('Access device not found')
  }

  const generated = generateDeviceToken()
  const credential = await prisma.deviceCredential.create({
    data: {
      deviceId,
      tokenId: generated.tokenId,
      secretHash: generated.secretHash,
      expiresAt: null,
    },
  })

  if (device.provisionedAt === null) {
    await prisma.accessDevice.update({
      where: { id: deviceId },
      data: { provisionedAt: new Date() },
    })
  }

  return {
    id: credential.id,
    deviceId: credential.deviceId,
    tokenId: credential.tokenId,
    token: generated.token,
    createdAt: credential.createdAt.toISOString(),
    expiresAt: toIsoString(credential.expiresAt),
  }
}

export async function revokeDeviceCredential(
  deviceId: string,
  credentialId: string,
): Promise<void> {
  const prisma = getPrismaClient()
  const credential = await prisma.deviceCredential.findUnique({
    where: { id: credentialId },
  })

  if (!credential || credential.deviceId !== deviceId) {
    throw ApiError.notFound('Device credential not found')
  }

  if (credential.revokedAt === null) {
    await prisma.deviceCredential.update({
      where: { id: credentialId },
      data: { revokedAt: new Date() },
    })
  }
}

export async function getDeviceSyncState(deviceId: string): Promise<DeviceSyncStateDto> {
  const state = await getPrismaClient().deviceSyncState.findUnique({
    where: { deviceId },
  })

  if (!state) {
    throw ApiError.notFound('Device sync state not found')
  }

  return toDeviceSyncStateDto(state)
}
