import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '../src/middleware/errorHandler.js'
import {
  setAuthTokenResolver,
  type AuthenticatedUser,
} from '../src/middleware/auth.js'
import {
  generateDeviceToken,
  hashDeviceSecret,
  setDeviceAuthResolver,
  type AuthenticatedDevice,
} from '../src/middleware/deviceAuth.js'
import { accessDevicesRouter } from '../src/modules/access-devices/access-devices.routes.js'
import {
  accessEventsRouter,
  myAccessEventsRouter,
} from '../src/modules/access-events/access-events.routes.js'
import { deviceSyncRouter } from '../src/modules/device-sync/device-sync.routes.js'

// The repository must never touch a real database from tests. The Prisma
// client factory is replaced with a small in-memory implementation that keeps
// the same query surface used by the modules under test.
const prismaHolder = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('../src/config/prisma.js', () => ({
  getPrismaClient: () => prismaHolder.current,
  disconnectPrisma: async () => undefined,
}))

const AREA_MAIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const AREA_LAB_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const EMPLOYEE_A_ID = '11111111-1111-4111-8111-111111111111'
const EMPLOYEE_B_ID = '22222222-2222-4222-8222-222222222222'
const DEVICE_ID = '33333333-3333-4333-8333-333333333333'
const KNOWN_CARD_UID = 'A1B2C3D4'
const UNKNOWN_CARD_UID = 'DEADBEEF'

type FakeDeviceStatus = 'active' | 'inactive' | 'maintenance'
type FakeEmployeeStatus = 'active' | 'inactive' | 'suspended'
type FakeCredentialStatus = 'active' | 'blocked' | 'lost' | 'retired'
type FakeAccessDecision = 'granted' | 'denied'

interface FakeArea {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  timezone: string
  createdAt: Date
  updatedAt: Date
}

interface FakeEmployee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string | null
  department: string | null
  position: string | null
  status: FakeEmployeeStatus
  hiredAt: Date | null
  deactivatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface FakeCredential {
  id: string
  employeeId: string
  cardUid: string
  label: string | null
  status: FakeCredentialStatus
  issuedAt: Date | null
  deactivatedAt: Date | null
  deactivationReason: string | null
  createdAt: Date
  updatedAt: Date
}

interface FakePermission {
  id: string
  employeeId: string
  areaId: string
  validFrom: Date | null
  validTo: Date | null
  schedule: unknown
  revokedAt: Date | null
  grantedById: string | null
  createdAt: Date
  updatedAt: Date
}

interface FakeSyncState {
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

interface FakeDevice {
  id: string
  deviceCode: string
  name: string
  location: string | null
  status: FakeDeviceStatus
  hardwareModel: string | null
  firmwareVersion: string | null
  configVersion: bigint
  lastSeenAt: Date | null
  provisionedAt: Date | null
  createdAt: Date
  updatedAt: Date
  areaIds: string[]
}

interface FakeDeviceCredential {
  id: string
  deviceId: string
  tokenId: string
  secretHash: string
  createdAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  lastUsedAt: Date | null
}

interface FakeAccessEvent {
  id: string
  deviceId: string
  clientEventId: string
  deviceEpoch: string | null
  cardUid: string
  employeeId: string | null
  credentialId: string | null
  areaId: string
  decision: FakeAccessDecision
  reasonCode: string
  occurredAt: Date
  receivedAt: Date
  deviceSequence: bigint | null
  metadata: unknown
  createdAt: Date
}

interface AccessDeviceCreateData {
  deviceCode: string
  name: string
  location?: string | null
  hardwareModel?: string | null
  firmwareVersion?: string | null
  status?: FakeDeviceStatus
  configVersion?: bigint
  deviceAreas?: {
    createMany?: { data?: Array<{ areaId: string }> }
  }
  syncState?: {
    create?: { configVersion?: bigint }
  }
}

interface AccessDeviceUpdateData {
  name?: string
  location?: string | null
  hardwareModel?: string | null
  firmwareVersion?: string | null
  status?: FakeDeviceStatus
  configVersion?: bigint | { increment: bigint }
  provisionedAt?: Date | null
  lastSeenAt?: Date
  deviceAreas?: {
    deleteMany?: Record<string, never>
    createMany?: { data?: Array<{ areaId: string }> }
  }
}

interface SyncStateUpdateData {
  configVersion?: bigint
  lastSyncRequestedAt?: Date
  lastSyncCompletedAt?: Date
  lastEventReceivedAt?: Date
  lastEventOccurredAt?: Date
}

interface AccessEventWhere {
  deviceId?: string
  employeeId?: string | null
  areaId?: string
  decision?: FakeAccessDecision
  reasonCode?: string
  cardUid?: string
  clientEventId?: string | { in?: string[] }
  occurredAt?: { gte?: Date; lte?: Date }
}

interface AccessEventCreateData {
  deviceId: string
  clientEventId: string
  deviceEpoch?: string | null
  cardUid: string
  employeeId?: string | null
  credentialId?: string | null
  areaId: string
  decision: FakeAccessDecision
  reasonCode: string
  occurredAt: Date
  receivedAt?: Date
  deviceSequence?: bigint | null
  metadata?: unknown
}

function matchesAccessEvent(
  event: FakeAccessEvent,
  where: AccessEventWhere = {},
): boolean {
  if (where.deviceId !== undefined && event.deviceId !== where.deviceId) {
    return false
  }
  if (where.employeeId !== undefined && event.employeeId !== where.employeeId) {
    return false
  }
  if (where.areaId !== undefined && event.areaId !== where.areaId) {
    return false
  }
  if (where.decision !== undefined && event.decision !== where.decision) {
    return false
  }
  if (where.reasonCode !== undefined && event.reasonCode !== where.reasonCode) {
    return false
  }
  if (where.cardUid !== undefined && event.cardUid !== where.cardUid) {
    return false
  }
  if (typeof where.clientEventId === 'string') {
    if (event.clientEventId !== where.clientEventId) {
      return false
    }
  } else if (
    where.clientEventId?.in !== undefined &&
    !where.clientEventId.in.includes(event.clientEventId)
  ) {
    return false
  }
  if (
    where.occurredAt?.gte !== undefined &&
    event.occurredAt.getTime() < where.occurredAt.gte.getTime()
  ) {
    return false
  }
  if (
    where.occurredAt?.lte !== undefined &&
    event.occurredAt.getTime() > where.occurredAt.lte.getTime()
  ) {
    return false
  }

  return true
}

class InMemoryPrisma {
  readonly areas: FakeArea[] = []
  readonly employees: FakeEmployee[] = []
  readonly credentials: FakeCredential[] = []
  readonly permissions: FakePermission[] = []
  readonly devices: FakeDevice[] = []
  readonly syncStates: FakeSyncState[] = []
  readonly deviceCredentials: FakeDeviceCredential[] = []
  readonly events: FakeAccessEvent[] = []

