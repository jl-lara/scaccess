import express from 'express'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { setAuthTokenResolver, type AuthenticatedUser } from '../src/middleware/auth.js'
import { createAccessPermissionsRouter } from '../src/modules/access-permissions/access-permissions.routes.js'
import {
  createAccessPermissionsService,
  createPrismaAccessPermissionStore,
  type AccessPermissionListFilters,
  type AccessPermissionRecord,
  type AccessPermissionStore,
  type CreateAccessPermissionInput,
} from '../src/modules/access-permissions/access-permissions.service.js'
import { createAreasRouter } from '../src/modules/areas/areas.routes.js'
import {
  createAreasService,
  createPrismaAreaStore,
  type AreaListFilters,
  type AreaRecord,
  type AreaStore,
  type CreateAreaInput,
  type UpdateAreaInput,
} from '../src/modules/areas/areas.service.js'
import { createCredentialsRouter } from '../src/modules/credentials/credentials.routes.js'
import {
  createCredentialsService,
  createPrismaCredentialStore,
  type CreateCredentialInput,
  type CredentialListFilters,
  type CredentialRecord,
  type CredentialStore,
  type UpdateCredentialInput,
} from '../src/modules/credentials/credentials.service.js'
import { createEmployeesRouter } from '../src/modules/employees/employees.routes.js'
import {
  createEmployeesService,
  createPrismaEmployeeStore,
  type CreateEmployeeInput,
  type EmployeeListFilters,
  type EmployeeRecord,
  type EmployeeStore,
  type UpdateEmployeeInput,
} from '../src/modules/employees/employees.service.js'
import type { PaginationQuery } from '../src/utils/pagination.js'

const prismaHolder = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('../src/config/prisma.js', () => ({
  getPrismaClient: () => prismaHolder.current,
  disconnectPrisma: async () => undefined,
}))

const AREA_1_ID = '11111111-1111-4111-8111-111111111111'
const AREA_2_ID = '22222222-2222-4222-8222-222222222222'
const EMPLOYEE_1_ID = '33333333-3333-4333-8333-333333333333'
const EMPLOYEE_2_ID = '44444444-4444-4444-8444-444444444444'
const CREDENTIAL_1_ID = '55555555-5555-4555-8555-555555555555'
const PERMISSION_1_ID = '66666666-6666-4666-8666-666666666666'
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

const adminUser: AuthenticatedUser = {
  id: 'user-admin',
  authUserId: 'auth-user-admin',
  employeeId: null,
  email: 'admin@example.com',
  status: 'active',
  roles: ['admin'],
}

const operatorUser: AuthenticatedUser = {
  id: 'user-operator',
  authUserId: 'auth-user-operator',
  employeeId: null,
  email: 'operator@example.com',
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

const employeeOnlyUser: AuthenticatedUser = {
  id: 'user-employee',
  authUserId: 'auth-user-employee',
  employeeId: EMPLOYEE_1_ID,
  email: 'ana@example.com',
  status: 'active',
  roles: [],
}

const disabledUser: AuthenticatedUser = {
  id: 'user-disabled',
  authUserId: 'auth-user-disabled',
  employeeId: null,
  email: 'disabled@example.com',
  status: 'disabled',
  roles: ['admin'],
}

const AUTHORIZATION = 'Bearer test-token'

let currentUser: AuthenticatedUser | null = adminUser

class FakeAreaStore implements AreaStore {
  private readonly areas = new Map<string, AreaRecord>()

  add(area: AreaRecord): AreaRecord {
    this.areas.set(area.id, area)
    return area
  }

  async list(filters: AreaListFilters, pagination: PaginationQuery) {
    let items = [...this.areas.values()]

    if (filters.isActive !== undefined) {
      items = items.filter((area) => area.isActive === filters.isActive)
    }

    if (filters.search) {
      const search = filters.search.toLowerCase()
      items = items.filter(
        (area) =>
          area.code.toLowerCase().includes(search) || area.name.toLowerCase().includes(search),
      )
    }

    items.sort((left, right) => left.code.localeCompare(right.code))

    return paginate(items, pagination)
  }

  async findById(id: string): Promise<AreaRecord | null> {
    return this.areas.get(id) ?? null
  }

  async findByCode(code: string): Promise<AreaRecord | null> {
    return [...this.areas.values()].find((area) => area.code === code) ?? null
  }

  async create(input: CreateAreaInput): Promise<AreaRecord> {
    const now = new Date()
    const area: AreaRecord = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      timezone: input.timezone ?? 'America/Tijuana',
      createdAt: now,
      updatedAt: now,
    }

    this.areas.set(area.id, area)
    return area
  }

  async update(id: string, input: UpdateAreaInput): Promise<AreaRecord | null> {
    const current = this.areas.get(id)

    if (!current) {
      return null
    }

    const updated: AreaRecord = {
      ...current,
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      updatedAt: new Date(),
    }

    this.areas.set(id, updated)
    return updated
  }
}

class FakeEmployeeStore implements EmployeeStore {
  private readonly employees = new Map<string, EmployeeRecord>()

  add(employee: EmployeeRecord): EmployeeRecord {
    this.employees.set(employee.id, employee)
    return employee
  }

  async list(filters: EmployeeListFilters, pagination: PaginationQuery) {
    let items = [...this.employees.values()]

    if (filters.status !== undefined) {
      items = items.filter((employee) => employee.status === filters.status)
    }

    if (filters.department) {
      const department = filters.department.toLowerCase()
      items = items.filter(
        (employee) => employee.department?.toLowerCase() === department,
      )
    }

    if (filters.search) {
      const search = filters.search.toLowerCase()
      items = items.filter((employee) =>
        [employee.employeeCode, employee.firstName, employee.lastName, employee.email ?? ''].some(
          (value) => value.toLowerCase().includes(search),
        ),
      )
    }

    items.sort((left, right) => left.employeeCode.localeCompare(right.employeeCode))

    return paginate(items, pagination)
  }

