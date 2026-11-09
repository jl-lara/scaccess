import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAuthTokenResolver, type AuthenticatedUser } from '../src/middleware/auth.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { authRouter } from '../src/modules/auth/auth.routes.js'
import { dashboardRouter } from '../src/modules/dashboard/dashboard.routes.js'
import { rolesRouter } from '../src/modules/roles/roles.routes.js'
import { usersRouter } from '../src/modules/users/users.routes.js'

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
type FakeDeviceStatus = 'active' | 'inactive' | 'maintenance'
type FakeAccessDecision = 'granted' | 'denied'

interface FakeRole {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

interface FakeEmployee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string | null
  status: FakeEmployeeStatus
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

interface FakeCredential {
  id: string
  status: FakeCredentialStatus
}

interface FakeArea {
  id: string
  isActive: boolean
}

interface FakeDevice {
  id: string
  status: FakeDeviceStatus
  configVersion: bigint
  syncState: { configVersion: bigint } | null
}

interface FakeAccessEvent {
  id: string
  decision: FakeAccessDecision
  occurredAt: Date
}

interface QueryArgs {
  where?: Record<string, unknown>
  select?: Record<string, boolean>
  include?: Record<string, unknown>
  orderBy?: Record<string, 'asc' | 'desc'>
  skip?: number
  take?: number
  data?: Record<string, unknown>
}

interface UserQueryArgs extends QueryArgs {
  include?: {
    userRoles?: { include?: { role?: boolean } }
  }
}

interface StringFilter {
  contains?: string
  mode?: string
}

interface UserWhere {
  id?: string
  authUserId?: string
  email?: string | StringFilter
  employeeId?: string | null
  status?: FakeAccountStatus
  OR?: UserWhere[]
  employee?: {
    is?: {
      employeeCode?: StringFilter
      firstName?: StringFilter
      lastName?: StringFilter
    }
  }
}

interface UserCreateData {
  id?: string
  authUserId: string
  email: string
  employeeId?: string | null
  status?: FakeAccountStatus
  userRoles?: {
    create?: Array<{ roleId: string; assignedById?: string | null }>
  }
}

interface UserUpdateData {
  status?: FakeAccountStatus
  employeeId?: string | null
  lastLoginAt?: Date | null
  userRoles?: {
    deleteMany?: Record<string, never>
    create?: Array<{ roleId: string; assignedById?: string | null }>
  }
}

function selectFields(
  record: object,
  select?: Record<string, boolean>,
): Record<string, unknown> {
  const source = record as Record<string, unknown>
  if (!select) {
    return { ...source }
  }

  const result: Record<string, unknown> = {}
  for (const key of Object.keys(select)) {
    if (select[key]) {
      result[key] = source[key]
    }
  }
  return result
}

function matchesStringFilter(value: string | null | undefined, filter: unknown): boolean {
  if (filter === undefined) {
    return true
  }

  if (typeof filter === 'string') {
    return value === filter
  }

  if (filter && typeof filter === 'object' && 'contains' in filter) {
    const contains = (filter as StringFilter).contains
    if (!contains) {
      return true
    }
    return (value ?? '').toLowerCase().includes(contains.toLowerCase())
  }

  return true
}

function matchesValueFilter<T extends string>(value: T, filter: unknown): boolean {
  if (filter === undefined) {
    return true
  }

  if (typeof filter === 'string') {
    return value === filter
  }

  if (filter && typeof filter === 'object' && 'in' in filter) {
    const values = (filter as { in?: unknown }).in
    return Array.isArray(values) && values.includes(value)
  }

  return true
}

function createFakePrisma() {
  const db = {
    roles: [] as FakeRole[],
    employees: [] as FakeEmployee[],
    users: [] as FakeUserAccount[],
    userRoles: [] as FakeUserRole[],
    credentials: [] as FakeCredential[],
    areas: [] as FakeArea[],
    devices: [] as FakeDevice[],
    events: [] as FakeAccessEvent[],
  }

  let idCounter = 0
  const nextId = (prefix: string): string => `${prefix}-${++idCounter}`

  function matchesUserWhere(user: FakeUserAccount, where: UserWhere): boolean {
    if (where.id !== undefined && user.id !== where.id) {
      return false
    }
    if (where.authUserId !== undefined && user.authUserId !== where.authUserId) {
      return false
    }
    if (where.email !== undefined && !matchesStringFilter(user.email, where.email)) {
      return false
    }
    if (where.employeeId !== undefined && user.employeeId !== where.employeeId) {
      return false
    }
    if (where.status !== undefined && user.status !== where.status) {
      return false
    }
    if (where.OR && !where.OR.some((clause) => matchesUserWhere(user, clause))) {
      return false
    }

    if (where.employee?.is) {
      const employee = db.employees.find((candidate) => candidate.id === user.employeeId)
      if (!employee) {
        return false
      }

      const filter = where.employee.is
      if (!matchesStringFilter(employee.employeeCode, filter.employeeCode)) {
        return false
      }
      if (!matchesStringFilter(employee.firstName, filter.firstName)) {
        return false
      }
      if (!matchesStringFilter(employee.lastName, filter.lastName)) {
        return false
      }
    }

    return true
  }

  function serializeUser(user: FakeUserAccount, args: UserQueryArgs): Record<string, unknown> {
    const base = selectFields(user, args.select)
    if (args.select) {
      return base
    }

    const includeRoles = args.include?.userRoles
    if (!includeRoles) {
      return base
    }

    return {
      ...base,
      userRoles: db.userRoles
        .filter((userRole) => userRole.userId === user.id)
        .map((userRole) => ({
          userId: userRole.userId,
          roleId: userRole.roleId,
          assignedAt: userRole.assignedAt,
          assignedById: userRole.assignedById,
          ...(includeRoles.include?.role
            ? { role: db.roles.find((role) => role.id === userRole.roleId) }
            : {}),
        })),
    }
  }

  function seedRole(input: {
    id?: string
    code: string
    name?: string
    description?: string | null
    isSystem?: boolean
  }): FakeRole {
    const timestamp = new Date()
    const role: FakeRole = {
      id: input.id ?? nextId('role'),
      code: input.code,
      name: input.name ?? input.code,
      description: input.description ?? null,
      isSystem: input.isSystem ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.roles.push(role)
    return role
  }

  function seedEmployee(input: {
    id: string
    employeeCode: string
    firstName?: string
    lastName?: string
    email?: string | null
    status?: FakeEmployeeStatus
  }): FakeEmployee {
    const timestamp = new Date()
    const employee: FakeEmployee = {
      id: input.id,
      employeeCode: input.employeeCode,
      firstName: input.firstName ?? 'Nombre',
      lastName: input.lastName ?? 'Apellido',
      email: input.email ?? null,
      status: input.status ?? 'active',
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
    const timestamp = new Date()
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

  function seedCredential(input: { id?: string; status: FakeCredentialStatus }): FakeCredential {
    const credential: FakeCredential = {
      id: input.id ?? nextId('credential'),
      status: input.status,
    }
    db.credentials.push(credential)
    return credential
  }

  function seedArea(input: { id?: string; isActive?: boolean }): FakeArea {
    const area: FakeArea = {
      id: input.id ?? nextId('area'),
      isActive: input.isActive ?? true,
    }
    db.areas.push(area)
    return area
  }

  function seedDevice(input: {
    id?: string
    status: FakeDeviceStatus
    configVersion?: bigint
    syncVersion?: bigint | null
  }): FakeDevice {
    const device: FakeDevice = {
      id: input.id ?? nextId('device'),
      status: input.status,
      configVersion: input.configVersion ?? 0n,
      syncState:
        input.syncVersion === undefined || input.syncVersion === null
          ? null
          : { configVersion: input.syncVersion },
    }
    db.devices.push(device)
    return device
  }

  function seedEvent(input: {
    id?: string
    decision: FakeAccessDecision
    occurredAt: Date
  }): FakeAccessEvent {
    const event: FakeAccessEvent = {
      id: input.id ?? nextId('event'),
      decision: input.decision,
      occurredAt: input.occurredAt,
    }
    db.events.push(event)
    return event
  }

  function getUserAccount(userId: string): FakeUserAccount | undefined {
    return db.users.find((user) => user.id === userId)
  }

  function getUserRoleAssignments(
    userId: string,
  ): Array<{ roleCode: string; assignedById: string | null }> {
    return db.userRoles
      .filter((userRole) => userRole.userId === userId)
      .map((userRole) => ({
        roleCode: db.roles.find((role) => role.id === userRole.roleId)?.code ?? 'unknown',
        assignedById: userRole.assignedById,
      }))
  }

  function reset(): void {
    db.roles.length = 0
    db.employees.length = 0
    db.users.length = 0
    db.userRoles.length = 0
    db.credentials.length = 0
    db.areas.length = 0
    db.devices.length = 0
    db.events.length = 0
    idCounter = 0
  }

  const client = {
    userAccount: {
      findUnique: async (args: UserQueryArgs): Promise<Record<string, unknown> | null> => {
        const user = db.users.find((candidate) =>
          matchesUserWhere(candidate, (args.where ?? {}) as UserWhere),
        )
        return user ? serializeUser(user, args) : null
      },
      findMany: async (args: UserQueryArgs = {}): Promise<Record<string, unknown>[]> => {
        const users = db.users.filter((candidate) =>
          matchesUserWhere(candidate, (args.where ?? {}) as UserWhere),
        )

        if (args.orderBy?.createdAt === 'asc') {
          users.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        } else {
          users.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        }

        const skip = args.skip ?? 0
        const take = args.take ?? users.length
        return users.slice(skip, skip + take).map((user) => serializeUser(user, args))
      },
      count: async (args: QueryArgs = {}): Promise<number> => {
        return db.users.filter((candidate) =>
          matchesUserWhere(candidate, (args.where ?? {}) as UserWhere),
        ).length
      },
      create: async (args: QueryArgs): Promise<Record<string, unknown>> => {
        const data = (args.data ?? {}) as unknown as UserCreateData
        const timestamp = new Date()
        const user: FakeUserAccount = {
          id: data.id ?? nextId('user'),
          authUserId: data.authUserId,
          employeeId: data.employeeId ?? null,
          email: data.email,
          status: data.status ?? 'active',
          lastLoginAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        db.users.push(user)

        for (const roleInput of data.userRoles?.create ?? []) {
          db.userRoles.push({
            userId: user.id,
            roleId: roleInput.roleId,
            assignedAt: timestamp,
            assignedById: roleInput.assignedById ?? null,
          })
        }

        return serializeUser(user, args as UserQueryArgs)
      },
      update: async (args: QueryArgs): Promise<Record<string, unknown>> => {
        const where = (args.where ?? {}) as { id?: string }
        const user = db.users.find((candidate) => candidate.id === where.id)
        if (!user) {
          throw new Error('Fake Prisma: user account not found')
        }

        const data = (args.data ?? {}) as unknown as UserUpdateData
        if (data.status !== undefined) {
          user.status = data.status
        }
        if (data.employeeId !== undefined) {
          user.employeeId = data.employeeId
        }
        if (data.lastLoginAt !== undefined) {
          user.lastLoginAt = data.lastLoginAt
        }
        if (data.userRoles) {
          if (data.userRoles.deleteMany !== undefined) {
            db.userRoles = db.userRoles.filter((userRole) => userRole.userId !== user.id)
          }
          for (const roleInput of data.userRoles.create ?? []) {
            db.userRoles.push({
              userId: user.id,
              roleId: roleInput.roleId,
              assignedAt: new Date(),
              assignedById: roleInput.assignedById ?? null,
            })
          }
        }

        user.updatedAt = new Date()
        return serializeUser(user, args as UserQueryArgs)
      },
    },
    role: {
      findMany: async (args: QueryArgs = {}): Promise<Record<string, unknown>[]> => {
        const where = (args.where ?? {}) as {
          code?: string | { in?: string[] }
        }
        let roles = [...db.roles]

        if (typeof where.code === 'string') {
          roles = roles.filter((role) => role.code === where.code)
        } else if (where.code?.in) {
          const codes = where.code.in
          roles = roles.filter((role) => codes.includes(role.code))
        }

        if (args.orderBy?.code === 'asc') {
          roles.sort((left, right) => left.code.localeCompare(right.code))
        } else if (args.orderBy?.code === 'desc') {
          roles.sort((left, right) => right.code.localeCompare(left.code))
        }

        return roles.map((role) => selectFields(role, args.select))
      },
    },
    employee: {
      findUnique: async (args: QueryArgs): Promise<Record<string, unknown> | null> => {
        const where = (args.where ?? {}) as { id?: string }
        const employee = db.employees.find((candidate) => candidate.id === where.id)
        return employee ? selectFields(employee, args.select) : null
      },
      count: async (args: QueryArgs = {}): Promise<number> => {
        const where = args.where as { status?: FakeEmployeeStatus } | undefined
        const status = where?.status
        return db.employees.filter(
          (employee) => status === undefined || employee.status === status,
        ).length
      },
    },
    credential: {
      count: async (args: QueryArgs = {}): Promise<number> => {
        const where = args.where as { status?: unknown } | undefined
        return db.credentials.filter((credential) =>
          matchesValueFilter(credential.status, where?.status),
        ).length
      },
    },
    area: {
      count: async (args: QueryArgs = {}): Promise<number> => {
        const where = args.where as { isActive?: boolean } | undefined
        return db.areas.filter(
          (area) => where?.isActive === undefined || area.isActive === where.isActive,
        ).length
      },
    },
    accessDevice: {
      count: async (args: QueryArgs = {}): Promise<number> => {
        const where = args.where as { status?: unknown } | undefined
        return db.devices.filter((device) => matchesValueFilter(device.status, where?.status))
          .length
      },
      findMany: async (
        args: QueryArgs = {},
      ): Promise<Array<{ configVersion: bigint; syncState: { configVersion: bigint } | null }>> => {
        const where = args.where as { status?: unknown } | undefined
        return db.devices
          .filter((device) => matchesValueFilter(device.status, where?.status))
          .map((device) => ({
            configVersion: device.configVersion,
            syncState: device.syncState ? { configVersion: device.syncState.configVersion } : null,
          }))
      },
    },
    accessEvent: {
      count: async (args: QueryArgs = {}): Promise<number> => {
        const where = args.where as
          | { decision?: string; occurredAt?: { gte?: Date } }
          | undefined

        return db.events.filter((event) => {
          if (where?.decision !== undefined && event.decision !== where.decision) {
            return false
          }
          if (where?.occurredAt?.gte && event.occurredAt.getTime() < where.occurredAt.gte.getTime()) {
            return false
          }
          return true
        }).length
      },
    },
  }

  return {
    client,
    reset,
    seedRole,
    seedEmployee,
    seedUser,
    seedCredential,
    seedArea,
    seedDevice,
    seedEvent,
    getUserAccount,
    getUserRoleAssignments,
  }
}

const fake = createFakePrisma()
prismaHolder.current = fake.client

// ---------------------------------------------------------------------------
// Test app and fixtures
// ---------------------------------------------------------------------------

const ADMIN_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const AUDITOR_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const DISABLED_USER_ID = 'abababab-abab-4bab-8bab-abababababab'
const UNKNOWN_USER_ID = '34343434-3434-4434-8434-343434343434'

const ADMIN_AUTH_USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const AUDITOR_AUTH_USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const CREATED_AUTH_USER_ID = '12121212-1212-4212-8212-121212121212'
const DISABLED_AUTH_USER_ID = '56565656-5656-4565-8565-565656565656'

const ADMIN_EMPLOYEE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const AUDITOR_EMPLOYEE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const UNLINKED_EMPLOYEE_ID = '99999999-9999-4999-8999-999999999999'
const INACTIVE_EMPLOYEE_ID = '45454545-4545-4545-8545-454545454545'

const adminUser: AuthenticatedUser = {
  id: ADMIN_USER_ID,
  authUserId: ADMIN_AUTH_USER_ID,
  employeeId: ADMIN_EMPLOYEE_ID,
  email: 'admin@example.com',
  status: 'active',
  roles: ['admin'],
}

const auditorUser: AuthenticatedUser = {
  id: AUDITOR_USER_ID,
  authUserId: AUDITOR_AUTH_USER_ID,
  employeeId: AUDITOR_EMPLOYEE_ID,
  email: 'auditor@example.com',
  status: 'active',
  roles: ['auditor'],
}

const operatorUser: AuthenticatedUser = {
  id: '77777777-7777-4777-8777-777777777777',
  authUserId: '88888888-8888-4888-8888-888888888888',
  employeeId: null,
  email: 'operator@example.com',
  status: 'active',
  roles: ['operator'],
}

const employeeOnlyUser: AuthenticatedUser = {
  id: '66666666-6666-4666-8666-666666666666',
  authUserId: '65656565-6565-4565-8565-656565656565',
  employeeId: UNLINKED_EMPLOYEE_ID,
  email: 'employee.only@example.com',
  status: 'active',
  roles: [],
}

const disabledUser: AuthenticatedUser = {
  id: DISABLED_USER_ID,
  authUserId: DISABLED_AUTH_USER_ID,
  employeeId: null,
  email: 'disabled@example.com',
  status: 'disabled',
  roles: ['admin'],
}

const missingLocalUser: AuthenticatedUser = {
  id: UNKNOWN_USER_ID,
  authUserId: '10101010-1010-4010-8010-101010101010',
  employeeId: null,
  email: 'missing@example.com',
  status: 'active',
  roles: [],
}

function createTestApp(): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/auth', authRouter)
  app.use('/roles', rolesRouter)
  app.use('/users', usersRouter)
  app.use('/dashboard', dashboardRouter)
  app.use(errorHandler)
  return app
}

const app = createTestApp()

function seedBaseData(): void {
  fake.seedRole({
    code: 'admin',
    name: 'Administrador',
    description: 'Acceso completo a la administracion del sistema',
    isSystem: true,
  })
  fake.seedRole({
    code: 'operator',
    name: 'Operador',
    description: 'Gestion de empleados, tarjetas, permisos y dispositivos',
    isSystem: true,
  })
  fake.seedRole({
    code: 'auditor',
    name: 'Auditor',
    description: 'Consulta del historial de accesos y reportes',
    isSystem: true,
  })

  fake.seedEmployee({
    id: ADMIN_EMPLOYEE_ID,
    employeeCode: 'E-0001',
    firstName: 'Ana',
    lastName: 'Admin',
  })
  fake.seedEmployee({
    id: AUDITOR_EMPLOYEE_ID,
    employeeCode: 'E-0002',
    firstName: 'Alicia',
    lastName: 'Auditor',
  })
  fake.seedEmployee({
    id: UNLINKED_EMPLOYEE_ID,
    employeeCode: 'E-0003',
    firstName: 'Nuevo',
    lastName: 'Empleado',
  })

  fake.seedUser({
    id: ADMIN_USER_ID,
    authUserId: ADMIN_AUTH_USER_ID,
    employeeId: ADMIN_EMPLOYEE_ID,
    email: 'admin@example.com',
    status: 'active',
    lastLoginAt: null,
    roleCodes: ['admin'],
  })
  fake.seedUser({
    id: AUDITOR_USER_ID,
    authUserId: AUDITOR_AUTH_USER_ID,
    employeeId: AUDITOR_EMPLOYEE_ID,
    email: 'auditor@example.com',
    status: 'active',
    lastLoginAt: new Date(),
    roleCodes: ['auditor'],
  })
}

beforeEach(() => {
  fake.reset()
  seedBaseData()
  setAuthTokenResolver(async (token) => {
    if (token === 'admin-token') {
      return adminUser
    }
    if (token === 'auditor-token') {
      return auditorUser
    }
    if (token === 'operator-token') {
      return operatorUser
    }
    if (token === 'employee-token') {
      return employeeOnlyUser
    }
    if (token === 'disabled-token') {
      return disabledUser
    }
    if (token === 'missing-local-token') {
      return missingLocalUser
    }
    return null
  })
})

afterEach(() => {
  setAuthTokenResolver(null)
})

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('GET /auth/me', () => {
  it('rejects requests without a token', async () => {
    const response = await request(app).get('/auth/me')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  })

  it('rejects invalid or non-bearer tokens with 401', async () => {
    const invalidToken = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')

    expect(invalidToken.status).toBe(401)
    expect(invalidToken.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    })

    const basicHeader = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz')

    expect(basicHeader.status).toBe(401)
    expect(basicHeader.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  })

  it('forbids disabled accounts with 403', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer disabled-token')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Account is not active' },
    })
  })

  it('returns 404 when the authenticated account is missing in the local database', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer missing-local-token')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'User account not found' },
    })
  })

  it('returns the authenticated profile and refreshes lastLoginAt', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer admin-token')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: ADMIN_USER_ID,
      authUserId: ADMIN_AUTH_USER_ID,
      employeeId: ADMIN_EMPLOYEE_ID,
      email: 'admin@example.com',
      status: 'active',
      roles: ['admin'],
    })
    expect(typeof response.body.lastLoginAt).toBe('string')
    expect(fake.getUserAccount(ADMIN_USER_ID)?.lastLoginAt).toBeInstanceOf(Date)
  })

  it('does not rewrite a recent lastLoginAt', async () => {
    const initialLastLogin = fake.getUserAccount(AUDITOR_USER_ID)?.lastLoginAt?.getTime()
    expect(typeof initialLastLogin).toBe('number')

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer auditor-token')

    expect(response.status).toBe(200)
    expect(response.body.roles).toEqual(['auditor'])
    expect(fake.getUserAccount(AUDITOR_USER_ID)?.lastLoginAt?.getTime()).toBe(initialLastLogin)
  })

  it('refreshes lastLoginAt when the previous timestamp is older than 5 minutes', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    const auditorRecord = fake.getUserAccount(AUDITOR_USER_ID)
    if (auditorRecord) {
      auditorRecord.lastLoginAt = tenMinutesAgo
    }

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer auditor-token')

    expect(response.status).toBe(200)
    const updatedLogin = fake.getUserAccount(AUDITOR_USER_ID)?.lastLoginAt
    expect(updatedLogin).toBeInstanceOf(Date)
    expect(updatedLogin?.getTime()).toBeGreaterThan(tenMinutesAgo.getTime())
  })
})

