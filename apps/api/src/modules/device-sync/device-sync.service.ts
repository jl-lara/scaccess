import { createHash } from 'node:crypto'
import type {
  CredentialStatus,
  DeviceEventSyncResponse,
  DeviceSyncAreaItem,
  DeviceSyncCredentialItem,
  DeviceSyncEmployeeItem,
  DeviceSyncPayload,
  DeviceSyncPermissionItem,
  EmployeeStatus,
} from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import type { AuthenticatedDevice } from '../../middleware/deviceAuth.js'
import { isDecisionReasonCoherent } from './device-sync.schemas.js'
import type { DeviceEventSyncBody } from './device-sync.schemas.js'

interface DeviceAreaRow {
  areaId: string
  area: {
    id: string
    code: string
    name: string
    timezone: string
    isActive: boolean
  }
}

interface EmployeeRecord {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  status: EmployeeStatus
  credentials: Array<{
    id: string
    employeeId: string
    cardUid: string
    status: CredentialStatus
  }>
}

interface PermissionRow {
  employeeId: string
  areaId: string
  validFrom: Date | null
  validTo: Date | null
  schedule: unknown
  employee: EmployeeRecord
}

interface CredentialLookup {
  id: string
  employeeId: string
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

function toIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

/**
 * Builds the offline configuration for one authenticated device.
 *
 * Only active areas assigned to the device are included, together with the
 * non-revoked permissions for active employees and their RFID credentials.
 * The checksum covers the versioned content (not `generatedAt`) so it stays
 * stable while `configVersion` does not change.
 */
export async function buildDeviceSyncPayload(
  device: AuthenticatedDevice,
): Promise<DeviceSyncPayload> {
  const prisma = getPrismaClient()
  const syncVersion = String(device.configVersion)

  const deviceAreaRows: DeviceAreaRow[] = await prisma.deviceArea.findMany({
    where: { deviceId: device.id },
    include: { area: true },
  })

  const areas: DeviceSyncAreaItem[] = deviceAreaRows
    .filter((deviceArea) => deviceArea.area.isActive)
    .map((deviceArea) => ({
      id: deviceArea.area.id,
      code: deviceArea.area.code,
      name: deviceArea.area.name,
      timezone: deviceArea.area.timezone,
    }))
    .sort((left, right) => left.code.localeCompare(right.code))

  const areaIds = areas.map((area) => area.id)

  const permissionRows: PermissionRow[] =
    areaIds.length === 0
      ? []
      : await prisma.accessPermission.findMany({
          where: {
            areaId: { in: areaIds },
            revokedAt: null,
          },
          include: {
            employee: {
              include: { credentials: true },
            },
          },
        })

  const activePermissionRows = permissionRows.filter(
    (permission) => permission.employee.status === 'active',
  )

  const employeesById = new Map<string, DeviceSyncEmployeeItem>()
  const credentialsById = new Map<string, DeviceSyncCredentialItem>()

  for (const permission of activePermissionRows) {
    const { employee } = permission

    employeesById.set(employee.id, {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      status: employee.status,
    })

    for (const credential of employee.credentials) {
      credentialsById.set(credential.id, {
        id: credential.id,
        employeeId: credential.employeeId,
        cardUid: credential.cardUid,
        status: credential.status,
      })
    }
  }

  const employees = [...employeesById.values()].sort((left, right) =>
    left.employeeCode.localeCompare(right.employeeCode),
  )
  const credentials = [...credentialsById.values()].sort((left, right) =>
    left.cardUid.localeCompare(right.cardUid),
  )
  const permissions: DeviceSyncPermissionItem[] = activePermissionRows
    .map((permission) => ({
      employeeId: permission.employeeId,
      areaId: permission.areaId,
      validFrom: toIsoString(permission.validFrom),
      validTo: toIsoString(permission.validTo),
      schedule: permission.schedule,
    }))
    .sort((left, right) =>
      `${left.employeeId}:${left.areaId}`.localeCompare(
        `${right.employeeId}:${right.areaId}`,
      ),
    )

  const config = {
    configVersion: syncVersion,
    timezone: areas[0]?.timezone ?? 'America/Tijuana',
  }

  const checksum = createHash('sha256')
    .update(
      JSON.stringify({
        deviceId: device.id,
        syncVersion,
        areas,
        employees,
        credentials,
        permissions,
        config,
      }),
      'utf8',
    )
    .digest('hex')

  return {
    deviceId: device.id,
    syncVersion,
    generatedAt: new Date().toISOString(),
    checksum,
    areas,
    employees,
    credentials,
    permissions,
    config,
  }
}

/**
 * Records a successful sync handshake (both the 200 and the 304 branch).
 */
export async function recordDeviceSync(
  deviceId: string,
  configVersion?: bigint,
): Promise<void> {
  const prisma = getPrismaClient()
  const now = new Date()

  await prisma.accessDevice.update({
    where: { id: deviceId },
    data: { lastSeenAt: now },
  })

  const data: Prisma.DeviceSyncStateUpdateInput = {
    lastSyncRequestedAt: now,
    lastSyncCompletedAt: now,
  }

  if (configVersion !== undefined) {
    data.configVersion = configVersion
  }

  await prisma.deviceSyncState.update({
    where: { deviceId },
    data,
  })
}

/**
 * Ingests an offline batch. Each event is classified independently so a
 * duplicated or invalid item never aborts the rest of the batch.
 */
export async function syncDeviceEvents(
  device: AuthenticatedDevice,
  request: DeviceEventSyncBody,
): Promise<DeviceEventSyncResponse> {
  const prisma = getPrismaClient()
  const accepted: string[] = []
  const duplicated: string[] = []
  const rejected: DeviceEventSyncResponse['rejected'] = []

  const clientEventIds = request.events.map((event) => event.clientEventId)
  const existingEvents = await prisma.accessEvent.findMany({
    where: {
      deviceId: device.id,
      clientEventId: { in: clientEventIds },
    },
    select: { clientEventId: true },
  })
  const seenClientEventIds = new Set(
    existingEvents.map((event) => event.clientEventId),
  )

  const deviceAreaRows = await prisma.deviceArea.findMany({
    where: { deviceId: device.id },
    select: { areaId: true },
  })
  const knownAreaIds = new Set(
    deviceAreaRows.map((deviceArea) => deviceArea.areaId),
  )

  const unassignedAreaIds = [
    ...new Set(
      request.events
        .map((event) => event.areaId)
        .filter((areaId) => !knownAreaIds.has(areaId)),
    ),
  ]

  if (unassignedAreaIds.length > 0) {
    const existingAreas = await prisma.area.findMany({
      where: { id: { in: unassignedAreaIds } },
      select: { id: true },
    })

    for (const area of existingAreas) {
      knownAreaIds.add(area.id)
    }
  }

  const credentialCache = new Map<string, CredentialLookup | null>()
  let lastOccurredAt: Date | null = null

  const findCredential = async (cardUid: string): Promise<CredentialLookup | null> => {
    const cached = credentialCache.get(cardUid)
    if (cached !== undefined) {
      return cached
    }

    const credential = await prisma.credential.findUnique({ where: { cardUid } })
    const lookup = credential
      ? { id: credential.id, employeeId: credential.employeeId }
      : null

    credentialCache.set(cardUid, lookup)
    return lookup
  }

  for (const event of request.events) {
    if (seenClientEventIds.has(event.clientEventId)) {
      duplicated.push(event.clientEventId)
      continue
    }

    if (!knownAreaIds.has(event.areaId)) {
      rejected.push({
        clientEventId: event.clientEventId,
        reasonCode: 'area_not_allowed',
        message: 'Area is not assigned to this device or does not exist',
      })
      continue
    }

    if (!isDecisionReasonCoherent(event.decision, event.reasonCode)) {
      rejected.push({
        clientEventId: event.clientEventId,
        reasonCode: 'invalid_decision_reason',
        message: 'decision and reasonCode are inconsistent',
      })
      continue
    }

    const credential = await findCredential(event.cardUid)

    if (!credential && event.decision === 'granted') {
      rejected.push({
        clientEventId: event.clientEventId,
        reasonCode: 'card_unknown',
        message: 'An unknown card cannot be granted access',
      })
      continue
    }

    const occurredAt = new Date(event.occurredAt)
    const receivedAt = new Date()

    try {
      await prisma.accessEvent.create({
        data: {
          deviceId: device.id,
          clientEventId: event.clientEventId,
          deviceEpoch: event.deviceEpoch ?? null,
          cardUid: event.cardUid,
          employeeId: credential?.employeeId ?? null,
          credentialId: credential?.id ?? null,
          areaId: event.areaId,
          decision: event.decision,
          reasonCode: event.reasonCode,
          occurredAt,
          receivedAt,
          deviceSequence:
            event.deviceSequence === undefined ? null : BigInt(event.deviceSequence),
          metadata:
            event.metadata === undefined || event.metadata === null
              ? undefined
              : (event.metadata as Prisma.InputJsonValue),
        },
      })

      seenClientEventIds.add(event.clientEventId)
      accepted.push(event.clientEventId)

      if (lastOccurredAt === null || occurredAt > lastOccurredAt) {
        lastOccurredAt = occurredAt
      }
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        seenClientEventIds.add(event.clientEventId)
        duplicated.push(event.clientEventId)
        continue
      }

      throw error
    }
  }

  const now = new Date()

  await prisma.accessDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: now },
  })

  const syncStateData: Prisma.DeviceSyncStateUpdateInput = {
    lastEventReceivedAt: now,
  }

  if (lastOccurredAt !== null) {
    syncStateData.lastEventOccurredAt = lastOccurredAt
  }

  await prisma.deviceSyncState.update({
    where: { deviceId: device.id },
    data: syncStateData,
  })

  return { accepted, duplicated, rejected }
}
