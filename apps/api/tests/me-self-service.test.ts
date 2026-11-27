import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { setAuthTokenResolver, type AuthenticatedUser } from '../src/middleware/auth.js'

const prismaHolder = vi.hoisted(() => ({ current: undefined as unknown }))

vi.mock('../src/config/prisma.js', () => ({
  getPrismaClient: () => prismaHolder.current,
  disconnectPrisma: async () => {},
}))

// ---------------------------------------------------------------------------
// In-memory Prisma fake
// ---------------------------------------------------------------------------

type FakeAccountStatus = 'active' | 'disabled'
type FakeEmployeeStatus = 'active' | 'inactive' | 'suspended'
type FakeCredentialStatus = 'active' | 'blocked' | 'lost' | 'retired'
type FakeDeviceStatus = 'active' | 'inactive'

interface FakeRole {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

interface FakeUserAccount {
  id: string
  authUserId: string
  employeeId: string | null
  email: string
  status: FakeAccountStatus
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface FakeUserRole {
  userId: string
  roleId: string
  assignedAt: Date
  assignedById: string | null
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

interface FakeAccessPermission {
  id: string
  employeeId: string
  areaId: string
  validFrom: Date | null
  validTo: Date | null
  schedule: unknown | null
  revokedAt: Date | null
  grantedById: string | null
  createdAt: Date
  updatedAt: Date
}

interface FakeAccessDevice {
  id: string
  status: FakeDeviceStatus
  configVersion: bigint
}

interface UserQueryArgs {
  where?: { id?: string; authUserId?: string }
  include?: {
    userRoles?: { include?: { role?: boolean } }
  }
}

interface EmployeeQueryArgs {
  where?: { id?: string }
}

interface CredentialQueryArgs {
  where?: { employeeId?: string }
  orderBy?: { createdAt?: 'asc' | 'desc' }
}

interface CredentialFindUniqueArgs {
  where: { id?: string; cardUid?: string }
}

interface CredentialUpdateArgs {
  where: { id: string }
  data: {
    label?: string | null
    status?: FakeCredentialStatus
    deactivatedAt?: Date | null
    deactivationReason?: string | null
    updatedAt?: Date
  }
}

interface AccessPermissionQueryArgs {
  where?: { employeeId?: string; revokedAt?: null | Date }
  include?: { area?: boolean }
  orderBy?: { createdAt?: 'asc' | 'desc' }
}

interface AccessDeviceUpdateManyArgs {
  where?: { status?: FakeDeviceStatus }
  data: {
    configVersion?: bigint | { increment?: bigint | number }
  }
}

function createFakePrisma() {
  const db = {
    roles: [] as FakeRole[],
    users: [] as FakeUserAccount[],
    userRoles: [] as FakeUserRole[],
    employees: [] as FakeEmployee[],
    credentials: [] as FakeCredential[],
    areas: [] as FakeArea[],
    permissions: [] as FakeAccessPermission[],
    devices: [] as FakeAccessDevice[],
  }

  let idCounter = 0
  const nextId = (prefix: string): string => `${prefix}-${++idCounter}`

  function seedRole(input: {
    id?: string
    code: string
    name?: string
    description?: string | null
    isSystem?: boolean
  }): FakeRole {
    const timestamp = new Date('2025-01-01T00:00:00.000Z')
    const role: FakeRole = {
      id: input.id ?? nextId('role'),
      code: input.code,
      name: input.name ?? input.code,
      description: input.description ?? null,
      isSystem: input.isSystem ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.roles.push(role)
    return role
  }

  function seedEmployee(input: {
    id: string
    employeeCode: string
    firstName: string
    lastName: string
    email?: string | null
    department?: string | null
    position?: string | null
    status?: FakeEmployeeStatus
    hiredAt?: Date | null
  }): FakeEmployee {
    const timestamp = new Date('2025-01-10T08:00:00.000Z')
    const employee: FakeEmployee = {
      id: input.id,
      employeeCode: input.employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      department: input.department ?? null,
      position: input.position ?? null,
      status: input.status ?? 'active',
      hiredAt: input.hiredAt ?? null,
      deactivatedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.employees.push(employee)
    return employee
  }

  function seedUser(input: {
    id: string
    authUserId: string
    email: string
    employeeId?: string | null
    status?: FakeAccountStatus
    lastLoginAt?: Date | null
    roleCodes?: string[]
  }): FakeUserAccount {
    const timestamp = new Date('2025-01-15T12:00:00.000Z')
    const user: FakeUserAccount = {
      id: input.id,
      authUserId: input.authUserId,
      employeeId: input.employeeId ?? null,
      email: input.email,
      status: input.status ?? 'active',
      lastLoginAt: input.lastLoginAt ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.users.push(user)

    for (const code of input.roleCodes ?? []) {
      const role = db.roles.find((candidate) => candidate.code === code)
      if (!role) {
        throw new Error(`Unknown role in seed data: ${code}`)
      }
      db.userRoles.push({
        userId: user.id,
        roleId: role.id,
        assignedAt: timestamp,
        assignedById: null,
      })
    }

    return user
  }

  function seedCredential(input: {
    id: string
    employeeId: string
    cardUid: string
    label?: string | null
    status?: FakeCredentialStatus
    issuedAt?: Date | null
    deactivatedAt?: Date | null
    deactivationReason?: string | null
    createdAt?: Date
  }): FakeCredential {
    const timestamp = input.createdAt ?? new Date('2025-02-01T10:00:00.000Z')
    const credential: FakeCredential = {
      id: input.id,
      employeeId: input.employeeId,
      cardUid: input.cardUid,
      label: input.label ?? null,
      status: input.status ?? 'active',
      issuedAt: input.issuedAt ?? null,
      deactivatedAt: input.deactivatedAt ?? null,
      deactivationReason: input.deactivationReason ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.credentials.push(credential)
    return credential
  }

  function seedArea(input: {
    id: string
    code: string
    name: string
    description?: string | null
    isActive?: boolean
    timezone?: string
  }): FakeArea {
    const timestamp = new Date('2025-01-05T00:00:00.000Z')
    const area: FakeArea = {
      id: input.id,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      timezone: input.timezone ?? 'America/Tijuana',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.areas.push(area)
    return area
  }

  function seedPermission(input: {
    id: string
    employeeId: string
    areaId: string
    validFrom?: Date | null
    validTo?: Date | null
    schedule?: unknown | null
    revokedAt?: Date | null
    createdAt?: Date
  }): FakeAccessPermission {
    const timestamp = input.createdAt ?? new Date('2025-02-05T09:00:00.000Z')
    const permission: FakeAccessPermission = {
      id: input.id,
      employeeId: input.employeeId,
      areaId: input.areaId,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      schedule: input.schedule ?? null,
      revokedAt: input.revokedAt ?? null,
      grantedById: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.permissions.push(permission)
    return permission
  }

  function seedDevice(input: {
    id: string
    status?: FakeDeviceStatus
    configVersion?: bigint
  }): FakeAccessDevice {
    const device: FakeAccessDevice = {
      id: input.id,
      status: input.status ?? 'active',
      configVersion: input.configVersion ?? 1n,
    }
    db.devices.push(device)
    return device
  }

  function reset(): void {
    db.roles.length = 0
    db.users.length = 0
    db.userRoles.length = 0
    db.employees.length = 0
    db.credentials.length = 0
    db.areas.length = 0
    db.permissions.length = 0
    db.devices.length = 0
    idCounter = 0
  }

  const client = {
    userAccount: {
      findUnique: async (args: UserQueryArgs): Promise<Record<string, unknown> | null> => {
        const user = db.users.find((candidate) => {
          if (args.where?.id !== undefined && candidate.id !== args.where.id) {
            return false
          }
          if (
            args.where?.authUserId !== undefined &&
            candidate.authUserId !== args.where.authUserId
          ) {
            return false
          }
          return true
        })

        if (!user) {
          return null
        }

        if (!args.include?.userRoles) {
          return { ...user }
        }

        return {
          ...user,
          userRoles: db.userRoles
            .filter((userRole) => userRole.userId === user.id)
            .map((userRole) => ({
              userId: userRole.userId,
              roleId: userRole.roleId,
              assignedAt: userRole.assignedAt,
              assignedById: userRole.assignedById,
              ...(args.include?.userRoles?.include?.role
                ? { role: db.roles.find((role) => role.id === userRole.roleId) }
                : {}),
            })),
        }
      },
    },
    employee: {
      findUnique: async (args: EmployeeQueryArgs): Promise<FakeEmployee | null> => {
        return db.employees.find((candidate) => candidate.id === args.where?.id) ?? null
      },
    },
    credential: {
      findMany: async (args: CredentialQueryArgs = {}): Promise<FakeCredential[]> => {
        const items = db.credentials.filter((credential) => {
          if (
            args.where?.employeeId !== undefined &&
            credential.employeeId !== args.where.employeeId
          ) {
            return false
          }
          return true
        })

        if (args.orderBy?.createdAt === 'desc') {
          items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        } else if (args.orderBy?.createdAt === 'asc') {
          items.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        }

        return items.map((item) => ({ ...item }))
      },
      findUnique: async (args: CredentialFindUniqueArgs): Promise<FakeCredential | null> => {
        const credential = db.credentials.find((candidate) => {
          if (args.where.id !== undefined && candidate.id !== args.where.id) {
            return false
          }
          if (args.where.cardUid !== undefined && candidate.cardUid !== args.where.cardUid) {
            return false
          }
          return true
        })
        return credential ? { ...credential } : null
      },
      update: async (args: CredentialUpdateArgs): Promise<FakeCredential> => {
        const credential = db.credentials.find((candidate) => candidate.id === args.where.id)
        if (!credential) {
          throw new Error(`Credential not found in fake prisma: ${args.where.id}`)
        }
        if (args.data.label !== undefined) {
          credential.label = args.data.label
        }
        if (args.data.status !== undefined) {
          credential.status = args.data.status
        }
        if (args.data.deactivatedAt !== undefined) {
          credential.deactivatedAt = args.data.deactivatedAt
        }
        if (args.data.deactivationReason !== undefined) {
          credential.deactivationReason = args.data.deactivationReason
        }
        credential.updatedAt = args.data.updatedAt ?? new Date()
        return { ...credential }
      },
    },
    accessPermission: {
      findMany: async (
        args: AccessPermissionQueryArgs = {},
      ): Promise<Record<string, unknown>[]> => {
        const items = db.permissions.filter((permission) => {
          if (
            args.where?.employeeId !== undefined &&
            permission.employeeId !== args.where.employeeId
          ) {
            return false
          }
          if (args.where && 'revokedAt' in args.where) {
            if (args.where.revokedAt === null && permission.revokedAt !== null) {
              return false
            }
          }
          return true
        })

        if (args.orderBy?.createdAt === 'desc') {
          items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        } else if (args.orderBy?.createdAt === 'asc') {
          items.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        }

        return items.map((permission) => {
          const base: Record<string, unknown> = { ...permission }
          if (args.include?.area) {
            base.area = db.areas.find((area) => area.id === permission.areaId) ?? null
          }
          return base
        })
      },
    },
    accessDevice: {
      updateMany: async (args: AccessDeviceUpdateManyArgs): Promise<{ count: number }> => {
        let count = 0
        for (const device of db.devices) {
          if (args.where?.status !== undefined && device.status !== args.where.status) {
            continue
          }
          if (args.data.configVersion !== undefined) {
            if (typeof args.data.configVersion === 'bigint') {
              device.configVersion = args.data.configVersion
            } else if (args.data.configVersion.increment !== undefined) {
              device.configVersion += BigInt(args.data.configVersion.increment)
            }
          }
          count += 1
        }
        return { count }
      },
    },
  }

  return {
    db,
    client,
    reset,
    seedRole,
    seedEmployee,
    seedUser,
    seedCredential,
    seedArea,
    seedPermission,
    seedDevice,
  }
}

const fake = createFakePrisma()
prismaHolder.current = fake.client

// ---------------------------------------------------------------------------
// Test app and fixtures
// ---------------------------------------------------------------------------

const EMPLOYEE_USER_ID = '11111111-1111-4111-8111-111111111111'
const EMPLOYEE_AUTH_USER_ID = '22222222-2222-4222-8222-222222222222'
const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333'

const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_AUTH_USER_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_EMPLOYEE_ID = '66666666-6666-4666-8666-666666666666'

const ADMIN_NO_EMPLOYEE_USER_ID = '77777777-7777-4777-8777-777777777777'
const ADMIN_NO_EMPLOYEE_AUTH_USER_ID = '88888888-8888-4888-8888-888888888888'

const ORPHAN_EMPLOYEE_USER_ID = '99999999-9999-4999-8999-999999999999'
const ORPHAN_EMPLOYEE_AUTH_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MISSING_EMPLOYEE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const AREA_LAB_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const AREA_WAREHOUSE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const AREA_ARCHIVE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const AREA_SERVER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const CREDENTIAL_ACTIVE_ID = '11111111-aaaa-4111-8111-111111111111'
const CREDENTIAL_RETIRED_ID = '22222222-aaaa-4222-8222-222222222222'
const CREDENTIAL_OTHER_ID = '33333333-aaaa-4333-8333-333333333333'
const CREDENTIAL_BLOCKED_ID = '44444444-aaaa-4444-8444-444444444444'
const CREDENTIAL_LOST_ID = '55555555-aaaa-4555-8555-555555555555'
const MISSING_CREDENTIAL_ID = '66666666-aaaa-4666-8666-666666666666'

const DEVICE_ACTIVE_1_ID = '11111111-bbbb-4111-8111-111111111111'
const DEVICE_ACTIVE_2_ID = '22222222-bbbb-4222-8222-222222222222'
const DEVICE_INACTIVE_ID = '33333333-bbbb-4333-8333-333333333333'

const DEFAULT_LOST_REPORT_REASON = 'Reportada como extraviada por el empleado'

const employeeUser: AuthenticatedUser = {
  id: EMPLOYEE_USER_ID,
  authUserId: EMPLOYEE_AUTH_USER_ID,
  employeeId: EMPLOYEE_ID,
  email: 'elena.martinez@example.com',
  status: 'active',
  roles: [],
}

const adminWithoutEmployee: AuthenticatedUser = {
  id: ADMIN_NO_EMPLOYEE_USER_ID,
  authUserId: ADMIN_NO_EMPLOYEE_AUTH_USER_ID,
  employeeId: null,
  email: 'admin.only@example.com',
  status: 'active',
  roles: ['admin'],
}

const orphanEmployeeUser: AuthenticatedUser = {
  id: ORPHAN_EMPLOYEE_USER_ID,
  authUserId: ORPHAN_EMPLOYEE_AUTH_USER_ID,
  employeeId: MISSING_EMPLOYEE_ID,
  email: 'orphan@example.com',
  status: 'active',
  roles: [],
}

const app = createApp()

function seedBaseData(): void {
  fake.seedRole({
    code: 'admin',
    name: 'Administrador',
    description: 'Acceso completo a la administracion del sistema',
  })

  fake.seedEmployee({
    id: EMPLOYEE_ID,
    employeeCode: 'E-1001',
    firstName: 'Elena',
    lastName: 'Martinez',
    email: 'elena.martinez@example.com',
    department: 'Ingenieria',
    position: 'Especialista RFID',
    status: 'active',
    hiredAt: new Date('2023-08-14T15:30:00.000Z'),
  })

  fake.seedEmployee({
    id: OTHER_EMPLOYEE_ID,
    employeeCode: 'E-1002',
    firstName: 'Carlos',
    lastName: 'Lopez',
    email: 'carlos.lopez@example.com',
    department: 'Operaciones',
    position: 'Supervisor',
    status: 'active',
    hiredAt: new Date('2022-05-01T00:00:00.000Z'),
  })

  fake.seedUser({
    id: EMPLOYEE_USER_ID,
    authUserId: EMPLOYEE_AUTH_USER_ID,
    employeeId: EMPLOYEE_ID,
    email: 'elena.martinez@example.com',
    status: 'active',
    lastLoginAt: new Date('2025-03-01T12:00:00.000Z'),
  })

  fake.seedUser({
    id: OTHER_USER_ID,
    authUserId: OTHER_AUTH_USER_ID,
    employeeId: OTHER_EMPLOYEE_ID,
    email: 'carlos.lopez@example.com',
    status: 'active',
  })

  fake.seedUser({
    id: ADMIN_NO_EMPLOYEE_USER_ID,
    authUserId: ADMIN_NO_EMPLOYEE_AUTH_USER_ID,
    employeeId: null,
    email: 'admin.only@example.com',
    status: 'active',
    roleCodes: ['admin'],
  })

  fake.seedUser({
    id: ORPHAN_EMPLOYEE_USER_ID,
    authUserId: ORPHAN_EMPLOYEE_AUTH_USER_ID,
    employeeId: MISSING_EMPLOYEE_ID,
    email: 'orphan@example.com',
    status: 'active',
  })

  // Credentials for authenticated employee + another employee
  fake.seedCredential({
    id: CREDENTIAL_RETIRED_ID,
    employeeId: EMPLOYEE_ID,
    cardUid: '04AABB1122',
    label: 'Tarjeta anterior',
    status: 'retired',
    issuedAt: new Date('2023-09-01T09:00:00.000Z'),
    deactivatedAt: new Date('2024-06-01T18:00:00.000Z'),
    deactivationReason: null,
    createdAt: new Date('2023-09-01T09:00:00.000Z'),
  })

  fake.seedCredential({
    id: CREDENTIAL_ACTIVE_ID,
    employeeId: EMPLOYEE_ID,
    cardUid: '04CCDD3344',
    label: 'Tarjeta principal',
    status: 'active',
    issuedAt: new Date('2024-06-02T10:00:00.000Z'),
    deactivatedAt: null,
    deactivationReason: null,
    createdAt: new Date('2024-06-02T10:00:00.000Z'),
  })

  fake.seedCredential({
    id: CREDENTIAL_OTHER_ID,
    employeeId: OTHER_EMPLOYEE_ID,
    cardUid: '04EEFF5566',
    label: 'Tarjeta ajena',
    status: 'active',
    issuedAt: new Date('2024-01-10T10:00:00.000Z'),
    createdAt: new Date('2024-01-10T10:00:00.000Z'),
  })

  // Access devices (active devices must bump configVersion on credential updates; inactive must not)
  fake.seedDevice({
    id: DEVICE_ACTIVE_1_ID,
    status: 'active',
    configVersion: 1n,
  })

  fake.seedDevice({
    id: DEVICE_ACTIVE_2_ID,
    status: 'active',
    configVersion: 5n,
  })

  fake.seedDevice({
    id: DEVICE_INACTIVE_ID,
    status: 'inactive',
    configVersion: 3n,
  })

  // Areas
  fake.seedArea({
    id: AREA_WAREHOUSE_ID,
    code: 'ALM-01',
    name: 'Almacen Norte',
    description: 'Bodega de materiales',
    isActive: true,
    timezone: 'America/Tijuana',
  })

  fake.seedArea({
    id: AREA_LAB_ID,
    code: 'LAB-02',
    name: 'Laboratorio Electronica',
    description: null,
    isActive: true,
    timezone: 'America/Tijuana',
  })

  fake.seedArea({
    id: AREA_ARCHIVE_ID,
    code: 'ARC-03',
    name: 'Archivo Historico',
    description: 'Area restringida',
    isActive: false,
    timezone: 'America/Mexico_City',
  })

  fake.seedArea({
    id: AREA_SERVER_ID,
    code: 'SRV-04',
    name: 'Cuarto de Servidores',
    description: 'Infraestructura critica',
    isActive: true,
    timezone: 'America/Tijuana',
  })

  // Permissions: intentionally seeded out of alphabetical order
  fake.seedPermission({
    id: 'perm-emp-lab',
    employeeId: EMPLOYEE_ID,
    areaId: AREA_LAB_ID,
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validTo: new Date('2025-12-31T23:59:59.000Z'),
    schedule: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' },
    revokedAt: null,
    createdAt: new Date('2025-02-01T10:00:00.000Z'),
  })

  fake.seedPermission({
    id: 'perm-emp-warehouse',
    employeeId: EMPLOYEE_ID,
    areaId: AREA_WAREHOUSE_ID,
    validFrom: null,
    validTo: null,
    schedule: null,
    revokedAt: null,
    createdAt: new Date('2025-02-02T10:00:00.000Z'),
  })

  fake.seedPermission({
    id: 'perm-emp-revoked',
    employeeId: EMPLOYEE_ID,
    areaId: AREA_ARCHIVE_ID,
    validFrom: new Date('2024-01-01T00:00:00.000Z'),
    validTo: null,
    schedule: null,
    revokedAt: new Date('2025-01-20T16:30:00.000Z'),
    createdAt: new Date('2025-02-03T10:00:00.000Z'),
  })

  fake.seedPermission({
    id: 'perm-other-active',
    employeeId: OTHER_EMPLOYEE_ID,
    areaId: AREA_SERVER_ID,
    revokedAt: null,
    createdAt: new Date('2025-02-04T10:00:00.000Z'),
  })

  fake.seedPermission({
    id: 'perm-other-revoked',
    employeeId: OTHER_EMPLOYEE_ID,
    areaId: AREA_ARCHIVE_ID,
    revokedAt: new Date('2025-01-25T12:00:00.000Z'),
    createdAt: new Date('2025-02-05T10:00:00.000Z'),
  })
}

beforeEach(() => {
  fake.reset()
  seedBaseData()
  setAuthTokenResolver(async (token) => {
    if (token === 'employee-token') {
      return employeeUser
    }
    if (token === 'admin-no-employee-token') {
      return adminWithoutEmployee
    }
    if (token === 'orphan-employee-token') {
      return orphanEmployeeUser
    }
    return null
  })
})

afterEach(() => {
  setAuthTokenResolver(null)
})

// ---------------------------------------------------------------------------
// Self-service profile
// ---------------------------------------------------------------------------

describe('GET /api/v1/me/profile', () => {
  it('returns 200 with account, employee (YYYY-MM-DD hiredAt) and only the employee credentials', async () => {
    const response = await request(app)
      .get('/api/v1/me/profile')
      .set('Authorization', 'Bearer employee-token')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      account: {
        id: EMPLOYEE_USER_ID,
        authUserId: EMPLOYEE_AUTH_USER_ID,
        employeeId: EMPLOYEE_ID,
        email: 'elena.martinez@example.com',
        status: 'active',
        roles: [],
        lastLoginAt: '2025-03-01T12:00:00.000Z',
        createdAt: '2025-01-15T12:00:00.000Z',
        updatedAt: '2025-01-15T12:00:00.000Z',
      },
      employee: {
        id: EMPLOYEE_ID,
        employeeCode: 'E-1001',
        firstName: 'Elena',
        lastName: 'Martinez',
        email: 'elena.martinez@example.com',
        department: 'Ingenieria',
        position: 'Especialista RFID',
        status: 'active',
        hiredAt: '2023-08-14',
      },
      credentials: [
        {
          id: CREDENTIAL_ACTIVE_ID,
          cardUid: '04CCDD3344',
          label: 'Tarjeta principal',
          status: 'active',
          issuedAt: '2024-06-02T10:00:00.000Z',
          deactivatedAt: null,
          deactivationReason: null,
        },
        {
          id: CREDENTIAL_RETIRED_ID,
          cardUid: '04AABB1122',
          label: 'Tarjeta anterior',
          status: 'retired',
          issuedAt: '2023-09-01T09:00:00.000Z',
          deactivatedAt: '2024-06-01T18:00:00.000Z',
          deactivationReason: null,
        },
      ],
    })
    expect(response.body.employee.hiredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(
      response.body.credentials.some((cred: { id: string }) => cred.id === CREDENTIAL_OTHER_ID),
    ).toBe(false)
  })

  it('returns 401 UNAUTHORIZED when no authorization token is provided', async () => {
    const response = await request(app).get('/api/v1/me/profile')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  })

  it('returns 403 FORBIDDEN when the authenticated admin has employeeId set to null', async () => {
    const response = await request(app)
      .get('/api/v1/me/profile')
      .set('Authorization', 'Bearer admin-no-employee-token')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Employee account required' },
    })
  })

  it('returns 404 NOT_FOUND when the linked employeeId does not exist in employees', async () => {
    const response = await request(app)
      .get('/api/v1/me/profile')
      .set('Authorization', 'Bearer orphan-employee-token')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Employee not found' },
    })
  })
})

// ---------------------------------------------------------------------------
// Self-service permissions
// ---------------------------------------------------------------------------

describe('GET /api/v1/me/permissions', () => {
  it('returns 200 with active permissions sorted alphabetically by area.name and excludes revoked or foreign permissions', async () => {
    const response = await request(app)
      .get('/api/v1/me/permissions')
      .set('Authorization', 'Bearer employee-token')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: [
        {
          id: 'perm-emp-warehouse',
          areaId: AREA_WAREHOUSE_ID,
          validFrom: null,
          validTo: null,
          schedule: null,
          revokedAt: null,
          area: {
            id: AREA_WAREHOUSE_ID,
            code: 'ALM-01',
            name: 'Almacen Norte',
            description: 'Bodega de materiales',
            isActive: true,
            timezone: 'America/Tijuana',
          },
        },
        {
          id: 'perm-emp-lab',
          areaId: AREA_LAB_ID,
          validFrom: '2025-01-01T00:00:00.000Z',
          validTo: '2025-12-31T23:59:59.000Z',
          schedule: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' },
          revokedAt: null,
          area: {
            id: AREA_LAB_ID,
            code: 'LAB-02',
            name: 'Laboratorio Electronica',
            description: null,
            isActive: true,
            timezone: 'America/Tijuana',
          },
        },
      ],
    })
  })

  it('includes revoked permissions of the authenticated employee when activeOnly=false without exposing other employees', async () => {
    const response = await request(app)
      .get('/api/v1/me/permissions?activeOnly=false')
      .set('Authorization', 'Bearer employee-token')

    expect(response.status).toBe(200)
    expect(
      response.body.data.map((permission: { id: string; area: { name: string } }) => ({
        id: permission.id,
        areaName: permission.area.name,
      })),
    ).toEqual([
      { id: 'perm-emp-warehouse', areaName: 'Almacen Norte' },
      { id: 'perm-emp-revoked', areaName: 'Archivo Historico' },
      { id: 'perm-emp-lab', areaName: 'Laboratorio Electronica' },
    ])
    expect(response.body.data[1]).toMatchObject({
      id: 'perm-emp-revoked',
      areaId: AREA_ARCHIVE_ID,
      validFrom: '2024-01-01T00:00:00.000Z',
      validTo: null,
      schedule: null,
      revokedAt: '2025-01-20T16:30:00.000Z',
      area: {
        id: AREA_ARCHIVE_ID,
        code: 'ARC-03',
        name: 'Archivo Historico',
        description: 'Area restringida',
        isActive: false,
        timezone: 'America/Mexico_City',
      },
    })
  })

  it('returns 400 VALIDATION_ERROR when activeOnly=invalid', async () => {
    const response = await request(app)
      .get('/api/v1/me/permissions?activeOnly=invalid')
      .set('Authorization', 'Bearer employee-token')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
      },
    })
    expect(Array.isArray(response.body.error.details)).toBe(true)
  })