  async findById(id: string): Promise<EmployeeRecord | null> {
    return this.employees.get(id) ?? null
  }

  async findByEmployeeCode(employeeCode: string): Promise<EmployeeRecord | null> {
    return (
      [...this.employees.values()].find(
        (employee) => employee.employeeCode === employeeCode,
      ) ?? null
    )
  }

  async findByEmail(email: string): Promise<EmployeeRecord | null> {
    return [...this.employees.values()].find((employee) => employee.email === email) ?? null
  }

  async create(input: CreateEmployeeInput): Promise<EmployeeRecord> {
    const now = new Date()
    const employee: EmployeeRecord = {
      id: randomUUID(),
      employeeCode: input.employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      department: input.department ?? null,
      position: input.position ?? null,
      status: input.status ?? 'active',
      hiredAt: input.hiredAt ?? null,
      deactivatedAt: input.deactivatedAt ?? null,
      createdAt: now,
      updatedAt: now,
    }

    this.employees.set(employee.id, employee)
    return employee
  }

  async update(
    id: string,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeRecord | null> {
    const current = this.employees.get(id)

    if (!current) {
      return null
    }

    const updated: EmployeeRecord = {
      ...current,
      ...(input.employeeCode === undefined ? {} : { employeeCode: input.employeeCode }),
      ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
      ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.department === undefined ? {} : { department: input.department }),
      ...(input.position === undefined ? {} : { position: input.position }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.hiredAt === undefined ? {} : { hiredAt: input.hiredAt }),
      ...(input.deactivatedAt === undefined ? {} : { deactivatedAt: input.deactivatedAt }),
      updatedAt: new Date(),
    }

    this.employees.set(id, updated)
    return updated
  }
}

class FakeCredentialStore implements CredentialStore {
  private readonly credentials = new Map<string, CredentialRecord>()

  add(credential: CredentialRecord): CredentialRecord {
    this.credentials.set(credential.id, credential)
    return credential
  }

  async list(filters: CredentialListFilters, pagination: PaginationQuery) {
    let items = [...this.credentials.values()]

    if (filters.employeeId !== undefined) {
      items = items.filter((credential) => credential.employeeId === filters.employeeId)
    }

    if (filters.status !== undefined) {
      items = items.filter((credential) => credential.status === filters.status)
    }

    if (filters.cardUid !== undefined) {
      items = items.filter((credential) => credential.cardUid === filters.cardUid)
    }

    items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

    return paginate(items, pagination)
  }

  async findById(id: string): Promise<CredentialRecord | null> {
    return this.credentials.get(id) ?? null
  }

  async findByCardUid(cardUid: string): Promise<CredentialRecord | null> {
    return (
      [...this.credentials.values()].find(
        (credential) => credential.cardUid === cardUid,
      ) ?? null
    )
  }

  async create(input: CreateCredentialInput): Promise<CredentialRecord> {
    const now = new Date()
    const credential: CredentialRecord = {
      id: randomUUID(),
      employeeId: input.employeeId,
      cardUid: input.cardUid,
      label: input.label ?? null,
      status: input.status ?? 'active',
      issuedAt: input.issuedAt ?? null,
      deactivatedAt: input.deactivatedAt ?? null,
      deactivationReason: null,
      createdAt: now,
      updatedAt: now,
    }

    this.credentials.set(credential.id, credential)
    return credential
  }

  async update(
    id: string,
    input: UpdateCredentialInput,
  ): Promise<CredentialRecord | null> {
    const current = this.credentials.get(id)

    if (!current) {
      return null
    }

    const updated: CredentialRecord = {
      ...current,
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.deactivatedAt === undefined
        ? {}
        : { deactivatedAt: input.deactivatedAt }),
      ...(input.deactivationReason === undefined
        ? {}
        : { deactivationReason: input.deactivationReason }),
      updatedAt: new Date(),
    }

    this.credentials.set(id, updated)
    return updated
  }
}

class FakeAccessPermissionStore implements AccessPermissionStore {
  private readonly permissions = new Map<string, AccessPermissionRecord>()

  add(permission: AccessPermissionRecord): AccessPermissionRecord {
    this.permissions.set(permission.id, permission)
    return permission
  }

  async list(filters: AccessPermissionListFilters, pagination: PaginationQuery) {
    let items = [...this.permissions.values()]

    if (filters.employeeId !== undefined) {
      items = items.filter((permission) => permission.employeeId === filters.employeeId)
    }

    if (filters.areaId !== undefined) {
      items = items.filter((permission) => permission.areaId === filters.areaId)
    }

    if (filters.activeOnly) {
      items = items.filter((permission) => permission.revokedAt === null)
    }

    items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

    return paginate(items, pagination)
  }

  async findById(id: string): Promise<AccessPermissionRecord | null> {
    return this.permissions.get(id) ?? null
  }

  async findActive(
    employeeId: string,
    areaId: string,
  ): Promise<AccessPermissionRecord | null> {
    return (
      [...this.permissions.values()].find(
        (permission) =>
          permission.employeeId === employeeId &&
          permission.areaId === areaId &&
          permission.revokedAt === null,
      ) ?? null
    )
  }