  private idCounter = 0

  private nextId(): string {
    this.idCounter += 1
    return `00000000-0000-4000-8000-${String(this.idCounter).padStart(12, '0')}`
  }

  private withDeviceAreas(device: FakeDevice) {
    return {
      ...device,
      deviceAreas: device.areaIds.map((areaId) => ({ areaId })),
    }
  }

  readonly accessDevice = {
    findMany: async (args: { skip?: number; take?: number } = {}) => {
      const sorted = [...this.devices].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      const start = args.skip ?? 0
      const end = args.take === undefined ? undefined : start + args.take

      return sorted.slice(start, end).map((device) => this.withDeviceAreas(device))
    },
    count: async () => this.devices.length,
    findUnique: async (args: {
      where: { id?: string; deviceCode?: string }
    }) => {
      const device =
        args.where.id !== undefined
          ? this.devices.find((item) => item.id === args.where.id)
          : this.devices.find((item) => item.deviceCode === args.where.deviceCode)

      return device ? this.withDeviceAreas(device) : null
    },
    create: async (args: { data: AccessDeviceCreateData }) => {
      const now = new Date()
      const areaIds = (args.data.deviceAreas?.createMany?.data ?? []).map(
        (row) => row.areaId,
      )
      const device: FakeDevice = {
        id: this.nextId(),
        deviceCode: args.data.deviceCode,
        name: args.data.name,
        location: args.data.location ?? null,
        status: args.data.status ?? 'active',
        hardwareModel: args.data.hardwareModel ?? null,
        firmwareVersion: args.data.firmwareVersion ?? null,
        configVersion: args.data.configVersion ?? 0n,
        lastSeenAt: null,
        provisionedAt: null,
        createdAt: now,
        updatedAt: now,
        areaIds,
      }

      this.devices.push(device)
      this.syncStates.push({
        deviceId: device.id,
        configVersion: args.data.syncState?.create?.configVersion ?? 0n,
        lastSyncRequestedAt: null,
        lastSyncCompletedAt: null,
        lastEventReceivedAt: null,
        lastEventOccurredAt: null,
        pendingEventCountReported: null,
        lastErrorCode: null,
        lastErrorAt: null,
        updatedAt: now,
      })

      return this.withDeviceAreas(device)
    },
    update: async (args: { where: { id: string }; data: AccessDeviceUpdateData }) => {
      const device = this.devices.find((item) => item.id === args.where.id)

      if (!device) {
        throw new Error('Access device not found')
      }

      const { data } = args

      if (data.name !== undefined) {
        device.name = data.name
      }
      if (data.location !== undefined) {
        device.location = data.location
      }
      if (data.hardwareModel !== undefined) {
        device.hardwareModel = data.hardwareModel
      }
      if (data.firmwareVersion !== undefined) {
        device.firmwareVersion = data.firmwareVersion
      }
      if (data.status !== undefined) {
        device.status = data.status
      }
      if (data.provisionedAt !== undefined) {
        device.provisionedAt = data.provisionedAt
      }
      if (data.lastSeenAt !== undefined) {
        device.lastSeenAt = data.lastSeenAt
      }
      if (data.configVersion !== undefined) {
        if (typeof data.configVersion === 'bigint') {
          device.configVersion = data.configVersion
        } else {
          device.configVersion += data.configVersion.increment
        }
      }
      if (data.deviceAreas !== undefined) {
        device.areaIds = (data.deviceAreas.createMany?.data ?? []).map(
          (row) => row.areaId,
        )
      }

      device.updatedAt = new Date()
      return this.withDeviceAreas(device)
    },
  }

  readonly deviceArea = {
    findMany: async (args: { where: { deviceId: string } }) => {
      const device = this.devices.find((item) => item.id === args.where.deviceId)

      if (!device) {
        return []
      }

      return device.areaIds.flatMap((areaId) => {
        const area = this.areas.find((item) => item.id === areaId)
        return area
          ? [{ deviceId: device.id, areaId, createdAt: device.createdAt, area }]
          : []
      })
    },
  }

  readonly deviceSyncState = {
    findUnique: async (args: { where: { deviceId: string } }) =>
      this.syncStates.find((state) => state.deviceId === args.where.deviceId) ?? null,
    update: async (args: {
      where: { deviceId: string }
      data: SyncStateUpdateData
    }) => {
      const state = this.syncStates.find(
        (item) => item.deviceId === args.where.deviceId,
      )

      if (!state) {
        throw new Error('Device sync state not found')
      }

      if (args.data.configVersion !== undefined) {
        state.configVersion = args.data.configVersion
      }
      if (args.data.lastSyncRequestedAt !== undefined) {
        state.lastSyncRequestedAt = args.data.lastSyncRequestedAt
      }
      if (args.data.lastSyncCompletedAt !== undefined) {
        state.lastSyncCompletedAt = args.data.lastSyncCompletedAt
      }
      if (args.data.lastEventReceivedAt !== undefined) {
        state.lastEventReceivedAt = args.data.lastEventReceivedAt
      }
      if (args.data.lastEventOccurredAt !== undefined) {
        state.lastEventOccurredAt = args.data.lastEventOccurredAt
      }

      state.updatedAt = new Date()
      return state
    },
  }