// ---------------------------------------------------------------------------
// Roles and RBAC
// ---------------------------------------------------------------------------

describe('roles and RBAC', () => {
  it('requires authentication on GET /roles', async () => {
    const response = await request(app).get('/roles')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  })

  it('lists the role catalog ordered by code for admins', async () => {
    const response = await request(app)
      .get('/roles')
      .set('Authorization', 'Bearer admin-token')

    expect(response.status).toBe(200)
    expect(response.body.map((role: { code: string }) => role.code)).toEqual([
      'admin',
      'auditor',
      'operator',
    ])
    expect(response.body[0]).toMatchObject({
      code: 'admin',
      name: 'Administrador',
      isSystem: true,
    })
  })

  it.each(['auditor-token', 'operator-token', 'employee-token'])(
    'forbids non-admin token (%s) from reading the role catalog',
    async (token) => {
      const response = await request(app)
        .get('/roles')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(403)
      expect(response.body).toEqual({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      })
    },
  )

  it.each(['auditor-token', 'operator-token', 'employee-token'])(
    'forbids non-admin token (%s) from all /users endpoints',
    async (token) => {
      const listRes = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
      expect(listRes.status).toBe(403)

      const detailRes = await request(app)
        .get(`/users/${AUDITOR_USER_ID}`)
        .set('Authorization', `Bearer ${token}`)
      expect(detailRes.status).toBe(403)

      const createRes = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          authUserId: CREATED_AUTH_USER_ID,
          email: 'blocked.user@example.com',
        })
      expect(createRes.status).toBe(403)
      expect(createRes.body).toEqual({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      })

      const patchRes = await request(app)
        .patch(`/users/${AUDITOR_USER_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'disabled' })
      expect(patchRes.status).toBe(403)
    },
  )

  it.each(['admin-token', 'operator-token', 'auditor-token'])(
    'allows %s to read the dashboard summary',
    async (token) => {
      const response = await request(app)
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        employees: { total: 3, active: 3 },
        devices: { total: 0, active: 0, outOfSync: 0 },
      })
    },
  )

  it('forbids employee-only accounts without administrative roles from the dashboard summary', async () => {
    const response = await request(app)
      .get('/dashboard/summary')
      .set('Authorization', 'Bearer employee-token')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    })
  })
})

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

describe('users administration', () => {
  it('lists user accounts with pagination', async () => {
    const response = await request(app)
      .get('/users?page=1&pageSize=1')
      .set('Authorization', 'Bearer admin-token')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    })
  })

  it('filters user accounts by status and search text across email, employeeCode, firstName and lastName', async () => {
    fake.seedUser({
      id: DISABLED_USER_ID,
      authUserId: DISABLED_AUTH_USER_ID,
      email: 'disabled.user@example.com',
      employeeId: null,
      status: 'disabled',
      roleCodes: [],
    })

    const byStatus = await request(app)
      .get('/users?status=disabled')
      .set('Authorization', 'Bearer admin-token')

    expect(byStatus.status).toBe(200)
    expect(byStatus.body.data).toHaveLength(1)
    expect(byStatus.body.data[0]).toMatchObject({
      id: DISABLED_USER_ID,
      status: 'disabled',
    })

    const bySearch = await request(app)
      .get('/users?search=auditor@example.com')
      .set('Authorization', 'Bearer admin-token')

    expect(bySearch.status).toBe(200)
    expect(bySearch.body.data).toHaveLength(1)
    expect(bySearch.body.data[0].id).toBe(AUDITOR_USER_ID)

    const byEmployeeCode = await request(app)
      .get('/users?search=E-0001')
      .set('Authorization', 'Bearer admin-token')

    expect(byEmployeeCode.status).toBe(200)
    expect(byEmployeeCode.body.data).toHaveLength(1)
    expect(byEmployeeCode.body.data[0].id).toBe(ADMIN_USER_ID)

    const byFirstName = await request(app)
      .get('/users?search=Alicia')
      .set('Authorization', 'Bearer admin-token')

    expect(byFirstName.status).toBe(200)
    expect(byFirstName.body.data).toHaveLength(1)
    expect(byFirstName.body.data[0].id).toBe(AUDITOR_USER_ID)
  })

  it('returns a user account detail and 404 for unknown ids', async () => {
    const found = await request(app)
      .get(`/users/${AUDITOR_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')

    expect(found.status).toBe(200)
    expect(found.body).toMatchObject({
      id: AUDITOR_USER_ID,
      roles: ['auditor'],
    })

    const missing = await request(app)
      .get(`/users/${UNKNOWN_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')

    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('creates a user account and records deduplicated role assignments', async () => {
    const response = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer admin-token')
      .send({
        authUserId: CREATED_AUTH_USER_ID,
        email: 'new.user@example.com',
        employeeId: UNLINKED_EMPLOYEE_ID,
        roleCodes: ['operator', 'auditor', 'operator'],
      })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      authUserId: CREATED_AUTH_USER_ID,
      email: 'new.user@example.com',
      employeeId: UNLINKED_EMPLOYEE_ID,
      status: 'active',
      roles: ['auditor', 'operator'],
    })
    expect(fake.getUserAccount(response.body.id)).toBeDefined()

    const assignments = fake.getUserRoleAssignments(response.body.id)
    expect(assignments).toHaveLength(2)
    expect(assignments).toEqual(
      expect.arrayContaining([
        { roleCode: 'operator', assignedById: ADMIN_USER_ID },
        { roleCode: 'auditor', assignedById: ADMIN_USER_ID },
      ]),
    )
  })

  it('rejects accounts whose auth user, email or employee is already linked', async () => {
    const byAuthUser = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer admin-token')
      .send({
        authUserId: ADMIN_AUTH_USER_ID,
        email: 'another.user@example.com',
      })

    expect(byAuthUser.status).toBe(409)
    expect(byAuthUser.body).toMatchObject({ error: { code: 'CONFLICT' } })

    const byEmail = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer admin-token')
      .send({
        authUserId: CREATED_AUTH_USER_ID,
        email: 'admin@example.com',
      })

    expect(byEmail.status).toBe(409)
    expect(byEmail.body).toMatchObject({ error: { code: 'CONFLICT' } })

    const byEmployee = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer admin-token')
      .send({
        authUserId: CREATED_AUTH_USER_ID,
        email: 'employee.conflict@example.com',
        employeeId: ADMIN_EMPLOYEE_ID,
      })

    expect(byEmployee.status).toBe(409)
    expect(byEmployee.body).toMatchObject({ error: { code: 'CONFLICT' } })
  })

  it('rejects unknown role codes and non-existent employeeId on create', async () => {
    const unknownRoles = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer admin-token')
      .send({
        authUserId: CREATED_AUTH_USER_ID,
        email: 'new.user@example.com',
        roleCodes: ['operator', 'superuser'],
      })

    expect(unknownRoles.status).toBe(400)
    expect(unknownRoles.body).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'Unknown role codes',
        details: { roleCodes: ['superuser'] },
      },
    })

    const unknownEmployee = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer admin-token')
      .send({
        authUserId: CREATED_AUTH_USER_ID,
        email: 'new.user@example.com',
        employeeId: UNKNOWN_USER_ID,
      })

    expect(unknownEmployee.status).toBe(400)
    expect(unknownEmployee.body).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'employeeId does not reference an existing employee',
      },
    })
  })

  it('validates query, params and body payloads on /users routes', async () => {
    const badListQuery = await request(app)
      .get('/users?status=invalid&page=0')
      .set('Authorization', 'Bearer admin-token')

    expect(badListQuery.status).toBe(400)
    expect(badListQuery.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload' },
    })
    expect(Array.isArray(badListQuery.body.error.details)).toBe(true)

    const badGetId = await request(app)
      .get('/users/not-a-uuid')
      .set('Authorization', 'Bearer admin-token')

    expect(badGetId.status).toBe(400)
    expect(badGetId.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload' },
    })

    const badCreateBody = await request(app)
      .post('/users')
      .set('Authorization', 'Bearer admin-token')
      .send({
        authUserId: 'not-a-uuid',
        email: 'not-an-email',
      })

    expect(badCreateBody.status).toBe(400)
    expect(badCreateBody.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload' },
    })

    const emptyPatchBody = await request(app)
      .patch(`/users/${AUDITOR_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')
      .send({})

    expect(emptyPatchBody.status).toBe(400)
    expect(emptyPatchBody.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload' },
    })
  })

  it('updates status, unlinks the employee and replaces role assignments', async () => {
    const response = await request(app)
      .patch(`/users/${AUDITOR_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'disabled',
        employeeId: null,
        roleCodes: ['operator'],
      })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: AUDITOR_USER_ID,
      status: 'disabled',
      employeeId: null,
      roles: ['operator'],
    })
    expect(fake.getUserRoleAssignments(AUDITOR_USER_ID)).toEqual([
      { roleCode: 'operator', assignedById: ADMIN_USER_ID },
    ])

    const clearRoles = await request(app)
      .patch(`/users/${AUDITOR_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        employeeId: UNLINKED_EMPLOYEE_ID,
        roleCodes: [],
      })

    expect(clearRoles.status).toBe(200)
    expect(clearRoles.body).toMatchObject({
      id: AUDITOR_USER_ID,
      employeeId: UNLINKED_EMPLOYEE_ID,
      roles: [],
    })
  })

  it('rejects conflicting or non-existent employeeId and unknown roles on update', async () => {
    const conflictEmployee = await request(app)
      .patch(`/users/${AUDITOR_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ employeeId: ADMIN_EMPLOYEE_ID })

    expect(conflictEmployee.status).toBe(409)
    expect(conflictEmployee.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'employeeId is already linked to a user account' },
    })

    const sameEmployee = await request(app)
      .patch(`/users/${AUDITOR_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ employeeId: AUDITOR_EMPLOYEE_ID })

    expect(sameEmployee.status).toBe(200)
    expect(sameEmployee.body.employeeId).toBe(AUDITOR_EMPLOYEE_ID)

    const missingEmployee = await request(app)
      .patch(`/users/${AUDITOR_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ employeeId: UNKNOWN_USER_ID })

    expect(missingEmployee.status).toBe(400)
    expect(missingEmployee.body).toMatchObject({
      error: {
        code: 'BAD_REQUEST',
        message: 'employeeId does not reference an existing employee',
      },
    })

    const badRoleUpdate = await request(app)
      .patch(`/users/${AUDITOR_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ roleCodes: ['nonexistent'] })

    expect(badRoleUpdate.status).toBe(400)
    expect(badRoleUpdate.body).toMatchObject({
      error: { code: 'BAD_REQUEST', message: 'Unknown role codes' },
    })
  })

  it('returns 404 when updating an unknown account', async () => {
    const response = await request(app)
      .patch(`/users/${UNKNOWN_USER_ID}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ status: 'disabled' })

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })
})

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

describe('GET /dashboard/summary', () => {
  it('requires authentication', async () => {
    const response = await request(app).get('/dashboard/summary')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
  })

  it('computes aggregate counts including out-of-sync devices', async () => {
    fake.seedEmployee({
      id: INACTIVE_EMPLOYEE_ID,
      employeeCode: 'E-0004',
      firstName: 'Inactivo',
      lastName: 'Empleado',
      status: 'inactive',
    })

    fake.seedCredential({ status: 'active' })
    fake.seedCredential({ status: 'active' })
    fake.seedCredential({ status: 'blocked' })
    fake.seedCredential({ status: 'lost' })
    fake.seedCredential({ status: 'retired' })

    fake.seedArea({ isActive: true })
    fake.seedArea({ isActive: true })
    fake.seedArea({ isActive: false })

    fake.seedDevice({ status: 'active', configVersion: 5n, syncVersion: 5n })
    fake.seedDevice({ status: 'active', configVersion: 6n, syncVersion: 5n })
    fake.seedDevice({ status: 'active', configVersion: 2n })
    fake.seedDevice({ status: 'inactive', configVersion: 9n, syncVersion: 1n })

    const now = Date.now()
    fake.seedEvent({ decision: 'granted', occurredAt: new Date(now - 60 * 60 * 1000) })
    fake.seedEvent({ decision: 'granted', occurredAt: new Date(now - 2 * 60 * 60 * 1000) })
    fake.seedEvent({ decision: 'granted', occurredAt: new Date(now - 3 * 60 * 60 * 1000) })
    fake.seedEvent({ decision: 'denied', occurredAt: new Date(now - 4 * 60 * 60 * 1000) })
    fake.seedEvent({ decision: 'denied', occurredAt: new Date(now - 5 * 60 * 60 * 1000) })
    fake.seedEvent({ decision: 'granted', occurredAt: new Date(now - 48 * 60 * 60 * 1000) })

    const response = await request(app)
      .get('/dashboard/summary')
      .set('Authorization', 'Bearer auditor-token')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      employees: { total: 4, active: 3 },
      credentials: { total: 5, active: 2, blockedOrLost: 2 },
      areas: { total: 3, active: 2 },
      devices: { total: 4, active: 3, outOfSync: 2 },
      recentEvents24h: { granted: 3, denied: 2 },
    })
  })
})