  it('returns 401 UNAUTHORIZED without a token and 403 FORBIDDEN for an account without employeeId', async () => {
    const unauthenticated = await request(app).get('/api/v1/me/permissions')

    expect(unauthenticated.status).toBe(401)
    expect(unauthenticated.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })

    const forbidden = await request(app)
      .get('/api/v1/me/permissions')
      .set('Authorization', 'Bearer admin-no-employee-token')

    expect(forbidden.status).toBe(403)
    expect(forbidden.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Employee account required' },
    })
  })
})

// ---------------------------------------------------------------------------
// Self-service lost credential report
// ---------------------------------------------------------------------------

describe('POST /api/v1/me/credentials/:id/report-lost', () => {
  it('returns 200 with trimmed custom reason, bumps configVersion only on active devices, and updates profile', async () => {
    const response = await request(app)
      .post(`/api/v1/me/credentials/${CREDENTIAL_ACTIVE_ID}/report-lost`)
      .set('Authorization', 'Bearer employee-token')
      .send({ reason: '  Extraviada en laboratorio  ' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      credential: {
        id: CREDENTIAL_ACTIVE_ID,
        cardUid: '04CCDD3344',
        label: 'Tarjeta principal',
        status: 'lost',
        issuedAt: '2024-06-02T10:00:00.000Z',
        deactivatedAt: expect.any(String),
        deactivationReason: 'Extraviada en laboratorio',
      },
    })
    expect(new Date(response.body.credential.deactivatedAt).toISOString()).toBe(
      response.body.credential.deactivatedAt,
    )

    expect(fake.db.devices).toEqual([
      { id: DEVICE_ACTIVE_1_ID, status: 'active', configVersion: 2n },
      { id: DEVICE_ACTIVE_2_ID, status: 'active', configVersion: 6n },
      { id: DEVICE_INACTIVE_ID, status: 'inactive', configVersion: 3n },
    ])

    const profileResponse = await request(app)
      .get('/api/v1/me/profile')
      .set('Authorization', 'Bearer employee-token')

    expect(profileResponse.status).toBe(200)
    expect(profileResponse.body.credentials[0]).toEqual(response.body.credential)
  })

  it('returns 200 with default reason when body is empty', async () => {
    const response = await request(app)
      .post(`/api/v1/me/credentials/${CREDENTIAL_ACTIVE_ID}/report-lost`)
      .set('Authorization', 'Bearer employee-token')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      credential: {
        id: CREDENTIAL_ACTIVE_ID,
        cardUid: '04CCDD3344',
        label: 'Tarjeta principal',
        status: 'lost',
        issuedAt: '2024-06-02T10:00:00.000Z',
        deactivatedAt: expect.any(String),
        deactivationReason: DEFAULT_LOST_REPORT_REASON,
      },
    })
    expect(new Date(response.body.credential.deactivatedAt).toISOString()).toBe(
      response.body.credential.deactivatedAt,
    )
    expect(fake.db.devices).toEqual([
      { id: DEVICE_ACTIVE_1_ID, status: 'active', configVersion: 2n },
      { id: DEVICE_ACTIVE_2_ID, status: 'active', configVersion: 6n },
      { id: DEVICE_INACTIVE_ID, status: 'inactive', configVersion: 3n },
    ])
  })

  it('returns 200 with default reason when reason is whitespace-only', async () => {
    const response = await request(app)
      .post(`/api/v1/me/credentials/${CREDENTIAL_ACTIVE_ID}/report-lost`)
      .set('Authorization', 'Bearer employee-token')
      .send({ reason: '   \t\n  ' })

    expect(response.status).toBe(200)
    expect(response.body.credential).toMatchObject({
      id: CREDENTIAL_ACTIVE_ID,
      status: 'lost',
      deactivationReason: DEFAULT_LOST_REPORT_REASON,
    })
    expect(new Date(response.body.credential.deactivatedAt).toISOString()).toBe(
      response.body.credential.deactivatedAt,
    )
    expect(fake.db.devices).toEqual([
      { id: DEVICE_ACTIVE_1_ID, status: 'active', configVersion: 2n },
      { id: DEVICE_ACTIVE_2_ID, status: 'active', configVersion: 6n },
      { id: DEVICE_INACTIVE_ID, status: 'inactive', configVersion: 3n },
    ])
  })

  it('returns 409 CONFLICT when credential is already lost, blocked, or retired without incrementing configVersion', async () => {
    fake.seedCredential({
      id: CREDENTIAL_LOST_ID,
      employeeId: EMPLOYEE_ID,
      cardUid: '04AABB7788',
      label: 'Tarjeta extraviada',
      status: 'lost',
      issuedAt: new Date('2024-02-01T10:00:00.000Z'),
      deactivatedAt: new Date('2024-03-01T10:00:00.000Z'),
      deactivationReason: 'Extraviada previamente',
    })

    fake.seedCredential({
      id: CREDENTIAL_BLOCKED_ID,
      employeeId: EMPLOYEE_ID,
      cardUid: '04AABB9900',
      label: 'Tarjeta bloqueada',
      status: 'blocked',
      issuedAt: new Date('2024-04-01T10:00:00.000Z'),
      deactivatedAt: new Date('2024-05-01T10:00:00.000Z'),
      deactivationReason: 'Bloqueada por administracion',
    })

    for (const credentialId of [
      CREDENTIAL_LOST_ID,
      CREDENTIAL_BLOCKED_ID,
      CREDENTIAL_RETIRED_ID,
    ]) {
      const response = await request(app)
        .post(`/api/v1/me/credentials/${credentialId}/report-lost`)
        .set('Authorization', 'Bearer employee-token')
        .send({ reason: 'Intento duplicado' })

      expect(response.status).toBe(409)
      expect(response.body).toMatchObject({
        error: { code: 'CONFLICT' },
      })
    }

    expect(fake.db.devices).toEqual([
      { id: DEVICE_ACTIVE_1_ID, status: 'active', configVersion: 1n },
      { id: DEVICE_ACTIVE_2_ID, status: 'active', configVersion: 5n },
      { id: DEVICE_INACTIVE_ID, status: 'inactive', configVersion: 3n },
    ])
  })

  it('returns 404 NOT_FOUND when credential belongs to another employee or does not exist without incrementing configVersion', async () => {
    const foreignResponse = await request(app)
      .post(`/api/v1/me/credentials/${CREDENTIAL_OTHER_ID}/report-lost`)
      .set('Authorization', 'Bearer employee-token')

    expect(foreignResponse.status).toBe(404)
    expect(foreignResponse.body).toMatchObject({
      error: { code: 'NOT_FOUND' },
    })

    const missingResponse = await request(app)
      .post(`/api/v1/me/credentials/${MISSING_CREDENTIAL_ID}/report-lost`)
      .set('Authorization', 'Bearer employee-token')

    expect(missingResponse.status).toBe(404)
    expect(missingResponse.body).toMatchObject({
      error: { code: 'NOT_FOUND' },
    })

    expect(fake.db.devices).toEqual([
      { id: DEVICE_ACTIVE_1_ID, status: 'active', configVersion: 1n },
      { id: DEVICE_ACTIVE_2_ID, status: 'active', configVersion: 5n },
      { id: DEVICE_INACTIVE_ID, status: 'inactive', configVersion: 3n },
    ])
  })

  it('returns 400 VALIDATION_ERROR when :id is not a valid UUID or reason exceeds 500 characters', async () => {
    const invalidIdResponse = await request(app)
      .post('/api/v1/me/credentials/not-a-uuid/report-lost')
      .set('Authorization', 'Bearer employee-token')

    expect(invalidIdResponse.status).toBe(400)
    expect(invalidIdResponse.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
      },
    })
    expect(Array.isArray(invalidIdResponse.body.error.details)).toBe(true)

    const longReasonResponse = await request(app)
      .post(`/api/v1/me/credentials/${CREDENTIAL_ACTIVE_ID}/report-lost`)
      .set('Authorization', 'Bearer employee-token')
      .send({ reason: 'a'.repeat(501) })

    expect(longReasonResponse.status).toBe(400)
    expect(longReasonResponse.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
      },
    })
    expect(Array.isArray(longReasonResponse.body.error.details)).toBe(true)

    expect(fake.db.devices).toEqual([
      { id: DEVICE_ACTIVE_1_ID, status: 'active', configVersion: 1n },
      { id: DEVICE_ACTIVE_2_ID, status: 'active', configVersion: 5n },
      { id: DEVICE_INACTIVE_ID, status: 'inactive', configVersion: 3n },
    ])
  })

  it('returns 401 UNAUTHORIZED without a token and 403 FORBIDDEN for an account without employeeId', async () => {
    const unauthenticated = await request(app).post(
      `/api/v1/me/credentials/${CREDENTIAL_ACTIVE_ID}/report-lost`,
    )

    expect(unauthenticated.status).toBe(401)
    expect(unauthenticated.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })

    const forbidden = await request(app)
      .post(`/api/v1/me/credentials/${CREDENTIAL_ACTIVE_ID}/report-lost`)
      .set('Authorization', 'Bearer admin-no-employee-token')

    expect(forbidden.status).toBe(403)
    expect(forbidden.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Employee account required' },
    })

    expect(fake.db.devices).toEqual([
      { id: DEVICE_ACTIVE_1_ID, status: 'active', configVersion: 1n },
      { id: DEVICE_ACTIVE_2_ID, status: 'active', configVersion: 5n },
      { id: DEVICE_INACTIVE_ID, status: 'inactive', configVersion: 3n },
    ])
  })
})
