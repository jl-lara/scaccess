import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import {
  setAuthTokenResolver,
  type AuthenticatedUser,
} from '../src/middleware/auth.js'
import {
  hashDeviceSecret,
  setDeviceAuthResolver,
  type AuthenticatedDevice,
} from '../src/middleware/deviceAuth.js'

const prismaHolder = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('../src/config/prisma.js', () => ({
  getPrismaClient: () => prismaHolder.current,
  disconnectPrisma: async () => undefined,
}))

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

class InMemoryE2EPrisma {
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

  private withDeviceRelations(device: FakeDevice) {
    const syncState =
      this.syncStates.find((item) => item.deviceId === device.id) ?? null
    return {
      ...device,
      deviceAreas: device.areaIds.map((areaId) => ({ areaId })),
      syncState: syncState ? { ...syncState } : null,
    }
  }

  readonly area = {
    findMany: async (
      args: {
        where?: { id?: { in?: string[] }; isActive?: boolean }
        skip?: number
        take?: number
      } = {},
    ) => {
      let result = [...this.areas]
      if (args.where?.id?.in !== undefined) {
        const ids = args.where.id.in
        result = result.filter((item) => ids.includes(item.id))
      }
      if (args.where?.isActive !== undefined) {
        result = result.filter((item) => item.isActive === args.where?.isActive)
      }
      result.sort((a, b) => a.code.localeCompare(b.code))
      const start = args.skip ?? 0
      const end = args.take === undefined ? undefined : start + args.take
      return result.slice(start, end)
    },
    count: async (args: { where?: { isActive?: boolean } } = {}) => {
      return this.areas.filter(
        (item) =>
          args.where?.isActive === undefined ||
          item.isActive === args.where.isActive,
      ).length
    },
    findUnique: async (args: { where: { id?: string; code?: string } }) => {
      if (args.where.id !== undefined) {
        return this.areas.find((item) => item.id === args.where.id) ?? null
      }
      if (args.where.code !== undefined) {
        return this.areas.find((item) => item.code === args.where.code) ?? null
      }
      return null
    },
    create: async (args: {
      data: {
        code: string
        name: string
        description?: string | null
        isActive?: boolean
        timezone?: string
      }
    }) => {
      const now = new Date()
      const area: FakeArea = {
        id: this.nextId(),
        code: args.data.code,
        name: args.data.name,
        description: args.data.description ?? null,
        isActive: args.data.isActive ?? true,
        timezone: args.data.timezone ?? 'America/Tijuana',
        createdAt: now,
        updatedAt: now,
      }
      this.areas.push(area)
      return area
    },
    update: async (args: {
      where: { id: string }
      data: Partial<FakeArea>
    }) => {
      const area = this.areas.find((item) => item.id === args.where.id)
      if (!area) {
        throw new Error('Area not found')
      }
      Object.assign(area, args.data, { updatedAt: new Date() })
      return area
    },
  }