  readonly deviceCredential = {
    create: async (args: {
      data: {
        deviceId: string
        tokenId: string
        secretHash: string
        expiresAt?: Date | null
      }
    }) => {
      const credential: FakeDeviceCredential = {
        id: this.nextId(),
        deviceId: args.data.deviceId,
        tokenId: args.data.tokenId,
        secretHash: args.data.secretHash,
        createdAt: new Date(),
        expiresAt: args.data.expiresAt ?? null,
        revokedAt: null,
        lastUsedAt: null,
      }

      this.deviceCredentials.push(credential)
      return credential
    },
    findUnique: async (args: { where: { id?: string; tokenId?: string } }) => {
      const credential =
        args.where.id !== undefined
          ? this.deviceCredentials.find((item) => item.id === args.where.id)
          : this.deviceCredentials.find((item) => item.tokenId === args.where.tokenId)

      return credential ?? null
    },
    update: async (args: {
      where: { id: string }
      data: { revokedAt?: Date | null; lastUsedAt?: Date }
    }) => {
      const credential = this.deviceCredentials.find(
        (item) => item.id === args.where.id,
      )

      if (!credential) {
        throw new Error('Device credential not found')
      }

      if (args.data.revokedAt !== undefined) {
        credential.revokedAt = args.data.revokedAt
      }
      if (args.data.lastUsedAt !== undefined) {
        credential.lastUsedAt = args.data.lastUsedAt
      }

      return credential
    },
  }

  readonly credential = {
    findUnique: async (args: { where: { cardUid: string } }) =>
      this.credentials.find((item) => item.cardUid === args.where.cardUid) ?? null,
  }

  readonly area = {
    findMany: async (args: { where: { id: { in: string[] } } }) =>
      this.areas.filter((area) => args.where.id.in.includes(area.id)),
  }

  readonly accessPermission = {
    findMany: async (args: {
      where?: { areaId?: { in?: string[] }; revokedAt?: Date | null }
    }) => {
      const areaIds = args.where?.areaId?.in

      return this.permissions
        .filter((permission) => areaIds === undefined || areaIds.includes(permission.areaId))
        .filter(
          (permission) =>
            args.where?.revokedAt === undefined ||
            permission.revokedAt === args.where.revokedAt,
        )
        .map((permission) => {
          const employee = this.employees.find(
            (item) => item.id === permission.employeeId,
          )

          return {
            ...permission,
            employee:
              employee === undefined
                ? null
                : {
                    ...employee,
                    credentials: this.credentials.filter(
                      (credential) => credential.employeeId === employee.id,
                    ),
                  },
          }
        })
    },
  }

