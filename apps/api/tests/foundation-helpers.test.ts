import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { errorHandler } from '../src/middleware/errorHandler.js'
import {
  getAuthenticatedUser,
  requireAuth,
  requireEmployeeAccount,
  requireRoles,
  setAuthTokenResolver,
  type AuthenticatedUser,
} from '../src/middleware/auth.js'
import {
  generateDeviceToken,
  getAuthenticatedDevice,
  hashDeviceSecret,
  requireDeviceAuth,
  setDeviceAuthResolver,
  verifyDeviceSecret,
  type AuthenticatedDevice,
} from '../src/middleware/deviceAuth.js'
import { getValidated, validateRequest } from '../src/middleware/validate.js'
import { ApiError } from '../src/utils/ApiError.js'
import { cardUidSchema, isValidCardUid, normalizeCardUid } from '../src/utils/cardUid.js'
import { bumpDevicesConfigVersion } from '../src/utils/configVersion.js'
import {
  buildPaginatedResponse,
  paginationQuerySchema,
  toPrismaSkipTake,
  type PaginationQuery,
} from '../src/utils/pagination.js'

const prismaHolder = vi.hoisted(() => ({ current: undefined as unknown }))

vi.mock('../src/config/prisma.js', () => ({
  getPrismaClient: () => prismaHolder.current,
  disconnectPrisma: async () => {},
}))

const activeUser: AuthenticatedUser = {
  id: 'user-1',
  authUserId: 'auth-user-1',
  employeeId: 'employee-1',
  email: 'admin@example.com',
  status: 'active',
  roles: ['admin'],
}

const activeDevice: AuthenticatedDevice = {
  id: 'device-1',
  deviceCode: 'ESP32-001',
  status: 'active',
  configVersion: 7n,
  tokenId: 'devtok_0123456789abcdef',
}

function createTestApp(): express.Express {
  const app = express()
  app.use(express.json())

  app.get('/auth', requireAuth, (req, res) => {
    res.json({ user: getAuthenticatedUser(req, res) })
  })

  app.get('/admin', requireAuth, requireRoles('admin'), (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/employee', requireAuth, requireEmployeeAccount, (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/devices/:deviceId/sync', requireDeviceAuth, (req, res) => {
    const device = getAuthenticatedDevice(req, res)
    res.json({ id: device.id, tokenId: device.tokenId })
  })

  app.post(
    '/validated',
    validateRequest({
      body: z.object({ name: z.string().min(1) }),
      query: paginationQuerySchema,
    }),
    (_req, res) => {
      const validated = getValidated<{ name: string }, PaginationQuery, unknown>(res)
      res.json({ body: validated.body, query: validated.query })
    },
  )

  app.use(errorHandler)

  return app
}

const app = createTestApp()

afterEach(() => {
  setAuthTokenResolver(null)
  setDeviceAuthResolver(null)
})

describe('card UID helpers', () => {
  it('normalizes separators and letter case', () => {
    expect(normalizeCardUid(' de:ad-be ef ')).toBe('DEADBEEF')
    expect(normalizeCardUid('aabbccdd')).toBe('AABBCCDD')
  })

  it('accepts only complete uppercase hexadecimal UIDs of 8-32 characters', () => {
    expect(isValidCardUid('AABBCCDD')).toBe(true)
    expect(isValidCardUid('AABBCCDDEEFF0011')).toBe(true)
    expect(isValidCardUid('AABBCCD')).toBe(false)
    expect(isValidCardUid('AABBCCDD0')).toBe(false)
    expect(isValidCardUid('AABBCCDZ')).toBe(false)
    expect(isValidCardUid('aabbccdd')).toBe(false)
  })

  it('parses card UIDs through the zod schema', () => {
    expect(cardUidSchema.parse(' aa:bb-cc:dd ')).toBe('AABBCCDD')
    expect(cardUidSchema.safeParse('not-a-uid').success).toBe(false)
  })
})

describe('pagination helpers', () => {
  it('applies defaults and coerces query strings', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    })
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(paginationQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false)
  })

  it('translates pagination into Prisma skip/take', () => {
    expect(toPrismaSkipTake({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 })
  })

  it('builds a paginated response with the total page count', () => {
    expect(buildPaginatedResponse(['a', 'b'], 41, { page: 2, pageSize: 20 })).toEqual({
      data: ['a', 'b'],
      pagination: {
        page: 2,
        pageSize: 20,
        total: 41,
        totalPages: 3,
      },
    })
  })
})