  readonly employee = {
    findMany: async (
      args: {
        where?: { status?: FakeEmployeeStatus }
        skip?: number
        take?: number
      } = {},
    ) => {
      let result = [...this.employees]
      if (args.where?.status !== undefined) {
        result = result.filter((item) => item.status === args.where?.status)
      }
      result.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))
      const start = args.skip ?? 0
      const end = args.take === undefined ? undefined : start + args.take
      return result.slice(start, end)
    },
    count: async (args: { where?: { status?: FakeEmployeeStatus } } = {}) => {
      return this.employees.filter(
        (item) =>
          args.where?.status === undefined || item.status === args.where.status,
      ).length
    },
    findUnique: async (args: {
      where: { id?: string; employeeCode?: string; email?: string }
    }) => {
      if (args.where.id !== undefined) {
        return this.employees.find((item) => item.id === args.where.id) ?? null
      }
      if (args.where.employeeCode !== undefined) {
        return (
          this.employees.find(
            (item) => item.employeeCode === args.where.employeeCode,
          ) ?? null
        )
      }
      if (args.where.email !== undefined) {
        return (
          this.employees.find((item) => item.email === args.where.email) ?? null
        )
      }
      return null
    },
    create: async (args: {
      data: {
        employeeCode: string
        firstName: string
        lastName: string
        email?: string | null
        department?: string | null
        position?: string | null
        status?: FakeEmployeeStatus
        hiredAt?: Date | null
      }
    }) => {
      const now = new Date()
      const employee: FakeEmployee = {
        id: this.nextId(),
        employeeCode: args.data.employeeCode,
        firstName: args.data.firstName,
        lastName: args.data.lastName,
        email: args.data.email ?? null,
        department: args.data.department ?? null,
        position: args.data.position ?? null,
        status: args.data.status ?? 'active',
        hiredAt: args.data.hiredAt ?? null,
        deactivatedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      this.employees.push(employee)
      return employee
    },
    update: async (args: {
      where: { id: string }
      data: Partial<FakeEmployee>
    }) => {
      const employee = this.employees.find((item) => item.id === args.where.id)
      if (!employee) {
        throw new Error('Employee not found')
      }
      Object.assign(employee, args.data, { updatedAt: new Date() })
      return employee
    },
  }

  readonly credential = {
    findMany: async (
      args: {
        where?: {
          employeeId?: string
          status?: FakeCredentialStatus
          cardUid?: string
        }
        skip?: number
        take?: number
      } = {},
    ) => {
      let result = [...this.credentials]
      if (args.where?.employeeId !== undefined) {
        result = result.filter(
          (item) => item.employeeId === args.where?.employeeId,
        )
      }
      if (args.where?.status !== undefined) {
        result = result.filter((item) => item.status === args.where?.status)
      }
      if (args.where?.cardUid !== undefined) {
        result = result.filter((item) => item.cardUid === args.where?.cardUid)
      }
      const start = args.skip ?? 0
      const end = args.take === undefined ? undefined : start + args.take
      return result.slice(start, end)
    },
    count: async (
      args: {
        where?: {
          employeeId?: string
          status?: FakeCredentialStatus | { in?: FakeCredentialStatus[] }
          cardUid?: string
        }
      } = {},
    ) => {
      return this.credentials.filter((item) => {
        if (
          args.where?.employeeId !== undefined &&
          item.employeeId !== args.where.employeeId
        ) {
          return false
        }
        if (
          args.where?.cardUid !== undefined &&
          item.cardUid !== args.where.cardUid
        ) {
          return false
        }
        if (typeof args.where?.status === 'string') {
          return item.status === args.where.status
        }
        if (args.where?.status?.in !== undefined) {
          return args.where.status.in.includes(item.status)
        }
        return true
      }).length
    },
    findUnique: async (args: { where: { id?: string; cardUid?: string } }) => {
      if (args.where.id !== undefined) {
        return (
          this.credentials.find((item) => item.id === args.where.id) ?? null
        )
      }
      if (args.where.cardUid !== undefined) {
        return (
          this.credentials.find(
            (item) => item.cardUid === args.where.cardUid,
          ) ?? null
        )
      }
      return null
    },
    create: async (args: {
      data: {
        employeeId: string
        cardUid: string
        label?: string | null
        status?: FakeCredentialStatus
        issuedAt?: Date | null
      }
    }) => {
      const now = new Date()
      const credential: FakeCredential = {
        id: this.nextId(),
        employeeId: args.data.employeeId,
        cardUid: args.data.cardUid,
        label: args.data.label ?? null,
        status: args.data.status ?? 'active',
        issuedAt: args.data.issuedAt ?? now,
        deactivatedAt: null,
        deactivationReason: null,
        createdAt: now,
        updatedAt: now,
      }
      this.credentials.push(credential)
      return credential
    },
    update: async (args: {
      where: { id: string }
      data: Partial<FakeCredential>
    }) => {
      const credential = this.credentials.find(
        (item) => item.id === args.where.id,
      )
      if (!credential) {
        throw new Error('Credential not found')
      }
      Object.assign(credential, args.data, { updatedAt: new Date() })
      return credential
    },
  }

  readonly accessPermission = {
    findMany: async (
      args: {
        where?: {
          employeeId?: string
          areaId?: string | { in?: string[] }
          revokedAt?: Date | null
        }
        include?: { employee?: { include?: { credentials?: boolean } } }
        skip?: number
        take?: number
      } = {},
    ) => {
      let result = [...this.permissions]
      if (args.where?.employeeId !== undefined) {
        result = result.filter(
          (item) => item.employeeId === args.where?.employeeId,
        )
      }
      if (typeof args.where?.areaId === 'string') {
        result = result.filter((item) => item.areaId === args.where?.areaId)
      } else if (args.where?.areaId?.in !== undefined) {
        const areaIds = args.where.areaId.in
        result = result.filter((item) => areaIds.includes(item.areaId))
      }
      if (args.where?.revokedAt !== undefined) {
        result = result.filter(
          (item) => item.revokedAt === args.where?.revokedAt,
        )
      }

      const start = args.skip ?? 0
      const end = args.take === undefined ? undefined : start + args.take
      const sliced = result.slice(start, end)

      if (args.include?.employee) {
        return sliced.map((permission) => {
          const employee = this.employees.find(
            (item) => item.id === permission.employeeId,
          )
          return {
            ...permission,
            employee: employee
              ? {
                  ...employee,
                  credentials: this.credentials.filter(
                    (cred) => cred.employeeId === employee.id,
                  ),
                }
              : null,
          }
        })
      }

      return sliced
    },
    count: async (
      args: {
        where?: {
          employeeId?: string
          areaId?: string
          revokedAt?: Date | null
        }
      } = {},
    ) => {
      return this.permissions.filter((item) => {
        if (
          args.where?.employeeId !== undefined &&
          item.employeeId !== args.where.employeeId
        ) {
          return false
        }
        if (
          args.where?.areaId !== undefined &&
          item.areaId !== args.where.areaId
        ) {
          return false
        }
        if (
          args.where?.revokedAt !== undefined &&
          item.revokedAt !== args.where.revokedAt
        ) {
          return false
        }
        return true
      }).length
    },
    findUnique: async (args: { where: { id: string } }) =>
      this.permissions.find((item) => item.id === args.where.id) ?? null,
    findFirst: async (args: {
      where: { employeeId: string; areaId: string; revokedAt: null }
    }) =>
      this.permissions.find(
        (item) =>
          item.employeeId === args.where.employeeId &&
          item.areaId === args.where.areaId &&
          item.revokedAt === null,
      ) ?? null,
    create: async (args: {
      data: {
        employeeId: string
        areaId: string
        validFrom?: Date | null
        validTo?: Date | null
        schedule?: unknown
        grantedById?: string | null
      }
    }) => {
      const now = new Date()
      const permission: FakePermission = {
        id: this.nextId(),
        employeeId: args.data.employeeId,
        areaId: args.data.areaId,
        validFrom: args.data.validFrom ?? null,
        validTo: args.data.validTo ?? null,
        schedule: args.data.schedule ?? null,
        revokedAt: null,
        grantedById: args.data.grantedById ?? null,
        createdAt: now,
        updatedAt: now,
      }
      this.permissions.push(permission)
      return permission
    },
    update: async (args: {
      where: { id: string }
      data: { revokedAt?: Date | null }
    }) => {
      const permission = this.permissions.find(
        (item) => item.id === args.where.id,
      )
      if (!permission) {
        throw new Error('Permission not found')
      }
      if (args.data.revokedAt !== undefined) {
        permission.revokedAt = args.data.revokedAt
      }
      permission.updatedAt = new Date()
      return permission
    },
  }

  readonly accessDevice = {
    findMany: async (
      args: {
        where?: { status?: FakeDeviceStatus }
        skip?: number
        take?: number
      } = {},
    ) => {
      let filtered = [...this.devices]
      if (args.where?.status !== undefined) {
        filtered = filtered.filter(
          (device) => device.status === args.where?.status,
        )
      }
      filtered.sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      const start = args.skip ?? 0
      const end = args.take === undefined ? undefined : start + args.take

      return filtered
        .slice(start, end)
        .map((device) => this.withDeviceRelations(device))
    },
    count: async (args: { where?: { status?: FakeDeviceStatus } } = {}) =>
      this.devices.filter(
        (device) =>
          args.where?.status === undefined ||
          device.status === args.where.status,
      ).length,
    findUnique: async (args: {
      where: { id?: string; deviceCode?: string }
    }) => {
      const device =
        args.where.id !== undefined
          ? this.devices.find((item) => item.id === args.where.id)
          : this.devices.find(
              (item) => item.deviceCode === args.where.deviceCode,
            )

      return device ? this.withDeviceRelations(device) : null
    },
    create: async (args: {
      data: {
        deviceCode: string
        name: string
        location?: string | null
        hardwareModel?: string | null
        firmwareVersion?: string | null
        status?: FakeDeviceStatus
        configVersion?: bigint
        deviceAreas?: { createMany?: { data?: Array<{ areaId: string }> } }
        syncState?: { create?: { configVersion?: bigint } }
      }
    }) => {
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

      return this.withDeviceRelations(device)
    },
    update: async (args: {
      where: { id: string }
      data: {
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
    }) => {
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
      return this.withDeviceRelations(device)
    },
    updateMany: async (args: {
      where?: {
        status?: FakeDeviceStatus
        deviceAreas?: { some?: { areaId?: { in?: string[] } } }
      }
      data: { configVersion?: { increment: bigint } }
    }) => {
      const filterAreaIds = args.where?.deviceAreas?.some?.areaId?.in
      let count = 0

      for (const device of this.devices) {
        if (
          args.where?.status !== undefined &&
          device.status !== args.where.status
        ) {
          continue
        }
        if (
          filterAreaIds !== undefined &&
          !device.areaIds.some((areaId) => filterAreaIds.includes(areaId))
        ) {
          continue
        }
        if (args.data.configVersion?.increment !== undefined) {
          device.configVersion += args.data.configVersion.increment
          device.updatedAt = new Date()
          count += 1
        }
      }

      return { count }
    },
  }

  readonly deviceArea = {
    findMany: async (args: { where: { deviceId: string } }) => {
      const device = this.devices.find(
        (item) => item.id === args.where.deviceId,
      )
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
      this.syncStates.find((state) => state.deviceId === args.where.deviceId) ??
      null,
    update: async (args: {
      where: { deviceId: string }
      data: {
        configVersion?: bigint
        lastSyncRequestedAt?: Date
        lastSyncCompletedAt?: Date
        lastEventReceivedAt?: Date
        lastEventOccurredAt?: Date
      }
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
          : this.deviceCredentials.find(
              (item) => item.tokenId === args.where.tokenId,
            )

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

  readonly accessEvent = {
    findMany: async (
      args: {
        where?: AccessEventWhere
        orderBy?: { occurredAt?: 'asc' | 'desc' }
        skip?: number
        take?: number
      } = {},
    ) => {
      const matching = this.events.filter((event) =>
        matchesAccessEvent(event, args.where),
      )
      const sorted =
        args.orderBy?.occurredAt === 'desc'
          ? [...matching].sort(
              (left, right) =>
                right.occurredAt.getTime() - left.occurredAt.getTime(),
            )
          : matching
      const start = args.skip ?? 0
      const end = args.take === undefined ? undefined : start + args.take

      return sorted.slice(start, end)
    },
    count: async (args: { where?: AccessEventWhere } = {}) =>
      this.events.filter((event) => matchesAccessEvent(event, args.where))
        .length,
    findUnique: async (args: { where: { id: string } }) =>
      this.events.find((event) => event.id === args.where.id) ?? null,
    create: async (args: {
      data: {
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
    }) => {
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
}

const app = createApp()

let db: InMemoryE2EPrisma
let employeeAId: string | null = null
let employeeBId: string | null = null

const ADMIN_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const AUDITOR_ID = 'aaaaaaaa-0000-4000-8000-000000000002'

beforeEach(() => {
  db = new InMemoryE2EPrisma()
  prismaHolder.current = db
  employeeAId = null
  employeeBId = null

  setAuthTokenResolver(async (token): Promise<AuthenticatedUser | null> => {
    if (token === 'admin-token') {
      return {
        id: ADMIN_ID,
        authUserId: 'auth-admin',
        employeeId: null,
        email: 'admin@utt.edu.mx',
        status: 'active',
        roles: ['admin'],
      }
    }
    if (token === 'auditor-token') {
      return {
        id: AUDITOR_ID,
        authUserId: 'auth-auditor',
        employeeId: null,
        email: 'auditor@utt.edu.mx',
        status: 'active',
        roles: ['auditor'],
      }
    }
    if (token === 'employee-a-token' && employeeAId !== null) {
      return {
        id: 'user-emp-a',
        authUserId: 'auth-emp-a',
        employeeId: employeeAId,
        email: 'ana.lopez@utt.edu.mx',
        status: 'active',
        roles: [],
      }
    }
    if (token === 'employee-b-token' && employeeBId !== null) {
      return {
        id: 'user-emp-b',
        authUserId: 'auth-emp-b',
        employeeId: employeeBId,
        email: 'carlos.ruiz@utt.edu.mx',
        status: 'active',
        roles: [],
      }
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

describe('End-to-end access control data flow', () => {
  it('completes the full lifecycle from provisioning and offline sync to event ingestion, history, mobile isolation and configVersion updates', async () => {
    // 1. Create Area
    const areaRes = await request(app)
      .post('/api/v1/areas')
      .set('Authorization', 'Bearer admin-token')
      .send({
        code: 'LAB-IOT',
        name: 'Laboratorio de IoT',
        description: 'Acceso controlado por ESP32-S3',
        timezone: 'America/Tijuana',
      })

    expect(areaRes.status).toBe(201)
    const areaId = areaRes.body.id as string

    // 2. Create Employees (Employee A with access, Employee B without permission to LAB-IOT)
    const empARes = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', 'Bearer admin-token')
      .send({
        employeeCode: 'UTT-001',
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'ana.lopez@utt.edu.mx',
        department: 'Ingenieria',
      })
    expect(empARes.status).toBe(201)
    employeeAId = empARes.body.id as string

    const empBRes = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', 'Bearer admin-token')
      .send({
        employeeCode: 'UTT-002',
        firstName: 'Carlos',
        lastName: 'Ruiz',
        email: 'carlos.ruiz@utt.edu.mx',
        department: 'Mantenimiento',
      })
    expect(empBRes.status).toBe(201)
    employeeBId = empBRes.body.id as string

    // 3. Register RFID Credentials for both employees
    const credARes = await request(app)
      .post('/api/v1/credentials')
      .set('Authorization', 'Bearer admin-token')
      .send({
        employeeId: employeeAId,
        cardUid: 'a1:b2:c3:d4',
        label: 'Tarjeta principal Ana',
      })
    expect(credARes.status).toBe(201)
    expect(credARes.body.cardUid).toBe('A1B2C3D4')
    const credentialAId = credARes.body.id as string

    const credBRes = await request(app)
      .post('/api/v1/credentials')
      .set('Authorization', 'Bearer admin-token')
      .send({
        employeeId: employeeBId,
        cardUid: '11-22-33-44',
        label: 'Tarjeta Carlos',
      })
    expect(credBRes.status).toBe(201)
    expect(credBRes.body.cardUid).toBe('11223344')
    const credentialBId = credBRes.body.id as string

    // 4. Grant Access Permission to Employee A for LAB-IOT
    const permARes = await request(app)
      .post('/api/v1/access-permissions')
      .set('Authorization', 'Bearer admin-token')
      .send({
        employeeId: employeeAId,
        areaId,
      })
    expect(permARes.status).toBe(201)
    expect(permARes.body).toMatchObject({
      employeeId: employeeAId,
      areaId,
      grantedById: ADMIN_ID,
      revokedAt: null,
    })
    const permissionAId = permARes.body.id as string

    // 5. Register Access Device and issue its device credential
    const deviceRes = await request(app)
      .post('/api/v1/access-devices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        deviceCode: 'ESP32-LAB-01',
        name: 'Lector Principal IoT',
        location: 'Puerta A1',
        hardwareModel: 'ESP32-S3',
        firmwareVersion: '1.0.0',
        areaIds: [areaId],
      })
    expect(deviceRes.status).toBe(201)
    const deviceId = deviceRes.body.id as string

    const deviceCredRes = await request(app)
      .post(`/api/v1/access-devices/${deviceId}/credentials`)
      .set('Authorization', 'Bearer admin-token')
    expect(deviceCredRes.status).toBe(201)
    const deviceToken = deviceCredRes.body.token as string
    const deviceCredentialId = deviceCredRes.body.id as string

    // 6. Download Offline Configuration (GET /api/v1/devices/:deviceId/sync)
    const syncConfig1 = await request(app)
      .get(`/api/v1/devices/${deviceId}/sync`)
      .set('Authorization', `Bearer ${deviceToken}`)

    expect(syncConfig1.status).toBe(200)
    expect(syncConfig1.headers.etag).toBe('"0"')
    expect(syncConfig1.body).toMatchObject({
      deviceId,
      syncVersion: '0',
      areas: [
        {
          id: areaId,
          code: 'LAB-IOT',
          name: 'Laboratorio de IoT',
          timezone: 'America/Tijuana',
        },
      ],
      employees: [
        {
          id: employeeAId,
          employeeCode: 'UTT-001',
          firstName: 'Ana',
          lastName: 'Lopez',
          status: 'active',
        },
      ],
      credentials: [
        {
          id: credentialAId,
          employeeId: employeeAId,
          cardUid: 'A1B2C3D4',
          status: 'active',
        },
      ],
      permissions: [
        {
          employeeId: employeeAId,
          areaId,
          validFrom: null,
          validTo: null,
          schedule: null,
        },
      ],
      config: {
        configVersion: '0',
        timezone: 'America/Tijuana',
      },
    })
    const initialChecksum = syncConfig1.body.checksum as string
    expect(initialChecksum).toMatch(/^[0-9a-f]{64}$/)

    // Verify 304 Not Modified when If-None-Match matches current configVersion
    const syncNotModified = await request(app)
      .get(`/api/v1/devices/${deviceId}/sync`)
      .set('Authorization', `Bearer ${deviceToken}`)
      .set('If-None-Match', '"0"')
    expect(syncNotModified.status).toBe(304)

    // 7. Upload Offline Event Batch (granted, denied known card, denied unknown card, duplicate in batch, rejected incoherent)
    const now = new Date()
    const t1 = new Date(now.getTime() - 180_000).toISOString()
    const t2 = new Date(now.getTime() - 120_000).toISOString()
    const t3 = new Date(now.getTime() - 60_000).toISOString()

    const batchEvents = [
      {
        clientEventId: 'esp32-evt-001',
        cardUid: 'A1B2C3D4',
        deviceId,
        areaId,
        occurredAt: t1,
        decision: 'granted',
        reasonCode: 'allowed',
        deviceSequence: '1',
      },
      {
        clientEventId: 'esp32-evt-002',
        cardUid: '11223344',
        deviceId,
        areaId,
        occurredAt: t2,
        decision: 'denied',
        reasonCode: 'permission_missing',
        deviceSequence: '2',
      },
      {
        clientEventId: 'esp32-evt-003',
        cardUid: 'DEADBEEF',
        deviceId,
        areaId,
        occurredAt: t3,
        decision: 'denied',
        reasonCode: 'card_unknown',
        deviceSequence: '3',
      },
      {
        // Duplicate within the same batch
        clientEventId: 'esp32-evt-001',
        cardUid: 'A1B2C3D4',
        deviceId,
        areaId,
        occurredAt: t1,
        decision: 'granted',
        reasonCode: 'allowed',
        deviceSequence: '1',
      },
      {
        // Incoherent: unknown card cannot be granted access
        clientEventId: 'esp32-evt-004',
        cardUid: 'CAFEBABE',
        deviceId,
        areaId,
        occurredAt: t3,
        decision: 'granted',
        reasonCode: 'allowed',
      },
    ]

    const upload1 = await request(app)
      .post(`/api/v1/devices/${deviceId}/events/sync`)
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({ deviceId, events: batchEvents })

    expect(upload1.status).toBe(200)
    expect(upload1.body.accepted).toEqual([
      'esp32-evt-001',
      'esp32-evt-002',
      'esp32-evt-003',
    ])
    expect(upload1.body.duplicated).toEqual(['esp32-evt-001'])
    expect(upload1.body.rejected).toEqual([
      expect.objectContaining({
        clientEventId: 'esp32-evt-004',
        reasonCode: 'card_unknown',
      }),
    ])

    // Re-uploading the exact same batch is idempotent and does not duplicate events
    const uploadRetry = await request(app)
      .post(`/api/v1/devices/${deviceId}/events/sync`)
      .set('Authorization', `Bearer ${deviceToken}`)
      .send({ deviceId, events: batchEvents.slice(0, 3) })

    expect(uploadRetry.status).toBe(200)
    expect(uploadRetry.body.accepted).toEqual([])
    expect(uploadRetry.body.duplicated).toEqual([
      'esp32-evt-001',
      'esp32-evt-002',
      'esp32-evt-003',
    ])
    expect(uploadRetry.body.rejected).toEqual([])

    // Verify sync state reflects lastEventReceivedAt and lastEventOccurredAt
    const syncStateRes = await request(app)
      .get(`/api/v1/access-devices/${deviceId}/sync-state`)
      .set('Authorization', 'Bearer admin-token')

    expect(syncStateRes.status).toBe(200)
    expect(syncStateRes.body.lastEventOccurredAt).toBe(t3)
    expect(typeof syncStateRes.body.lastEventReceivedAt).toBe('string')

    // 8. Query Admin History and Dashboard Summary
    const historyRes = await request(app)
      .get('/api/v1/access-events')
      .set('Authorization', 'Bearer auditor-token')

    expect(historyRes.status).toBe(200)
    expect(historyRes.body.pagination.total).toBe(3)
    // Ordered by occurredAt descending: evt-003 (t3), evt-002 (t2), evt-001 (t1)
    expect(
      historyRes.body.data.map((e: { clientEventId: string }) => e.clientEventId),
    ).toEqual(['esp32-evt-003', 'esp32-evt-002', 'esp32-evt-001'])

    const unknownEvt = historyRes.body.data[0]
    const empBEvt = historyRes.body.data[1]
    const empAEvt = historyRes.body.data[2]

    expect(unknownEvt).toMatchObject({
      clientEventId: 'esp32-evt-003',
      cardUid: 'DEADBEEF',
      employeeId: null,
      credentialId: null,
      decision: 'denied',
      reasonCode: 'card_unknown',
      occurredAt: t3,
    })
    expect(new Date(unknownEvt.receivedAt).getTime()).toBeGreaterThan(
      new Date(unknownEvt.occurredAt).getTime(),
    )

    expect(empBEvt).toMatchObject({
      clientEventId: 'esp32-evt-002',
      employeeId: employeeBId,
      credentialId: credentialBId,
      decision: 'denied',
      reasonCode: 'permission_missing',
    })

    expect(empAEvt).toMatchObject({
      clientEventId: 'esp32-evt-001',
      employeeId: employeeAId,
      credentialId: credentialAId,
      decision: 'granted',
      reasonCode: 'allowed',
    })

    const dashboard1 = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer auditor-token')

    expect(dashboard1.status).toBe(200)
    expect(dashboard1.body).toEqual({
      employees: { total: 2, active: 2 },
      credentials: { total: 2, active: 2, blockedOrLost: 0 },
      areas: { total: 1, active: 1 },
      devices: { total: 1, active: 1, outOfSync: 0 },
      recentEvents24h: { granted: 1, denied: 2 },
    })

    // 9. Mobile Personal History & Strict Isolation Between Employees
    const empAMeList = await request(app)
      .get(`/api/v1/me/access-events?employeeId=${employeeBId}`)
      .set('Authorization', 'Bearer employee-a-token')

    expect(empAMeList.status).toBe(200)
    expect(empAMeList.body.pagination.total).toBe(1)
    expect(empAMeList.body.data[0].id).toBe(empAEvt.id)

    const empAMeOwnDetail = await request(app)
      .get(`/api/v1/me/access-events/${String(empAEvt.id)}`)
      .set('Authorization', 'Bearer employee-a-token')
    expect(empAMeOwnDetail.status).toBe(200)

    const empAMeOtherDetail = await request(app)
      .get(`/api/v1/me/access-events/${String(empBEvt.id)}`)
      .set('Authorization', 'Bearer employee-a-token')
    expect(empAMeOtherDetail.status).toBe(404)

    const empAMeUnknownDetail = await request(app)
      .get(`/api/v1/me/access-events/${String(unknownEvt.id)}`)
      .set('Authorization', 'Bearer employee-a-token')
    expect(empAMeUnknownDetail.status).toBe(404)

    const empBMeList = await request(app)
      .get('/api/v1/me/access-events')
      .set('Authorization', 'Bearer employee-b-token')
    expect(empBMeList.status).toBe(200)
    expect(empBMeList.body.pagination.total).toBe(1)
    expect(empBMeList.body.data[0].id).toBe(empBEvt.id)

    // 10. Credential Revocation / Blocking & Permission Revocation -> configVersion Bump
    const blockCredRes = await request(app)
      .patch(`/api/v1/credentials/${credentialAId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'blocked',
        deactivationReason: 'Tarjeta reportada como extraviada',
      })
    expect(blockCredRes.status).toBe(200)
    expect(blockCredRes.body.status).toBe('blocked')
    expect(typeof blockCredRes.body.deactivatedAt).toBe('string')

    // Device should now have configVersion = '1' and be reported as outOfSync in dashboard
    const deviceAfterBlock = await request(app)
      .get(`/api/v1/access-devices/${deviceId}`)
      .set('Authorization', 'Bearer admin-token')
    expect(deviceAfterBlock.status).toBe(200)
    expect(deviceAfterBlock.body.configVersion).toBe('1')

    const dashboard2 = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', 'Bearer admin-token')
    expect(dashboard2.status).toBe(200)
    expect(dashboard2.body.credentials).toEqual({
      total: 2,
      active: 1,
      blockedOrLost: 1,
    })
    expect(dashboard2.body.devices.outOfSync).toBe(1)

    // Device syncs with old ETag "0" -> receives 200 OK with updated configVersion "1" and blocked credential status
    const syncAfterBlock = await request(app)
      .get(`/api/v1/devices/${deviceId}/sync`)
      .set('Authorization', `Bearer ${deviceToken}`)
      .set('If-None-Match', '"0"')

    expect(syncAfterBlock.status).toBe(200)
    expect(syncAfterBlock.headers.etag).toBe('"1"')
    expect(syncAfterBlock.body.syncVersion).toBe('1')
    expect(syncAfterBlock.body.config.configVersion).toBe('1')
    expect(syncAfterBlock.body.checksum).not.toBe(initialChecksum)
    expect(syncAfterBlock.body.credentials).toEqual([
      {
        id: credentialAId,
        employeeId: employeeAId,
        cardUid: 'A1B2C3D4',
        status: 'blocked',
      },
    ])

    // Revoke Employee A's permission -> bumps configVersion to "2" and removes employee from active permissions
    const revokePermRes = await request(app)
      .post(`/api/v1/access-permissions/${permissionAId}/revoke`)
      .set('Authorization', 'Bearer admin-token')
    expect(revokePermRes.status).toBe(200)
    expect(typeof revokePermRes.body.revokedAt).toBe('string')

    const syncAfterPermRevoke = await request(app)
      .get(`/api/v1/devices/${deviceId}/sync`)
      .set('Authorization', `Bearer ${deviceToken}`)
      .set('If-None-Match', '"1"')

    expect(syncAfterPermRevoke.status).toBe(200)
    expect(syncAfterPermRevoke.headers.etag).toBe('"2"')
    expect(syncAfterPermRevoke.body.syncVersion).toBe('2')
    expect(syncAfterPermRevoke.body.permissions).toEqual([])
    expect(syncAfterPermRevoke.body.employees).toEqual([])
    expect(syncAfterPermRevoke.body.credentials).toEqual([])

    // Rotate and revoke device credential
    const rotatedDeviceCred = await request(app)
      .post(`/api/v1/access-devices/${deviceId}/credentials`)
      .set('Authorization', 'Bearer admin-token')
    expect(rotatedDeviceCred.status).toBe(201)

    const revokeOldDeviceCred = await request(app)
      .post(
        `/api/v1/access-devices/${deviceId}/credentials/${deviceCredentialId}/revoke`,
      )
      .set('Authorization', 'Bearer admin-token')
    expect(revokeOldDeviceCred.status).toBe(204)

    const rejectedOldTokenSync = await request(app)
      .get(`/api/v1/devices/${deviceId}/sync`)
      .set('Authorization', `Bearer ${deviceToken}`)
    expect(rejectedOldTokenSync.status).toBe(401)

    const acceptedNewTokenSync = await request(app)
      .get(`/api/v1/devices/${deviceId}/sync`)
      .set('Authorization', `Bearer ${String(rotatedDeviceCred.body.token)}`)
      .set('If-None-Match', '"2"')
    expect(acceptedNewTokenSync.status).toBe(304)
  })
})