  readonly accessEvent = {
    findMany: async (
      args: {
        where?: AccessEventWhere
        orderBy?: { occurredAt?: 'asc' | 'desc' }
        skip?: number
        take?: number
        select?: unknown
      } = {},
    ) => {
      const matching = this.events.filter((event) =>
        matchesAccessEvent(event, args.where),
      )
      const sorted =
        args.orderBy?.occurredAt === 'desc'
          ? [...matching].sort(
              (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
            )
          : matching
      const start = args.skip ?? 0
      const end = args.take === undefined ? undefined : start + args.take

      return sorted.slice(start, end)
    },
    count: async (args: { where?: AccessEventWhere } = {}) =>
      this.events.filter((event) => matchesAccessEvent(event, args.where)).length,
    findUnique: async (args: { where: { id: string } }) =>
      this.events.find((event) => event.id === args.where.id) ?? null,
    create: async (args: { data: AccessEventCreateData }) => {
      const duplicate = this.events.some(
        (event) =>
          event.deviceId === args.data.deviceId &&
          event.clientEventId === args.data.clientEventId,
      )

      if (duplicate) {
        const error = new Error('Unique constraint failed') as Error & {
          code: string
        }
        error.code = 'P2002'
        throw error
      }

      const now = new Date()
      const event: FakeAccessEvent = {
        id: this.nextId(),
        deviceId: args.data.deviceId,
        clientEventId: args.data.clientEventId,
        deviceEpoch: args.data.deviceEpoch ?? null,
        cardUid: args.data.cardUid,
        employeeId: args.data.employeeId ?? null,
        credentialId: args.data.credentialId ?? null,
        areaId: args.data.areaId,
        decision: args.data.decision,
        reasonCode: args.data.reasonCode,
        occurredAt: args.data.occurredAt,
        receivedAt: args.data.receivedAt ?? now,
        deviceSequence: args.data.deviceSequence ?? null,
        metadata: args.data.metadata ?? null,
        createdAt: now,
      }

      this.events.push(event)
      return event
    },
  }

  addArea(input: {
    id?: string
    code: string
    name?: string
    timezone?: string
    isActive?: boolean
  }): FakeArea {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const area: FakeArea = {
      id: input.id ?? this.nextId(),
      code: input.code,
      name: input.name ?? input.code,
      description: null,
      isActive: input.isActive ?? true,
      timezone: input.timezone ?? 'America/Tijuana',
      createdAt: now,
      updatedAt: now,
    }

    this.areas.push(area)
    return area
  }

  addEmployee(input: {
    id?: string
    employeeCode: string
    firstName?: string
    lastName?: string
    status?: FakeEmployeeStatus
  }): FakeEmployee {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const employee: FakeEmployee = {
      id: input.id ?? this.nextId(),
      employeeCode: input.employeeCode,
      firstName: input.firstName ?? 'Ana',
      lastName: input.lastName ?? 'Lopez',
      email: null,
      department: null,
      position: null,
      status: input.status ?? 'active',
      hiredAt: null,
      deactivatedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    this.employees.push(employee)
    return employee
  }

  addCredential(input: {
    id?: string
    employeeId: string
    cardUid: string
    status?: FakeCredentialStatus
  }): FakeCredential {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const credential: FakeCredential = {
      id: input.id ?? this.nextId(),
      employeeId: input.employeeId,
      cardUid: input.cardUid,
      label: null,
      status: input.status ?? 'active',
      issuedAt: now,
      deactivatedAt: null,
      deactivationReason: null,
      createdAt: now,
      updatedAt: now,
    }

    this.credentials.push(credential)
    return credential
  }

  addPermission(input: {
    id?: string
    employeeId: string
    areaId: string
    validFrom?: Date | null
    validTo?: Date | null
    revokedAt?: Date | null
  }): FakePermission {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const permission: FakePermission = {
      id: input.id ?? this.nextId(),
      employeeId: input.employeeId,
      areaId: input.areaId,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      schedule: null,
      revokedAt: input.revokedAt ?? null,
      grantedById: null,
      createdAt: now,
      updatedAt: now,
    }

    this.permissions.push(permission)
    return permission
  }

  addDevice(input: {
    id?: string
    deviceCode: string
    name?: string
    status?: FakeDeviceStatus
    configVersion?: bigint
    areaIds?: string[]
    provisionedAt?: Date | null
  }): FakeDevice {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const device: FakeDevice = {
      id: input.id ?? this.nextId(),
      deviceCode: input.deviceCode,
      name: input.name ?? input.deviceCode,
      location: null,
      status: input.status ?? 'active',
      hardwareModel: null,
      firmwareVersion: null,
      configVersion: input.configVersion ?? 0n,
      lastSeenAt: null,
      provisionedAt: input.provisionedAt ?? null,
      createdAt: now,
      updatedAt: now,
      areaIds: input.areaIds ?? [],
    }

    this.devices.push(device)
    this.syncStates.push({
      deviceId: device.id,
      configVersion: device.configVersion,
      lastSyncRequestedAt: null,
      lastSyncCompletedAt: null,
      lastEventReceivedAt: null,
      lastEventOccurredAt: null,
      pendingEventCountReported: null,
      lastErrorCode: null,
      lastErrorAt: null,
      updatedAt: now,
    })

    return device
  }

  issueDeviceToken(deviceId: string): {
    credential: FakeDeviceCredential
    token: string
  } {
    const generated = generateDeviceToken()
    const credential: FakeDeviceCredential = {
      id: this.nextId(),
      deviceId,
      tokenId: generated.tokenId,
      secretHash: generated.secretHash,
      createdAt: new Date(),
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
    }

    this.deviceCredentials.push(credential)
    return { credential, token: generated.token }
  }

  addEvent(input: {
    deviceId: string
    clientEventId: string
    cardUid: string
    areaId: string
    decision: FakeAccessDecision
    reasonCode: string
    occurredAt: Date
    employeeId?: string | null
    credentialId?: string | null
    deviceSequence?: bigint | null
  }): FakeAccessEvent {
    const event: FakeAccessEvent = {
      id: this.nextId(),
      deviceId: input.deviceId,
      clientEventId: input.clientEventId,
      deviceEpoch: null,
      cardUid: input.cardUid,
      employeeId: input.employeeId ?? null,
      credentialId: input.credentialId ?? null,
      areaId: input.areaId,
      decision: input.decision,
      reasonCode: input.reasonCode,
      occurredAt: input.occurredAt,
      receivedAt: new Date('2026-01-01T00:05:00.000Z'),
      deviceSequence: input.deviceSequence ?? null,
      metadata: null,
      createdAt: new Date('2026-01-01T00:05:00.000Z'),
    }

    this.events.push(event)
    return event
  }
}

function createTestApp(): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/access-devices', accessDevicesRouter)
  app.use('/api/v1/devices', deviceSyncRouter)
  app.use('/api/v1/access-events', accessEventsRouter)
  app.use('/api/v1/me/access-events', myAccessEventsRouter)
  app.use(errorHandler)

  return app
}

const app = createTestApp()

const adminUser: AuthenticatedUser = {
  id: 'user-admin',
  authUserId: 'auth-user-admin',
  employeeId: null,
  email: 'admin@example.com',
  status: 'active',
  roles: ['admin'],
}

const employeeAUser: AuthenticatedUser = {
  id: 'user-a',
  authUserId: 'auth-user-a',
  employeeId: EMPLOYEE_A_ID,
  email: 'employee-a@example.com',
  status: 'active',
  roles: ['operator'],
}

const auditorUser: AuthenticatedUser = {
  id: 'user-auditor',
  authUserId: 'auth-user-auditor',
  employeeId: null,
  email: 'auditor@example.com',
  status: 'active',
  roles: ['auditor'],
}

const employeeBUser: AuthenticatedUser = {
  id: 'user-b',
  authUserId: 'auth-user-b',
  employeeId: EMPLOYEE_B_ID,
  email: 'employee-b@example.com',
  status: 'active',
  roles: [],
}

let db: InMemoryPrisma

beforeEach(() => {
  db = new InMemoryPrisma()
  prismaHolder.current = db

  setAuthTokenResolver(async (token) => {
    if (token === 'admin-token') {
      return adminUser
    }
    if (token === 'employee-a-token') {
      return employeeAUser
    }
    if (token === 'auditor-token') {
      return auditorUser
    }
    if (token === 'employee-b-token') {
      return employeeBUser
    }

    return null
  })

  setDeviceAuthResolver(
    async (token, _deviceIdentifier): Promise<AuthenticatedDevice | null> => {
      const separatorIndex = token.indexOf('.')
      if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
        return null
      }

      const tokenId = token.slice(0, separatorIndex)
      const secret = token.slice(separatorIndex + 1)
      const credential = db.deviceCredentials.find(
        (item) => item.tokenId === tokenId,
      )

      if (!credential || credential.revokedAt !== null) {
        return null
      }
      if (
        credential.expiresAt !== null &&
        credential.expiresAt.getTime() <= Date.now()
      ) {
        return null
      }
      if (hashDeviceSecret(secret) !== credential.secretHash) {
        return null
      }

      const device = db.devices.find(
        (item) => item.id === credential.deviceId,
      )

      if (!device) {
        return null
      }

      credential.lastUsedAt = new Date()

      return {
        id: device.id,
        deviceCode: device.deviceCode,
        status: device.status,
        configVersion: device.configVersion,
        tokenId,
      }
    },
  )
})

afterEach(() => {
  setAuthTokenResolver(null)
  setDeviceAuthResolver(null)
})

describe('access device provisioning', () => {
  it('registers a device, creates its sync state and issues a token once', async () => {
    db.addArea({ id: AREA_LAB_ID, code: 'LAB', name: 'Laboratorio' })

    const created = await request(app)
      .post('/api/v1/access-devices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        deviceCode: 'ESP32-001',
        name: 'Entrada laboratorio',
        location: 'Edificio A',
        hardwareModel: 'ESP32-S3',
        firmwareVersion: '1.0.0',
        areaIds: [AREA_LAB_ID],
      })

    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      deviceCode: 'ESP32-001',
      name: 'Entrada laboratorio',
      status: 'active',
      configVersion: '0',
      lastSeenAt: null,
      provisionedAt: null,
      areaIds: [AREA_LAB_ID],
    })

    const deviceId = created.body.id as string

    const syncState = await request(app)
      .get(`/api/v1/access-devices/${deviceId}/sync-state`)
      .set('Authorization', 'Bearer admin-token')

    expect(syncState.status).toBe(200)
    expect(syncState.body).toMatchObject({
      deviceId,
      configVersion: '0',
      lastSyncRequestedAt: null,
      lastSyncCompletedAt: null,
    })

    const issued = await request(app)
      .post(`/api/v1/access-devices/${deviceId}/credentials`)
      .set('Authorization', 'Bearer admin-token')

    expect(issued.status).toBe(201)

    const token = issued.body.token as string
    const [tokenId, secret] = token.split('.')

    expect(tokenId).toBe(issued.body.tokenId)
    expect(tokenId).toMatch(/^devtok_[0-9a-f]{16}$/)
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(issued.body).not.toHaveProperty('secretHash')

    const storedCredential = db.deviceCredentials.find(
      (credential) => credential.tokenId === issued.body.tokenId,
    )

    expect(storedCredential?.secretHash).toBe(hashDeviceSecret(secret ?? ''))
    expect(storedCredential?.secretHash).not.toBe(secret)
    expect(db.devices.find((device) => device.id === deviceId)?.provisionedAt).toBeInstanceOf(
      Date,
    )

    const revoked = await request(app)
      .post(
        `/api/v1/access-devices/${deviceId}/credentials/${String(issued.body.id)}/revoke`,
      )
      .set('Authorization', 'Bearer admin-token')

    expect(revoked.status).toBe(204)
    expect(storedCredential?.revokedAt).toBeInstanceOf(Date)
  })

  it('replaces assigned areas and bumps the configuration version', async () => {
    db.addArea({ id: AREA_LAB_ID, code: 'LAB' })
    db.addArea({ id: AREA_MAIN_ID, code: 'MAIN' })

    const created = await request(app)
      .post('/api/v1/access-devices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        deviceCode: 'ESP32-002',
        name: 'Controlador',
        areaIds: [AREA_LAB_ID],
      })

    const deviceId = created.body.id as string

    const firstUpdate = await request(app)
      .patch(`/api/v1/access-devices/${deviceId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ areaIds: [AREA_MAIN_ID] })

    expect(firstUpdate.status).toBe(200)
    expect(firstUpdate.body).toMatchObject({
      configVersion: '1',
      areaIds: [AREA_MAIN_ID],
    })

    const cleared = await request(app)
      .patch(`/api/v1/access-devices/${deviceId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ areaIds: [] })

    expect(cleared.status).toBe(200)
    expect(cleared.body).toMatchObject({ configVersion: '2', areaIds: [] })

    const syncState = await request(app)
      .get(`/api/v1/access-devices/${deviceId}/sync-state`)
      .set('Authorization', 'Bearer admin-token')

    expect(syncState.body.configVersion).toBe('2')
  })

  it('lists, gets and updates device metadata without bumping configVersion when areaIds are unchanged', async () => {
    db.addArea({ id: AREA_LAB_ID, code: 'LAB' })
    const d1 = db.addDevice({
      deviceCode: 'ESP32-A',
      name: 'Dispositivo A',
      areaIds: [AREA_LAB_ID],
    })
    const d2 = db.addDevice({
      deviceCode: 'ESP32-B',
      name: 'Dispositivo B',
      areaIds: [],
    })

    const listRes = await request(app)
      .get('/api/v1/access-devices?page=1&pageSize=1')
      .set('Authorization', 'Bearer auditor-token')

    expect(listRes.status).toBe(200)
    expect(listRes.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    })
    expect(listRes.body.data).toHaveLength(1)

    const getRes = await request(app)
      .get(`/api/v1/access-devices/${d1.id}`)
      .set('Authorization', 'Bearer employee-a-token')

    expect(getRes.status).toBe(200)
    expect(getRes.body).toMatchObject({
      id: d1.id,
      deviceCode: 'ESP32-A',
      name: 'Dispositivo A',
      areaIds: [AREA_LAB_ID],
    })

    const patchRes = await request(app)
      .patch(`/api/v1/access-devices/${d1.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Dispositivo A Actualizado',
        location: 'Piso 2',
        hardwareModel: 'ESP32-S3-WROOM',
        firmwareVersion: '1.1.0',
        status: 'maintenance',
      })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body).toMatchObject({
      id: d1.id,
      name: 'Dispositivo A Actualizado',
      location: 'Piso 2',
      hardwareModel: 'ESP32-S3-WROOM',
      firmwareVersion: '1.1.0',
      status: 'maintenance',
      configVersion: '0',
      areaIds: [AREA_LAB_ID],
    })

    const emptyPatch = await request(app)
      .patch(`/api/v1/access-devices/${d2.id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({})

    expect(emptyPatch.status).toBe(400)
    expect(emptyPatch.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('enforces RBAC, validates area existence, rejects duplicate device codes and supports credential rotation', async () => {
    db.addArea({ id: AREA_LAB_ID, code: 'LAB' })

    const operatorCreate = await request(app)
      .post('/api/v1/access-devices')
      .set('Authorization', 'Bearer employee-a-token')
      .send({ deviceCode: 'ESP32-OP', name: 'No permitido' })

    expect(operatorCreate.status).toBe(403)
    expect(operatorCreate.body).toMatchObject({ error: { code: 'FORBIDDEN' } })

    const missingAreaCreate = await request(app)
      .post('/api/v1/access-devices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        deviceCode: 'ESP32-BAD-AREA',
        name: 'Area inexistente',
        areaIds: [AREA_MAIN_ID],
      })

    expect(missingAreaCreate.status).toBe(400)
    expect(missingAreaCreate.body).toMatchObject({
      error: { code: 'BAD_REQUEST', message: 'One or more areas do not exist' },
    })

    const created = await request(app)
      .post('/api/v1/access-devices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        deviceCode: 'ESP32-ROTATE',
        name: 'Controlador rotacion',
        areaIds: [AREA_LAB_ID],
      })

    expect(created.status).toBe(201)
    const deviceId = created.body.id as string

    const duplicateCreate = await request(app)
      .post('/api/v1/access-devices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        deviceCode: 'ESP32-ROTATE',
        name: 'Duplicado',
      })

    expect(duplicateCreate.status).toBe(409)
    expect(duplicateCreate.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'Device code already exists' },
    })

    // Issue first credential
    const cred1 = await request(app)
      .post(`/api/v1/access-devices/${deviceId}/credentials`)
      .set('Authorization', 'Bearer admin-token')
    expect(cred1.status).toBe(201)

    // Rotate: issue second credential and revoke the first one
    const cred2 = await request(app)
      .post(`/api/v1/access-devices/${deviceId}/credentials`)
      .set('Authorization', 'Bearer admin-token')
    expect(cred2.status).toBe(201)
    expect(cred2.body.tokenId).not.toBe(cred1.body.tokenId)

    const revoke1 = await request(app)
      .post(
        `/api/v1/access-devices/${deviceId}/credentials/${String(cred1.body.id)}/revoke`,
      )
      .set('Authorization', 'Bearer admin-token')
    expect(revoke1.status).toBe(204)

    // Idempotent second revoke
    const revoke1Again = await request(app)
      .post(
        `/api/v1/access-devices/${deviceId}/credentials/${String(cred1.body.id)}/revoke`,
      )
      .set('Authorization', 'Bearer admin-token')
    expect(revoke1Again.status).toBe(204)

    // Old token is rejected with 401
    const syncWithOld = await request(app)
      .get(`/api/v1/devices/${deviceId}/sync`)
      .set('Authorization', `Bearer ${String(cred1.body.token)}`)
    expect(syncWithOld.status).toBe(401)

    // New rotated token works with 200
    const syncWithNew = await request(app)
      .get(`/api/v1/devices/${deviceId}/sync`)
      .set('Authorization', `Bearer ${String(cred2.body.token)}`)
    expect(syncWithNew.status).toBe(200)
  })
})