describe('device token helpers', () => {
  it('generates a token id, secret and matching hash', () => {
    const first = generateDeviceToken()

    expect(first.tokenId).toMatch(/^devtok_[0-9a-f]{16}$/)
    expect(first.secret).toMatch(/^[0-9a-f]{64}$/)
    expect(first.token).toBe(`${first.tokenId}.${first.secret}`)
    expect(first.secretHash).toBe(hashDeviceSecret(first.secret))

    const second = generateDeviceToken()
    expect(second.tokenId).not.toBe(first.tokenId)
    expect(second.secret).not.toBe(first.secret)
  })

  it('verifies secrets and rejects wrong or malformed hashes without throwing', () => {
    const { secret, secretHash } = generateDeviceToken()

    expect(verifyDeviceSecret(secret, secretHash)).toBe(true)
    expect(verifyDeviceSecret('wrong-secret', secretHash)).toBe(false)
    expect(verifyDeviceSecret(secret, 'not-a-hex-hash')).toBe(false)
  })
})

describe('requireAuth and role checks', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await request(app).get('/auth')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  })

  it('rejects tokens that the resolver does not recognize', async () => {
    setAuthTokenResolver(async () => null)

    const response = await request(app).get('/auth').set('Authorization', 'Bearer unknown')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
  })

  it('rejects disabled accounts', async () => {
    setAuthTokenResolver(async () => ({ ...activeUser, status: 'disabled' }))

    const response = await request(app).get('/auth').set('Authorization', 'Bearer token')

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('attaches the authenticated user for the request', async () => {
    setAuthTokenResolver(async () => activeUser)

    const response = await request(app).get('/auth').set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ user: activeUser })
  })

  it('allows users with one of the required roles', async () => {
    setAuthTokenResolver(async () => activeUser)

    const response = await request(app).get('/admin').set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
  })

  it('forbids users without any of the required roles', async () => {
    setAuthTokenResolver(async () => ({ ...activeUser, roles: ['auditor'] }))

    const response = await request(app).get('/admin').set('Authorization', 'Bearer token')

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    })
  })

  it('forbids accounts that are not linked to an employee', async () => {
    setAuthTokenResolver(async () => ({ ...activeUser, employeeId: null }))

    const response = await request(app).get('/employee').set('Authorization', 'Bearer token')

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Employee account required' },
    })
  })

  it('allows employee-linked accounts', async () => {
    setAuthTokenResolver(async () => activeUser)

    const response = await request(app).get('/employee').set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
  })
})

describe('requireDeviceAuth', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await request(app).get('/devices/device-1/sync')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({
      error: { code: 'UNAUTHORIZED', message: 'Device authentication required' },
    })
  })

  it('rejects tokens that the resolver does not recognize', async () => {
    setDeviceAuthResolver(async () => null)

    const response = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', 'Bearer invalid')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
  })

  it('accepts a device matched by id and passes the token to the resolver', async () => {
    const generated = generateDeviceToken()
    setDeviceAuthResolver(async (token, deviceIdentifier) => {
      expect(token).toBe(generated.token)
      expect(deviceIdentifier).toBe('device-1')
      return { ...activeDevice, tokenId: generated.tokenId }
    })

    const response = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', `Bearer ${generated.token}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ id: 'device-1', tokenId: generated.tokenId })
  })

  it('accepts a device matched by device code', async () => {
    setDeviceAuthResolver(async () => activeDevice)

    const response = await request(app)
      .get('/devices/ESP32-001/sync')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(200)
    expect(response.body.id).toBe('device-1')
  })

  it('forbids a token that belongs to another device', async () => {
    setDeviceAuthResolver(async () => activeDevice)

    const response = await request(app)
      .get('/devices/device-2/sync')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Device token does not match requested device' },
    })
  })

  it('forbids inactive devices', async () => {
    setDeviceAuthResolver(async () => ({ ...activeDevice, status: 'inactive' }))

    const response = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', 'Bearer token')

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'Device is not active' },
    })
  })
})

describe('validateRequest', () => {
  it('replaces the body with the parsed value and exposes validated data', async () => {
    const response = await request(app)
      .post('/validated?page=2&pageSize=10')
      .send({ name: 'Ada', ignored: true })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      body: { name: 'Ada' },
      query: { page: 2, pageSize: 10 },
    })
  })

  it('forwards zod errors to the uniform error handler', async () => {
    const response = await request(app).post('/validated').send({ name: '' })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload' },
    })
  })

  it('throws when getValidated is called before validateRequest', () => {
    const fakeRes = { locals: {} } as unknown as express.Response
    expect(() => getValidated(fakeRes)).toThrow('getValidated called before validateRequest')
  })
})