  async create(input: CreateAccessPermissionInput): Promise<AccessPermissionRecord> {
    const now = new Date()
    const permission: AccessPermissionRecord = {
      id: randomUUID(),
      employeeId: input.employeeId,
      areaId: input.areaId,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      schedule: input.schedule ?? null,
      revokedAt: null,
      grantedById: input.grantedById ?? null,
      createdAt: now,
      updatedAt: now,
    }

    this.permissions.set(permission.id, permission)
    return permission
  }

  async revoke(id: string, revokedAt: Date): Promise<AccessPermissionRecord | null> {
    const current = this.permissions.get(id)

    if (!current) {
      return null
    }

    const updated: AccessPermissionRecord = {
      ...current,
      revokedAt,
      updatedAt: new Date(),
    }

    this.permissions.set(id, updated)
    return updated
  }
}

interface TestContext {
  app: express.Express
  areaStore: FakeAreaStore
  employeeStore: FakeEmployeeStore
  credentialStore: FakeCredentialStore
  permissionStore: FakeAccessPermissionStore
  areaBump: ReturnType<typeof vi.fn>
  employeeBump: ReturnType<typeof vi.fn>
  credentialBump: ReturnType<typeof vi.fn>
  permissionBump: ReturnType<typeof vi.fn>
}

function paginate<T>(items: T[], pagination: PaginationQuery) {
  const skip = (pagination.page - 1) * pagination.pageSize

  return {
    items: items.slice(skip, skip + pagination.pageSize),
    total: items.length,
  }
}

function createTestApp(): TestContext {
  const areaStore = new FakeAreaStore()
  const employeeStore = new FakeEmployeeStore()
  const credentialStore = new FakeCredentialStore()
  const permissionStore = new FakeAccessPermissionStore()

  const areaBump = vi.fn(async (_areaIds?: string[]): Promise<void> => {})
  const employeeBump = vi.fn(async (_areaIds?: string[]): Promise<void> => {})
  const credentialBump = vi.fn(async (_areaIds?: string[]): Promise<void> => {})
  const permissionBump = vi.fn(async (_areaIds?: string[]): Promise<void> => {})

  const app = express()
  app.use(express.json())

  app.use(
    '/areas',
    createAreasRouter(createAreasService(areaStore, areaBump)),
  )
  app.use(
    '/employees',
    createEmployeesRouter(createEmployeesService(employeeStore, employeeBump)),
  )
  app.use(
    '/credentials',
    createCredentialsRouter(createCredentialsService(credentialStore, credentialBump)),
  )
  app.use(
    '/access-permissions',
    createAccessPermissionsRouter(
      createAccessPermissionsService(permissionStore, permissionBump),
    ),
  )

  app.use(errorHandler)

  return {
    app,
    areaStore,
    employeeStore,
    credentialStore,
    permissionStore,
    areaBump,
    employeeBump,
    credentialBump,
    permissionBump,
  }
}