describe('device synchronization', () => {
  function seedSyncFixture(): { device: FakeDevice; token: string } {
    db.addArea({
      id: AREA_LAB_ID,
      code: 'LAB',
      name: 'Laboratorio',
      timezone: 'America/Tijuana',
    })
    db.addEmployee({
      id: EMPLOYEE_A_ID,
      employeeCode: 'E-0001',
      firstName: 'Ana',
      lastName: 'Lopez',
    })
    db.addCredential({ employeeId: EMPLOYEE_A_ID, cardUid: KNOWN_CARD_UID })
    db.addPermission({ employeeId: EMPLOYEE_A_ID, areaId: AREA_LAB_ID })

    const device = db.addDevice({
      id: DEVICE_ID,
      deviceCode: 'ESP32-001',
      name: 'Entrada laboratorio',
      configVersion: 5n,
      areaIds: [AREA_LAB_ID],
    })
    const { token } = db.issueDeviceToken(device.id)

    return { device, token }
  }

  it('returns the offline payload with an ETag and 304 for a known version', async () => {
    const { device, token } = seedSyncFixture()

    const first = await request(app)
      .get(`/api/v1/devices/${device.id}/sync`)
      .set('Authorization', `Bearer ${token}`)

    expect(first.status).toBe(200)
    expect(first.headers.etag).toBe('"5"')
    expect(first.body).toMatchObject({
      deviceId: device.id,
      syncVersion: '5',
      areas: [
        {
          id: AREA_LAB_ID,
          code: 'LAB',
          name: 'Laboratorio',
          timezone: 'America/Tijuana',
        },
      ],
      employees: [
        {
          id: EMPLOYEE_A_ID,
          employeeCode: 'E-0001',
          firstName: 'Ana',
          lastName: 'Lopez',
          status: 'active',
        },
      ],
      credentials: [
        {
          employeeId: EMPLOYEE_A_ID,
          cardUid: KNOWN_CARD_UID,
          status: 'active',
        },
      ],
      permissions: [
        {
          employeeId: EMPLOYEE_A_ID,
          areaId: AREA_LAB_ID,
          validFrom: null,
          validTo: null,
          schedule: null,
        },
      ],
      config: { configVersion: '5', timezone: 'America/Tijuana' },
    })
    expect(first.body.checksum).toMatch(/^[0-9a-f]{64}$/)

    const stateAfterFirst = db.syncStates.find(
      (state) => state.deviceId === device.id,
    )

    expect(stateAfterFirst?.configVersion).toBe(5n)
    expect(stateAfterFirst?.lastSyncRequestedAt).toBeInstanceOf(Date)
    expect(stateAfterFirst?.lastSyncCompletedAt).toBeInstanceOf(Date)

    const second = await request(app)
      .get(`/api/v1/devices/${device.id}/sync`)
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', `"${String(first.body.syncVersion)}"`)

    expect(second.status).toBe(304)
    expect(second.text).toBe('')
    expect(db.devices.find((item) => item.id === device.id)?.lastSeenAt).toBeInstanceOf(
      Date,
    )
  })

  it('excludes inactive areas, inactive employees and revoked permissions from offline config', async () => {
    const { device, token } = seedSyncFixture()
    const inactiveArea = db.addArea({
      id: AREA_MAIN_ID,
      code: 'MAIN',
      name: 'Area Inactiva',
      isActive: false,
    })
    device.areaIds.push(inactiveArea.id)

    const inactiveEmp = db.addEmployee({
      id: EMPLOYEE_B_ID,
      employeeCode: 'E-0002',
      firstName: 'Luis',
      lastName: 'Inactivo',
      status: 'inactive',
    })
    db.addCredential({ employeeId: inactiveEmp.id, cardUid: '11223344' })
    db.addPermission({ employeeId: inactiveEmp.id, areaId: AREA_LAB_ID })

    const activeEmpRevokedPerm = db.addEmployee({
      employeeCode: 'E-0003',
      firstName: 'Marta',
      lastName: 'Revocada',
      status: 'active',
    })
    db.addCredential({ employeeId: activeEmpRevokedPerm.id, cardUid: '55667788' })
    db.addPermission({
      employeeId: activeEmpRevokedPerm.id,
      areaId: AREA_LAB_ID,
      revokedAt: new Date('2026-01-01T01:00:00.000Z'),
    })

    const res = await request(app)
      .get(`/api/v1/devices/${device.deviceCode}/sync`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.areas).toHaveLength(1)
    expect(res.body.areas[0].id).toBe(AREA_LAB_ID)
    expect(res.body.employees).toHaveLength(1)
    expect(res.body.employees[0].id).toBe(EMPLOYEE_A_ID)
    expect(res.body.credentials).toHaveLength(1)
    expect(res.body.credentials[0].cardUid).toBe(KNOWN_CARD_UID)
    expect(res.body.permissions).toHaveLength(1)
    expect(res.body.permissions[0].employeeId).toBe(EMPLOYEE_A_ID)
  })

  it('rejects inactive or maintenance devices and mismatched device tokens with 403', async () => {
    const { device, token } = seedSyncFixture()
    const otherDevice = db.addDevice({
      deviceCode: 'ESP32-OTHER',
      name: 'Otro dispositivo',
      status: 'active',
    })

    // Mismatched device identifier -> 403
    const mismatchRes = await request(app)
      .get(`/api/v1/devices/${otherDevice.id}/sync`)
      .set('Authorization', `Bearer ${token}`)

    expect(mismatchRes.status).toBe(403)
    expect(mismatchRes.body).toMatchObject({
      error: {
        code: 'FORBIDDEN',
        message: 'Device token does not match requested device',
      },
    })

    // Maintenance status -> 403
    device.status = 'maintenance'
    const maintenanceRes = await request(app)
      .get(`/api/v1/devices/${device.id}/sync`)
      .set('Authorization', `Bearer ${token}`)

    expect(maintenanceRes.status).toBe(403)
    expect(maintenanceRes.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Device is not active' },
    })

    // Inactive status on event upload -> 403
    device.status = 'inactive'
    const inactiveEventRes = await request(app)
      .post(`/api/v1/devices/${device.id}/events/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId: device.id,
        events: [
          {
            clientEventId: 'evt-1',
            cardUid: KNOWN_CARD_UID,
            deviceId: device.id,
            areaId: AREA_LAB_ID,
            occurredAt: '2026-01-01T10:00:00.000Z',
            decision: 'granted',
            reasonCode: 'allowed',
          },
        ],
      })

    expect(inactiveEventRes.status).toBe(403)
    expect(inactiveEventRes.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Device is not active' },
    })
  })

  it('accepts known events, preserves unknown denied cards and rejects incoherent items', async () => {
    const { device, token } = seedSyncFixture()
    const credential = db.credentials[0]

    expect(credential).toBeDefined()

    const events = [
      {
        clientEventId: 'evt-granted',
        cardUid: 'a1:b2:c3:d4',
        deviceId: device.id,
        areaId: AREA_LAB_ID,
        occurredAt: '2026-01-01T10:00:00.000Z',
        decision: 'granted',
        reasonCode: 'allowed',
        deviceSequence: '10',
        metadata: { rssi: -42 },
      },
      {
        clientEventId: 'evt-unknown-denied',
        cardUid: UNKNOWN_CARD_UID,
        deviceId: device.id,
        areaId: AREA_LAB_ID,
        occurredAt: '2026-01-01T10:01:00.000Z',
        decision: 'denied',
        reasonCode: 'card_unknown',
      },
      {
        clientEventId: 'evt-incoherent',
        cardUid: KNOWN_CARD_UID,
        deviceId: device.id,
        areaId: AREA_LAB_ID,
        occurredAt: '2026-01-01T10:02:00.000Z',
        decision: 'denied',
        reasonCode: 'allowed',
      },
      {
        clientEventId: 'evt-unknown-granted',
        cardUid: 'CAFEBABE',
        deviceId: device.id,
        areaId: AREA_LAB_ID,
        occurredAt: '2026-01-01T10:03:00.000Z',
        decision: 'granted',
        reasonCode: 'allowed',
      },
      {
        clientEventId: 'evt-bad-area',
        cardUid: KNOWN_CARD_UID,
        deviceId: device.id,
        areaId: AREA_MAIN_ID,
        occurredAt: '2026-01-01T10:04:00.000Z',
        decision: 'granted',
        reasonCode: 'allowed',
      },
    ]

    const response = await request(app)
      .post(`/api/v1/devices/${device.id}/events/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: device.id, events })

    expect(response.status).toBe(200)
    expect(response.body.accepted).toEqual(['evt-granted', 'evt-unknown-denied'])
    expect(response.body.duplicated).toEqual([])
    expect(response.body.rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientEventId: 'evt-incoherent',
          reasonCode: 'invalid_decision_reason',
        }),
        expect.objectContaining({
          clientEventId: 'evt-unknown-granted',
          reasonCode: 'card_unknown',
        }),
        expect.objectContaining({
          clientEventId: 'evt-bad-area',
          reasonCode: 'area_not_allowed',
        }),
      ]),
    )

    const grantedEvent = db.events.find(
      (event) => event.clientEventId === 'evt-granted',
    )
    const unknownEvent = db.events.find(
      (event) => event.clientEventId === 'evt-unknown-denied',
    )

    expect(grantedEvent).toMatchObject({
      cardUid: KNOWN_CARD_UID,
      employeeId: EMPLOYEE_A_ID,
      credentialId: credential?.id,
      deviceSequence: 10n,
      metadata: { rssi: -42 },
    })
    expect(grantedEvent?.occurredAt.toISOString()).toBe(
      '2026-01-01T10:00:00.000Z',
    )
    expect(grantedEvent?.receivedAt.getTime()).toBeGreaterThan(
      grantedEvent?.occurredAt.getTime() ?? 0,
    )

    expect(unknownEvent).toMatchObject({
      cardUid: UNKNOWN_CARD_UID,
      employeeId: null,
      credentialId: null,
    })
    expect(db.events).toHaveLength(2)

    const syncState = db.syncStates.find((state) => state.deviceId === device.id)
    expect(syncState?.lastEventReceivedAt).toBeInstanceOf(Date)
    expect(syncState?.lastEventOccurredAt?.toISOString()).toBe(
      '2026-01-01T10:01:00.000Z',
    )

    const retry = await request(app)
      .post(`/api/v1/devices/${device.id}/events/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceId: device.id, events })

    expect(retry.status).toBe(200)
    expect(retry.body.accepted).toEqual([])
    expect(retry.body.duplicated).toEqual(
      expect.arrayContaining(['evt-granted', 'evt-unknown-denied']),
    )
    expect(retry.body.rejected).toHaveLength(3)
    expect(db.events).toHaveLength(2)
  })
})

describe('access event history', () => {
  function seedHistoryFixture(): {
    device: FakeDevice
    employeeAEvent: FakeAccessEvent
    employeeBEvent: FakeAccessEvent
    unknownCardEvent: FakeAccessEvent
  } {
    const areaMain = db.addArea({
      id: AREA_MAIN_ID,
      code: 'MAIN',
      name: 'Acceso principal',
    })
    const areaLab = db.addArea({
      id: AREA_LAB_ID,
      code: 'LAB',
      name: 'Laboratorio',
    })
    const device = db.addDevice({
      id: DEVICE_ID,
      deviceCode: 'ESP32-MAIN',
      areaIds: [areaMain.id, areaLab.id],
    })

    const employeeAEvent = db.addEvent({
      deviceId: device.id,
      clientEventId: 'event-employee-a',
      cardUid: KNOWN_CARD_UID,
      areaId: areaMain.id,
      decision: 'granted',
      reasonCode: 'allowed',
      occurredAt: new Date('2026-01-02T10:00:00.000Z'),
      employeeId: EMPLOYEE_A_ID,
    })
    const employeeBEvent = db.addEvent({
      deviceId: device.id,
      clientEventId: 'event-employee-b',
      cardUid: '11223344',
      areaId: areaLab.id,
      decision: 'denied',
      reasonCode: 'permission_missing',
      occurredAt: new Date('2026-01-02T11:00:00.000Z'),
      employeeId: EMPLOYEE_B_ID,
    })
    const unknownCardEvent = db.addEvent({
      deviceId: device.id,
      clientEventId: 'event-unknown-card',
      cardUid: UNKNOWN_CARD_UID,
      areaId: areaMain.id,
      decision: 'denied',
      reasonCode: 'card_unknown',
      occurredAt: new Date('2026-01-02T12:00:00.000Z'),
      employeeId: null,
    })

    return { device, employeeAEvent, employeeBEvent, unknownCardEvent }
  }

  it('only returns the authenticated employee events and hides other employees', async () => {
    const { employeeAEvent, employeeBEvent, unknownCardEvent } = seedHistoryFixture()

    const list = await request(app)
      .get(`/api/v1/me/access-events?employeeId=${EMPLOYEE_B_ID}`)
      .set('Authorization', 'Bearer employee-a-token')

    expect(list.status).toBe(200)
    expect(list.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 1 })
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0]).toMatchObject({
      id: employeeAEvent.id,
      employeeId: EMPLOYEE_A_ID,
    })

    const ownDetail = await request(app)
      .get(`/api/v1/me/access-events/${employeeAEvent.id}`)
      .set('Authorization', 'Bearer employee-a-token')

    expect(ownDetail.status).toBe(200)
    expect(ownDetail.body.id).toBe(employeeAEvent.id)

    const otherDetail = await request(app)
      .get(`/api/v1/me/access-events/${employeeBEvent.id}`)
      .set('Authorization', 'Bearer employee-a-token')

    expect(otherDetail.status).toBe(404)
    expect(otherDetail.body).toMatchObject({ error: { code: 'NOT_FOUND' } })

    const unknownCardDetail = await request(app)
      .get(`/api/v1/me/access-events/${unknownCardEvent.id}`)
      .set('Authorization', 'Bearer employee-a-token')

    expect(unknownCardDetail.status).toBe(404)

    // Non-employee account (admin without employeeId) is forbidden from /me/access-events
    const adminMeList = await request(app)
      .get('/api/v1/me/access-events')
      .set('Authorization', 'Bearer admin-token')

    expect(adminMeList.status).toBe(403)
    expect(adminMeList.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Employee account required' },
    })
  })

  it('lets auditors filter the global history by all criteria and keeps it read-only', async () => {
    const { device, employeeAEvent, employeeBEvent, unknownCardEvent } =
      seedHistoryFixture()

    const filteredByEmployee = await request(app)
      .get(`/api/v1/access-events?employeeId=${EMPLOYEE_B_ID}`)
      .set('Authorization', 'Bearer auditor-token')

    expect(filteredByEmployee.status).toBe(200)
    expect(filteredByEmployee.body.pagination.total).toBe(1)
    expect(filteredByEmployee.body.data[0].id).toBe(employeeBEvent.id)

    const filteredByDateAndDecision = await request(app)
      .get(
        `/api/v1/access-events?decision=denied&areaId=${AREA_MAIN_ID}&deviceId=${device.id}&from=2026-01-02T11:30:00.000Z&to=2026-01-02T12:30:00.000Z`,
      )
      .set('Authorization', 'Bearer auditor-token')

    expect(filteredByDateAndDecision.status).toBe(200)
    expect(filteredByDateAndDecision.body.data).toHaveLength(1)
    expect(filteredByDateAndDecision.body.data[0]).toMatchObject({
      id: unknownCardEvent.id,
      employeeId: null,
      reasonCode: 'card_unknown',
    })

    const filteredByNormalizedCard = await request(app)
      .get('/api/v1/access-events?cardUid=a1:b2:c3:d4')
      .set('Authorization', 'Bearer auditor-token')

    expect(filteredByNormalizedCard.status).toBe(200)
    expect(filteredByNormalizedCard.body.data).toHaveLength(1)
    expect(filteredByNormalizedCard.body.data[0].id).toBe(employeeAEvent.id)

    const invalidDateRange = await request(app)
      .get(
        '/api/v1/access-events?from=2026-01-03T00:00:00.000Z&to=2026-01-02T00:00:00.000Z',
      )
      .set('Authorization', 'Bearer auditor-token')

    expect(invalidDateRange.status).toBe(400)
    expect(invalidDateRange.body).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'from must be earlier than or equal to to',
      },
    })

    const detail = await request(app)
      .get(`/api/v1/access-events/${employeeBEvent.id}`)
      .set('Authorization', 'Bearer auditor-token')

    expect(detail.status).toBe(200)

    const deletion = await request(app)
      .delete(`/api/v1/access-events/${employeeBEvent.id}`)
      .set('Authorization', 'Bearer admin-token')

    expect(deletion.status).toBe(404)
  })
})