describe('ApiError helpers', () => {
  it('constructs typed HTTP errors with default and custom messages/details', () => {
    expect(ApiError.notFound()).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Resource not found',
    })
    expect(ApiError.unauthorized('Custom unauth')).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Custom unauth',
    })
    expect(ApiError.forbidden()).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    })
    expect(ApiError.badRequest('Bad input', { field: 'x' })).toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Bad input',
      details: { field: 'x' },
    })
    expect(ApiError.conflict('Duplicate key', { id: '1' })).toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Duplicate key',
      details: { id: '1' },
    })
  })

  it('throws 401 when getAuthenticatedUser or getAuthenticatedDevice is called without auth context', () => {
    const fakeReq = {} as unknown as express.Request
    expect(() => getAuthenticatedUser(fakeReq)).toThrow('Authentication required')
    expect(() => getAuthenticatedDevice(fakeReq)).toThrow('Device authentication required')
  })
})

describe('bumpDevicesConfigVersion', () => {
  it('increments configVersion for all active devices when areaIds is omitted or empty', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 })
    prismaHolder.current = { accessDevice: { updateMany } }

    await bumpDevicesConfigVersion()
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { status: 'active' },
      data: { configVersion: { increment: 1n } },
    })

    await bumpDevicesConfigVersion([])
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { status: 'active' },
      data: { configVersion: { increment: 1n } },
    })
  })

  it('increments configVersion only for active devices covering the specified areaIds', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    prismaHolder.current = { accessDevice: { updateMany } }

    await bumpDevicesConfigVersion(['area-1', 'area-2'])
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        deviceAreas: { some: { areaId: { in: ['area-1', 'area-2'] } } },
      },
      data: { configVersion: { increment: 1n } },
    })
  })
})

describe('database-backed device authentication resolver', () => {
  it('validates token format, revocation, expiration, secret hash and device status against Prisma', async () => {
    setDeviceAuthResolver(null)
    const generated = generateDeviceToken()

    let storedRecord: {
      tokenId: string
      secretHash: string
      revokedAt: Date | null
      expiresAt: Date | null
      device: {
        id: string
        deviceCode: string
        status: 'active' | 'inactive' | 'maintenance'
        configVersion: bigint
      }
    } | null = null

    prismaHolder.current = {
      deviceCredential: {
        findUnique: vi.fn(async ({ where }: { where: { tokenId: string } }) =>
          storedRecord && storedRecord.tokenId === where.tokenId ? storedRecord : null,
        ),
      },
    }

    // 1. Malformed token without dot separator
    const malformed = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', 'Bearer malformedtoken')
    expect(malformed.status).toBe(401)

    // 2. Unknown tokenId
    const unknown = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', `Bearer ${generated.token}`)
    expect(unknown.status).toBe(401)

    // 3. Revoked credential -> 401
    storedRecord = {
      tokenId: generated.tokenId,
      secretHash: generated.secretHash,
      revokedAt: new Date(),
      expiresAt: null,
      device: {
        id: 'device-1',
        deviceCode: 'ESP32-001',
        status: 'active',
        configVersion: 3n,
      },
    }
    const revoked = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', `Bearer ${generated.token}`)
    expect(revoked.status).toBe(401)

    // 4. Expired credential -> 401
    storedRecord = {
      ...storedRecord,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    }
    const expired = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', `Bearer ${generated.token}`)
    expect(expired.status).toBe(401)

    // 5. Wrong secret -> 401
    storedRecord = {
      ...storedRecord,
      expiresAt: null,
    }
    const wrongSecret = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', `Bearer ${generated.tokenId}.wrongsecret`)
    expect(wrongSecret.status).toBe(401)

    // 6. Inactive device with valid credential -> 403 FORBIDDEN (per API contract)
    storedRecord = {
      ...storedRecord,
      device: {
        id: 'device-1',
        deviceCode: 'ESP32-001',
        status: 'inactive',
        configVersion: 3n,
      },
    }
    const inactiveDevice = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', `Bearer ${generated.token}`)
    expect(inactiveDevice.status).toBe(403)
    expect(inactiveDevice.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Device is not active' },
    })

    // 7. Active device with valid credential -> 200 OK
    storedRecord = {
      ...storedRecord,
      device: {
        id: 'device-1',
        deviceCode: 'ESP32-001',
        status: 'active',
        configVersion: 3n,
      },
    }
    const okResponse = await request(app)
      .get('/devices/device-1/sync')
      .set('Authorization', `Bearer ${generated.token}`)
    expect(okResponse.status).toBe(200)
    expect(okResponse.body).toEqual({
      id: 'device-1',
      tokenId: generated.tokenId,
    })
  })
})