function areaRecord(overrides: Partial<AreaRecord> = {}): AreaRecord {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')

  return {
    id: AREA_1_ID,
    code: 'LAB',
    name: 'Laboratorio',
    description: null,
    isActive: true,
    timezone: 'America/Tijuana',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function employeeRecord(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')

  return {
    id: EMPLOYEE_1_ID,
    employeeCode: 'E-0001',
    firstName: 'Ana',
    lastName: 'Lopez',
    email: 'ana@example.com',
    department: 'Engineering',
    position: 'Developer',
    status: 'active',
    hiredAt: new Date('2024-01-15T00:00:00.000Z'),
    deactivatedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function credentialRecord(
  overrides: Partial<CredentialRecord> = {},
): CredentialRecord {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')

  return {
    id: CREDENTIAL_1_ID,
    employeeId: EMPLOYEE_1_ID,
    cardUid: 'AABBCCDD',
    label: null,
    status: 'active',
    issuedAt: timestamp,
    deactivatedAt: null,
    deactivationReason: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function permissionRecord(
  overrides: Partial<AccessPermissionRecord> = {},
): AccessPermissionRecord {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')

  return {
    id: PERMISSION_1_ID,
    employeeId: EMPLOYEE_1_ID,
    areaId: AREA_1_ID,
    validFrom: null,
    validTo: null,
    schedule: null,
    revokedAt: null,
    grantedById: adminUser.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

beforeEach(() => {
  currentUser = adminUser
  setAuthTokenResolver(async () => currentUser)
})

afterEach(() => {
  setAuthTokenResolver(null)
})

describe('areas module', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const context = createTestApp()

    const response = await request(context.app).get('/areas')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
  })

  it('lists areas with pagination, isActive and search filters', async () => {
    const context = createTestApp()
    context.areaStore.add(areaRecord())
    context.areaStore.add(
      areaRecord({ id: AREA_2_ID, code: 'STORAGE', name: 'Almacen', isActive: false }),
    )

    const inactive = await request(context.app)
      .get('/areas?isActive=false')
      .set('Authorization', AUTHORIZATION)

    expect(inactive.status).toBe(200)
    expect(inactive.body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    })
    expect(inactive.body.data).toHaveLength(1)
    expect(inactive.body.data[0].code).toBe('STORAGE')

    const searched = await request(context.app)
      .get('/areas?search=lab&pageSize=1')
      .set('Authorization', AUTHORIZATION)

    expect(searched.status).toBe(200)
    expect(searched.body.data).toHaveLength(1)
    expect(searched.body.data[0].code).toBe('LAB')
  })

  it('returns 400 for an invalid area id', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .get('/areas/not-a-uuid')
      .set('Authorization', AUTHORIZATION)

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })

  it('returns 404 for an unknown area', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .get(`/areas/${UNKNOWN_ID}`)
      .set('Authorization', AUTHORIZATION)

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Area not found' },
    })
  })

  it('creates an area and bumps the device configuration version', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .post('/areas')
      .set('Authorization', AUTHORIZATION)
      .send({
        code: 'LAB',
        name: 'Laboratorio',
        description: 'Laboratorio principal',
        timezone: 'America/Tijuana',
      })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      code: 'LAB',
      name: 'Laboratorio',
      description: 'Laboratorio principal',
      isActive: true,
      timezone: 'America/Tijuana',
    })
    expect(context.areaBump).toHaveBeenCalledWith([response.body.id])
  })

  it('rejects duplicate area codes with 409', async () => {
    const context = createTestApp()
    context.areaStore.add(areaRecord())

    const response = await request(context.app)
      .post('/areas')
      .set('Authorization', AUTHORIZATION)
      .send({ code: 'LAB', name: 'Otro laboratorio' })

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'Area code already exists' },
    })
  })

  it('forbids operators from creating areas with 403', async () => {
    currentUser = operatorUser
    const context = createTestApp()

    const response = await request(context.app)
      .post('/areas')
      .set('Authorization', AUTHORIZATION)
      .send({ code: 'LAB', name: 'Laboratorio' })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('rejects invalid area payloads with 400', async () => {
    const context = createTestApp()

    const missingName = await request(context.app)
      .post('/areas')
      .set('Authorization', AUTHORIZATION)
      .send({ code: 'LAB' })

    expect(missingName.status).toBe(400)
    expect(missingName.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })

    const emptyPatch = await request(context.app)
      .patch(`/areas/${AREA_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({})

    expect(emptyPatch.status).toBe(400)
    expect(emptyPatch.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })

  it('updates an area and bumps the device configuration version', async () => {
    const context = createTestApp()
    context.areaStore.add(areaRecord())

    const response = await request(context.app)
      .patch(`/areas/${AREA_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ name: 'Laboratorio de pruebas', isActive: false })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: AREA_1_ID,
      name: 'Laboratorio de pruebas',
      isActive: false,
    })
    expect(context.areaBump).toHaveBeenCalledWith([AREA_1_ID])
  })

  it('returns 404 when updating an unknown area', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .patch(`/areas/${UNKNOWN_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ name: 'No existe' })

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('retrieves an area by id for auditor and operator roles, and forbids employee-only accounts', async () => {
    const context = createTestApp()
    context.areaStore.add(areaRecord({ description: 'Acceso restringido' }))

    currentUser = auditorUser
    const asAuditor = await request(context.app)
      .get(`/areas/${AREA_1_ID}`)
      .set('Authorization', AUTHORIZATION)

    expect(asAuditor.status).toBe(200)
    expect(asAuditor.body).toMatchObject({
      id: AREA_1_ID,
      code: 'LAB',
      name: 'Laboratorio',
      description: 'Acceso restringido',
      isActive: true,
      timezone: 'America/Tijuana',
    })

    currentUser = operatorUser
    const asOperator = await request(context.app)
      .get(`/areas/${AREA_1_ID}`)
      .set('Authorization', AUTHORIZATION)

    expect(asOperator.status).toBe(200)

    currentUser = employeeOnlyUser
    const asEmployee = await request(context.app)
      .get(`/areas/${AREA_1_ID}`)
      .set('Authorization', AUTHORIZATION)

    expect(asEmployee.status).toBe(403)
    expect(asEmployee.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('forbids operators and auditors from updating areas, and rejects invalid query filters', async () => {
    const context = createTestApp()
    context.areaStore.add(areaRecord())

    currentUser = operatorUser
    const operatorPatch = await request(context.app)
      .patch(`/areas/${AREA_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ name: 'Intento operador' })

    expect(operatorPatch.status).toBe(403)
    expect(operatorPatch.body).toMatchObject({ error: { code: 'FORBIDDEN' } })

    currentUser = auditorUser
    const auditorPatch = await request(context.app)
      .patch(`/areas/${AREA_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ name: 'Intento auditor' })

    expect(auditorPatch.status).toBe(403)

    const invalidQuery = await request(context.app)
      .get('/areas?isActive=maybe&page=0')
      .set('Authorization', AUTHORIZATION)

    expect(invalidQuery.status).toBe(400)
    expect(invalidQuery.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })
})

describe('employees module', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const context = createTestApp()

    const response = await request(context.app).get('/employees')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
  })

  it('lists employees with status, department and search filters', async () => {
    const context = createTestApp()
    context.employeeStore.add(employeeRecord())
    context.employeeStore.add(
      employeeRecord({
        id: EMPLOYEE_2_ID,
        employeeCode: 'E-0002',
        firstName: 'Luis',
        lastName: 'Perez',
        email: 'luis@example.com',
        department: 'Operations',
        status: 'inactive',
      }),
    )

    const inactive = await request(context.app)
      .get('/employees?status=inactive')
      .set('Authorization', AUTHORIZATION)

    expect(inactive.status).toBe(200)
    expect(inactive.body.pagination.total).toBe(1)
    expect(inactive.body.data[0].employeeCode).toBe('E-0002')

    const byDepartment = await request(context.app)
      .get('/employees?department=engineering')
      .set('Authorization', AUTHORIZATION)

    expect(byDepartment.body.pagination.total).toBe(1)
    expect(byDepartment.body.data[0].employeeCode).toBe('E-0001')

    const bySearch = await request(context.app)
      .get('/employees?search=luis')
      .set('Authorization', AUTHORIZATION)

    expect(bySearch.body.pagination.total).toBe(1)
    expect(bySearch.body.data[0].employeeCode).toBe('E-0002')
  })

  it('creates an employee with an operator account and bumps the configuration', async () => {
    currentUser = operatorUser
    const context = createTestApp()

    const response = await request(context.app)
      .post('/employees')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeCode: 'E-0100',
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria@example.com',
        department: 'Engineering',
        position: 'Analyst',
        hiredAt: '2024-01-15',
      })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      employeeCode: 'E-0100',
      firstName: 'Maria',
      lastName: 'Garcia',
      email: 'maria@example.com',
      status: 'active',
      deactivatedAt: null,
    })
    expect(response.body.hiredAt).toBe('2024-01-15T00:00:00.000Z')
    expect(context.employeeBump).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate employee codes with 409', async () => {
    const context = createTestApp()
    context.employeeStore.add(employeeRecord())

    const response = await request(context.app)
      .post('/employees')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeCode: 'E-0001', firstName: 'Ana', lastName: 'Lopez' })

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'Employee code already exists' },
    })
  })

  it('rejects invalid employee payloads with 400', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .post('/employees')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeCode: 'E-0200', firstName: 'Sin apellido', email: 'not-an-email' })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })

  it('forbids auditors from creating employees with 403', async () => {
    currentUser = auditorUser
    const context = createTestApp()

    const response = await request(context.app)
      .post('/employees')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeCode: 'E-0300', firstName: 'Ana', lastName: 'Lopez' })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('returns 404 for an unknown employee', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .get(`/employees/${UNKNOWN_ID}`)
      .set('Authorization', AUTHORIZATION)

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Employee not found' },
    })
  })

  it('soft-deactivates and reactivates an employee', async () => {
    const context = createTestApp()
    context.employeeStore.add(employeeRecord())

    const deactivated = await request(context.app)
      .patch(`/employees/${EMPLOYEE_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ status: 'inactive' })

    expect(deactivated.status).toBe(200)
    expect(deactivated.body.status).toBe('inactive')
    expect(deactivated.body.deactivatedAt).toEqual(expect.any(String))
    expect(context.employeeBump).toHaveBeenCalledTimes(1)

    const reactivated = await request(context.app)
      .patch(`/employees/${EMPLOYEE_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ status: 'active' })

    expect(reactivated.status).toBe(200)
    expect(reactivated.body.status).toBe('active')
    expect(reactivated.body.deactivatedAt).toBeNull()
    expect(context.employeeBump).toHaveBeenCalledTimes(2)
    await expect(context.employeeStore.findById(EMPLOYEE_1_ID)).resolves.toMatchObject({
      status: 'active',
      deactivatedAt: null,
    })
  })

  it('rejects invalid employee status values with 400', async () => {
    const context = createTestApp()
    context.employeeStore.add(employeeRecord())

    const response = await request(context.app)
      .patch(`/employees/${EMPLOYEE_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ status: 'fired' })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })

  it('retrieves an employee by id and enforces uniqueness of email and employeeCode on create and update', async () => {
    const context = createTestApp()
    context.employeeStore.add(employeeRecord())
    context.employeeStore.add(
      employeeRecord({
        id: EMPLOYEE_2_ID,
        employeeCode: 'E-0002',
        firstName: 'Luis',
        lastName: 'Perez',
        email: 'luis@example.com',
      }),
    )

    const getRes = await request(context.app)
      .get(`/employees/${EMPLOYEE_1_ID}`)
      .set('Authorization', AUTHORIZATION)

    expect(getRes.status).toBe(200)
    expect(getRes.body).toMatchObject({
      id: EMPLOYEE_1_ID,
      employeeCode: 'E-0001',
      email: 'ana@example.com',
    })

    const duplicateEmailCreate = await request(context.app)
      .post('/employees')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeCode: 'E-0099',
        firstName: 'Otra',
        lastName: 'Persona',
        email: 'ana@example.com',
      })

    expect(duplicateEmailCreate.status).toBe(409)
    expect(duplicateEmailCreate.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'Employee email already exists' },
    })

    const duplicateCodeUpdate = await request(context.app)
      .patch(`/employees/${EMPLOYEE_2_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ employeeCode: 'E-0001' })

    expect(duplicateCodeUpdate.status).toBe(409)
    expect(duplicateCodeUpdate.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'Employee code already exists' },
    })

    const duplicateEmailUpdate = await request(context.app)
      .patch(`/employees/${EMPLOYEE_2_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ email: 'ana@example.com' })

    expect(duplicateEmailUpdate.status).toBe(409)
    expect(duplicateEmailUpdate.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'Employee email already exists' },
    })

    // Updating an employee with their own existing code/email succeeds
    const selfUpdate = await request(context.app)
      .patch(`/employees/${EMPLOYEE_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ employeeCode: 'E-0001', email: 'ana@example.com', position: 'Tech Lead' })

    expect(selfUpdate.status).toBe(200)
    expect(selfUpdate.body.position).toBe('Tech Lead')
  })

  it('sets deactivatedAt when creating an employee directly as suspended or inactive, and enforces RBAC on update', async () => {
    const context = createTestApp()

    const createdSuspended = await request(context.app)
      .post('/employees')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeCode: 'E-0500',
        firstName: 'Carlos',
        lastName: 'Ruiz',
        status: 'suspended',
      })

    expect(createdSuspended.status).toBe(201)
    expect(createdSuspended.body.status).toBe('suspended')
    expect(createdSuspended.body.deactivatedAt).toEqual(expect.any(String))

    currentUser = auditorUser
    const auditorPatch = await request(context.app)
      .patch(`/employees/${createdSuspended.body.id}`)
      .set('Authorization', AUTHORIZATION)
      .send({ status: 'active' })

    expect(auditorPatch.status).toBe(403)
    expect(auditorPatch.body).toMatchObject({ error: { code: 'FORBIDDEN' } })

    currentUser = disabledUser
    const disabledReq = await request(context.app)
      .get('/employees')
      .set('Authorization', AUTHORIZATION)

    expect(disabledReq.status).toBe(403)
    expect(disabledReq.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Account is not active' },
    })
  })
})

describe('credentials module', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const context = createTestApp()

    const response = await request(context.app).get('/credentials')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
  })

  it('registers a credential with a normalized card UID', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .post('/credentials')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeId: EMPLOYEE_1_ID,
        cardUid: ' aa:bb-cc:dd ',
        label: 'Tarjeta principal',
      })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      employeeId: EMPLOYEE_1_ID,
      cardUid: 'AABBCCDD',
      label: 'Tarjeta principal',
      status: 'active',
      deactivatedAt: null,
    })
    expect(response.body.issuedAt).toEqual(expect.any(String))
    expect(context.credentialBump).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate card UIDs with 409', async () => {
    const context = createTestApp()
    context.credentialStore.add(credentialRecord())

    const response = await request(context.app)
      .post('/credentials')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId: EMPLOYEE_1_ID, cardUid: 'aa:bb:cc:dd' })

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'Card UID already registered' },
    })
  })

  it('rejects malformed card UIDs with 400', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .post('/credentials')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId: EMPLOYEE_1_ID, cardUid: 'not-a-uid' })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })

  it('forbids auditors from creating credentials with 403', async () => {
    currentUser = auditorUser
    const context = createTestApp()

    const response = await request(context.app)
      .post('/credentials')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId: EMPLOYEE_1_ID, cardUid: 'AABBCCDD' })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('lists credentials with normalized card UID, employee and status filters', async () => {
    const context = createTestApp()
    context.credentialStore.add(credentialRecord())
    context.credentialStore.add(
      credentialRecord({
        id: randomUUID(),
        cardUid: '11223344',
        employeeId: EMPLOYEE_2_ID,
        status: 'lost',
      }),
    )

    const byCardUid = await request(context.app)
      .get('/credentials?cardUid=aa:bb:cc:dd')
      .set('Authorization', AUTHORIZATION)

    expect(byCardUid.status).toBe(200)
    expect(byCardUid.body.pagination.total).toBe(1)
    expect(byCardUid.body.data[0].cardUid).toBe('AABBCCDD')

    const byEmployeeAndStatus = await request(context.app)
      .get(`/credentials?employeeId=${EMPLOYEE_2_ID}&status=lost`)
      .set('Authorization', AUTHORIZATION)

    expect(byEmployeeAndStatus.body.pagination.total).toBe(1)
    expect(byEmployeeAndStatus.body.data[0].cardUid).toBe('11223344')
  })

  it('returns 404 for an unknown credential', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .get(`/credentials/${UNKNOWN_ID}`)
      .set('Authorization', AUTHORIZATION)

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Credential not found' },
    })
  })

  it('deactivates and reactivates a credential', async () => {
    const context = createTestApp()
    context.credentialStore.add(credentialRecord())

    const deactivated = await request(context.app)
      .patch(`/credentials/${CREDENTIAL_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ status: 'lost', deactivationReason: 'Reported lost' })

    expect(deactivated.status).toBe(200)
    expect(deactivated.body).toMatchObject({
      status: 'lost',
      deactivationReason: 'Reported lost',
    })
    expect(deactivated.body.deactivatedAt).toEqual(expect.any(String))
    expect(context.credentialBump).toHaveBeenCalledTimes(1)

    const reactivated = await request(context.app)
      .patch(`/credentials/${CREDENTIAL_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ status: 'active' })

    expect(reactivated.status).toBe(200)
    expect(reactivated.body.status).toBe('active')
    expect(reactivated.body.deactivatedAt).toBeNull()
    expect(reactivated.body.deactivationReason).toBeNull()
    expect(context.credentialBump).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid credential status values with 400', async () => {
    const context = createTestApp()
    context.credentialStore.add(credentialRecord())

    const response = await request(context.app)
      .patch(`/credentials/${CREDENTIAL_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ status: 'expired' })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })

  it('retrieves a credential by id, validates cardUid length/hex constraints, and only bumps configVersion when status changes on update', async () => {
    const context = createTestApp()
    context.credentialStore.add(credentialRecord())

    const detail = await request(context.app)
      .get(`/credentials/${CREDENTIAL_1_ID}`)
      .set('Authorization', AUTHORIZATION)

    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({
      id: CREDENTIAL_1_ID,
      employeeId: EMPLOYEE_1_ID,
      cardUid: 'AABBCCDD',
      status: 'active',
    })

    // Updating only the label does not alter offline access rules, so configVersion is not bumped
    const labelOnly = await request(context.app)
      .patch(`/credentials/${CREDENTIAL_1_ID}`)
      .set('Authorization', AUTHORIZATION)
      .send({ label: 'Tarjeta secundaria' })

    expect(labelOnly.status).toBe(200)
    expect(labelOnly.body.label).toBe('Tarjeta secundaria')
    expect(context.credentialBump).not.toHaveBeenCalled()

    // Odd hex length or too short/long UIDs fail validation with 400
    for (const invalidUid of ['AABBCC', 'AABBCCDD0', '00112233445566778899AABBCCDDEEFF00']) {
      const badCreate = await request(context.app)
        .post('/credentials')
        .set('Authorization', AUTHORIZATION)
        .send({ employeeId: EMPLOYEE_1_ID, cardUid: invalidUid })

      expect(badCreate.status).toBe(400)
      expect(badCreate.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
    }

    // Creating a credential with an initial non-active status sets deactivatedAt
    const blockedOnCreate = await request(context.app)
      .post('/credentials')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeId: EMPLOYEE_1_ID,
        cardUid: '01:02:03:04:05:06:07:08',
        status: 'blocked',
      })

    expect(blockedOnCreate.status).toBe(201)
    expect(blockedOnCreate.body.cardUid).toBe('0102030405060708')
    expect(blockedOnCreate.body.status).toBe('blocked')
    expect(blockedOnCreate.body.deactivatedAt).toEqual(expect.any(String))
  })
})

