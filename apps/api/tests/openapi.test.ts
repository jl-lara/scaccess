import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'

function collectRefs(value: unknown, refs: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRefs(item, refs)
    }
    return refs
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.$ref === 'string') {
      refs.push(record.$ref)
    }
    for (const nested of Object.values(record)) {
      collectRefs(nested, refs)
    }
  }

  return refs
}

function resolvePointer(document: unknown, pointer: string): unknown {
  if (!pointer.startsWith('#/')) {
    return undefined
  }

  return pointer
    .slice(2)
    .split('/')
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[part]
          : undefined,
      document,
    )
}

const DOCUMENTED_PATHS = [
  '/health',
  '/auth/me',
  '/roles',
  '/users',
  '/users/{id}',
  '/areas',
  '/areas/{id}',
  '/employees',
  '/employees/{id}',
  '/credentials',
  '/credentials/{id}',
  '/access-permissions',
  '/access-permissions/{id}/revoke',
  '/access-devices',
  '/access-devices/{id}',
  '/access-devices/{id}/credentials',
  '/access-devices/{id}/credentials/{credentialId}/revoke',
  '/access-devices/{id}/sync-state',
  '/devices/{deviceId}/sync',
  '/devices/{deviceId}/events/sync',
  '/access-events',
  '/access-events/{id}',
  '/me/access-events',
  '/me/access-events/{id}',
  '/dashboard/summary',
]

const PROTECTED_ROUTES: Array<{ method: 'get' | 'post'; path: string }> = [  { method: 'get', path: '/api/v1/auth/me' },
  { method: 'get', path: '/api/v1/roles' },
  { method: 'get', path: '/api/v1/users' },
  { method: 'get', path: '/api/v1/areas' },
  { method: 'get', path: '/api/v1/employees' },
  { method: 'get', path: '/api/v1/credentials' },
  { method: 'get', path: '/api/v1/access-permissions' },
  { method: 'get', path: '/api/v1/access-devices' },
  { method: 'get', path: '/api/v1/devices/dev_01/sync' },
  { method: 'post', path: '/api/v1/devices/dev_01/events/sync' },
  { method: 'get', path: '/api/v1/access-events' },
  { method: 'get', path: '/api/v1/me/access-events' },
  { method: 'get', path: '/api/v1/dashboard/summary' },
]

describe('GET /api/v1/openapi.json', () => {
  it('returns a valid OpenAPI 3.1 document with every implemented path', async () => {
    const response = await request(app).get('/api/v1/openapi.json')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body.openapi).toBe('3.1.0')
    expect(response.body.info).toEqual({
      title: 'Sistema de Control de Acceso API',
      version: '1.0.0',
      description:
        'API REST/JSON del Sistema de Control de Acceso (UTT). Expone la ' +
        'administracion de empleados, tarjetas RFID, areas, permisos, ' +
        'dispositivos y usuarios, el historial de accesos, el dashboard y la ' +
        'sincronizacion offline de los controladores ESP32-S3.',
    })
    expect(response.body.servers).toEqual([
      {
        url: '/api/v1',
        description: 'Prefijo versionado de la API.',
      },
    ])

    const documentedPaths = Object.keys(response.body.paths)
    for (const path of DOCUMENTED_PATHS) {
      expect(documentedPaths).toContain(path)
    }
  })

  it('declares the Supabase and device bearer security schemes', async () => {
    const response = await request(app).get('/api/v1/openapi.json')

    expect(response.status).toBe(200)
    expect(response.body.components.securitySchemes).toMatchObject({
      supabaseBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      deviceBearer: {
        type: 'http',
        scheme: 'bearer',
      },
    })
    expect(response.body.components.securitySchemes.deviceBearer.description).toContain(
      '<tokenId>.<secret>',
    )
  })

  it('has no dangling $ref pointers and unique operation ids', async () => {
    const response = await request(app).get('/api/v1/openapi.json')

    expect(response.status).toBe(200)

    const refs = collectRefs(response.body)
    expect(refs.length).toBeGreaterThan(0)
    const danglingRefs = refs.filter((ref) => resolvePointer(response.body, ref) === undefined)
    expect(danglingRefs).toEqual([])

    const operationIds: string[] = []
    for (const pathItem of Object.values(
      response.body.paths as Record<string, Record<string, { operationId?: string }>>,
    )) {
      for (const operation of Object.values(pathItem)) {
        if (typeof operation.operationId === 'string') {
          operationIds.push(operation.operationId)
        }
      }
    }

    expect(operationIds.length).toBe(36)
    expect(new Set(operationIds).size).toBe(operationIds.length)
  })

  it('documents public health and protected operations with the expected security and responses', async () => {
    const response = await request(app).get('/api/v1/openapi.json')

    expect(response.status).toBe(200)
    expect(response.body.paths['/health'].get.security).toEqual([])
    expect(Object.keys(response.body.paths['/auth/me'].get.responses)).toEqual([
      '200',
      '401',
      '403',
      '404',
    ])
    expect(response.body.paths['/areas'].get.security).toEqual([{ supabaseBearer: [] }])
    expect(response.body.paths['/devices/{deviceId}/sync'].get.security).toEqual([
      { deviceBearer: [] },
    ])
  })
})

describe('GET /api/v1/docs', () => {
  it('returns the interactive HTML documentation page', async () => {
    const response = await request(app).get('/api/v1/docs')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/text\/html/)
    expect(response.text).toContain('Documentacion interactiva')
    expect(response.text).toContain('/api/v1/openapi.json')
  })

  it('allows the self-contained inline script through a route-specific CSP', async () => {
    const response = await request(app).get('/api/v1/docs')

    expect(response.status).toBe(200)
    expect(response.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'")
  })
})

describe('v1 router integration', () => {
  it.each(PROTECTED_ROUTES)(
    'requires authentication for $method $path',
    async ({ method, path }) => {
      const response = await request(app)[method](path)

      expect(response.status).toBe(401)
      expect(response.body).toMatchObject({
        error: {
          code: 'UNAUTHORIZED',
        },
      })
    },
  )
})