describe('access permissions module', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const context = createTestApp()

    const response = await request(context.app).get('/access-permissions')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
  })

  it('grants a permission recording the authenticated user and bumps the area config', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeId: EMPLOYEE_1_ID,
        areaId: AREA_1_ID,
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2026-12-31T23:59:59.000Z',
        schedule: { monday: ['08:00-18:00'] },
      })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      employeeId: EMPLOYEE_1_ID,
      areaId: AREA_1_ID,
      grantedById: adminUser.id,
      revokedAt: null,
      schedule: { monday: ['08:00-18:00'] },
    })
    expect(response.body.validFrom).toBe('2026-01-01T00:00:00.000Z')
    expect(context.permissionBump).toHaveBeenCalledWith([AREA_1_ID])
  })

  it('rejects duplicate active permissions with 409', async () => {
    const context = createTestApp()
    context.permissionStore.add(permissionRecord())

    const response = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId: EMPLOYEE_1_ID, areaId: AREA_1_ID })

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      error: {
        code: 'CONFLICT',
        message: 'Active permission already exists for this employee and area',
      },
    })
  })

  it('rejects invalid payloads and inconsistent validity ranges with 400', async () => {
    const context = createTestApp()

    const invalidIds = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId: 'not-a-uuid', areaId: AREA_1_ID })

    expect(invalidIds.status).toBe(400)
    expect(invalidIds.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })

    const invalidRange = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeId: EMPLOYEE_1_ID,
        areaId: AREA_1_ID,
        validFrom: '2026-12-31T00:00:00.000Z',
        validTo: '2026-01-01T00:00:00.000Z',
      })

    expect(invalidRange.status).toBe(400)
    expect(invalidRange.body).toMatchObject({
      error: { code: 'BAD_REQUEST', message: 'validTo must be after validFrom' },
    })
  })

  it('forbids auditors from granting permissions with 403', async () => {
    currentUser = auditorUser
    const context = createTestApp()

    const response = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId: EMPLOYEE_1_ID, areaId: AREA_1_ID })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('lists permissions and filters by active status', async () => {
    const context = createTestApp()
    context.permissionStore.add(permissionRecord())
    context.permissionStore.add(
      permissionRecord({
        id: randomUUID(),
        areaId: AREA_2_ID,
        revokedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    )

    const activeOnly = await request(context.app)
      .get('/access-permissions?activeOnly=true')
      .set('Authorization', AUTHORIZATION)

    expect(activeOnly.status).toBe(200)
    expect(activeOnly.body.pagination.total).toBe(1)
    expect(activeOnly.body.data[0].areaId).toBe(AREA_1_ID)

    const all = await request(context.app)
      .get('/access-permissions')
      .set('Authorization', AUTHORIZATION)

    expect(all.body.pagination.total).toBe(2)
  })

  it('revokes a permission logically and bumps the area config', async () => {
    const context = createTestApp()
    context.permissionStore.add(permissionRecord())

    const response = await request(context.app)
      .post(`/access-permissions/${PERMISSION_1_ID}/revoke`)
      .set('Authorization', AUTHORIZATION)

    expect(response.status).toBe(200)
    expect(response.body.id).toBe(PERMISSION_1_ID)
    expect(response.body.revokedAt).toEqual(expect.any(String))
    expect(context.permissionBump).toHaveBeenCalledWith([AREA_1_ID])

    const listed = await request(context.app)
      .get('/access-permissions')
      .set('Authorization', AUTHORIZATION)

    expect(listed.body.pagination.total).toBe(1)
    expect(listed.body.data[0].revokedAt).toEqual(expect.any(String))
  })

  it('returns 404 when revoking an unknown permission', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .post(`/access-permissions/${UNKNOWN_ID}/revoke`)
      .set('Authorization', AUTHORIZATION)

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Access permission not found' },
    })
  })

  it('returns 409 when revoking an already revoked permission', async () => {
    const context = createTestApp()
    context.permissionStore.add(
      permissionRecord({ revokedAt: new Date('2026-02-01T00:00:00.000Z') }),
    )

    const response = await request(context.app)
      .post(`/access-permissions/${PERMISSION_1_ID}/revoke`)
      .set('Authorization', AUTHORIZATION)

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      error: { code: 'CONFLICT', message: 'Access permission is already revoked' },
    })
  })

  it('returns 400 for an invalid permission id', async () => {
    const context = createTestApp()

    const response = await request(context.app)
      .post('/access-permissions/not-a-uuid/revoke')
      .set('Authorization', AUTHORIZATION)

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
  })

  it('rejects equal validFrom and validTo timestamps and non-object schedules', async () => {
    const context = createTestApp()

    const equalTimestamps = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeId: EMPLOYEE_1_ID,
        areaId: AREA_1_ID,
        validFrom: '2026-06-01T12:00:00.000Z',
        validTo: '2026-06-01T12:00:00.000Z',
      })

    expect(equalTimestamps.status).toBe(400)
    expect(equalTimestamps.body).toMatchObject({
      error: { code: 'BAD_REQUEST', message: 'validTo must be after validFrom' },
    })

    const invalidSchedule = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({
        employeeId: EMPLOYEE_1_ID,
        areaId: AREA_1_ID,
        schedule: '08:00-17:00',
      })

    expect(invalidSchedule.status).toBe(400)
    expect(invalidSchedule.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('supports full catalog-to-permission lifecycle including re-granting after revocation', async () => {
    const context = createTestApp()

    // 1. Admin creates an area
    const areaRes = await request(context.app)
      .post('/areas')
      .set('Authorization', AUTHORIZATION)
      .send({ code: 'SERVER_ROOM', name: 'Cuarto de servidores' })
    expect(areaRes.status).toBe(201)
    const areaId = areaRes.body.id as string

    // 2. Operator creates an employee, registers a card, grants permission, revokes it, and re-grants it
    currentUser = operatorUser

    const empRes = await request(context.app)
      .post('/employees')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeCode: 'E-0900', firstName: 'Sofia', lastName: 'Mendez' })
    expect(empRes.status).toBe(201)
    const employeeId = empRes.body.id as string

    const credRes = await request(context.app)
      .post('/credentials')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId, cardUid: 'de:ad:be:ef' })
    expect(credRes.status).toBe(201)
    expect(credRes.body.cardUid).toBe('DEADBEEF')

    const firstGrant = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId, areaId })
    expect(firstGrant.status).toBe(201)
    expect(firstGrant.body.grantedById).toBe(operatorUser.id)

    const revoked = await request(context.app)
      .post(`/access-permissions/${firstGrant.body.id}/revoke`)
      .set('Authorization', AUTHORIZATION)
    expect(revoked.status).toBe(200)
    expect(revoked.body.revokedAt).toEqual(expect.any(String))

    const secondGrant = await request(context.app)
      .post('/access-permissions')
      .set('Authorization', AUTHORIZATION)
      .send({ employeeId, areaId })
    expect(secondGrant.status).toBe(201)
    expect(secondGrant.body.id).not.toBe(firstGrant.body.id)
    expect(secondGrant.body.revokedAt).toBeNull()

    const activePerms = await request(context.app)
      .get(`/access-permissions?employeeId=${employeeId}&areaId=${areaId}&activeOnly=true`)
      .set('Authorization', AUTHORIZATION)
    expect(activePerms.status).toBe(200)
    expect(activePerms.body.pagination.total).toBe(1)
    expect(activePerms.body.data[0].id).toBe(secondGrant.body.id)
  })
})

describe('Prisma stores error mapping', () => {
  afterEach(() => {
    prismaHolder.current = null
  })

  it('maps P2002, P2003 and P2025 errors in area, employee, credential and permission stores', async () => {
    prismaHolder.current = {
      area: {
        create: async () => {
          throw { code: 'P2002' }
        },
        update: async () => {
          throw { code: 'P2025' }
        },
      },
      employee: {
        create: async () => {
          throw { code: 'P2002' }
        },
        update: async ({ where }: { where: { id: string } }) => {
          if (where.id === UNKNOWN_ID) {
            throw { code: 'P2025' }
          }
          throw { code: 'P2002' }
        },
      },
      credential: {
        create: async ({ data }: { data: { employeeId: string } }) => {
          if (data.employeeId === UNKNOWN_ID) {
            throw { code: 'P2003' }
          }
          throw { code: 'P2002' }
        },
        update: async () => {
          throw { code: 'P2025' }
        },
      },
      accessPermission: {
        create: async ({ data }: { data: { employeeId: string } }) => {
          if (data.employeeId === UNKNOWN_ID) {
            throw { code: 'P2003' }
          }
          throw { code: 'P2002' }
        },
        update: async () => {
          throw { code: 'P2025' }
        },
      },
    }

    const areaStore = createPrismaAreaStore()
    await expect(areaStore.create({ code: 'LAB', name: 'Laboratorio' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    })
    await expect(areaStore.update(UNKNOWN_ID, { name: 'Nuevo' })).resolves.toBeNull()

    const empStore = createPrismaEmployeeStore()
    await expect(
      empStore.create({ employeeCode: 'E-1', firstName: 'A', lastName: 'B' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    })
    await expect(empStore.update(UNKNOWN_ID, { firstName: 'A' })).resolves.toBeNull()
    await expect(empStore.update(EMPLOYEE_1_ID, { email: 'dup@example.com' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    })

    const credStore = createPrismaCredentialStore()
    await expect(
      credStore.create({ employeeId: EMPLOYEE_1_ID, cardUid: 'AABBCCDD' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    })
    await expect(
      credStore.create({ employeeId: UNKNOWN_ID, cardUid: 'AABBCCDD' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
    })
    await expect(credStore.update(UNKNOWN_ID, { status: 'lost' })).resolves.toBeNull()

    const permStore = createPrismaAccessPermissionStore()
    await expect(
      permStore.create({ employeeId: EMPLOYEE_1_ID, areaId: AREA_1_ID }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    })
    await expect(
      permStore.create({ employeeId: UNKNOWN_ID, areaId: AREA_1_ID }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
    })
    await expect(permStore.revoke(UNKNOWN_ID, new Date())).resolves.toBeNull()
  })
})
