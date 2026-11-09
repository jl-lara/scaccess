import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { app } from '../src/app.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { ApiError } from '../src/utils/ApiError.js'

describe('error handler for malformed payloads', () => {
  it('returns 400 for a malformed JSON body', async () => {
    const response = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{ invalid json')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload',
      },
    })
  })

  it('returns 413 for a payload over the size limit', async () => {
    const oversized = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) })

    const response = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(oversized)

    expect(response.status).toBe(413)
    expect(response.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload too large',
      },
    })
  })
})

describe('uniform error serialization', () => {
  const customApp = express()
  customApp.get('/api-error-details', (_req, _res, next) => {
    next(ApiError.conflict('Duplicate entity', { field: 'email' }))
  })
  customApp.get('/zod-error', (_req, _res, next) => {
    const parsed = z.object({ count: z.number().int().positive() }).safeParse({ count: -1 })
    if (!parsed.success) {
      next(parsed.error)
      return
    }
    next()
  })
  customApp.get('/unexpected-error', (_req, _res, next) => {
    next(new Error('Database connection exploded'))
  })
  customApp.use(errorHandler)

  it('serializes ApiError with optional details', async () => {
    const response = await request(customApp).get('/api-error-details')

    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'Duplicate entity',
        details: { field: 'email' },
      },
    })
  })

  it('serializes ZodError as 400 VALIDATION_ERROR with issue details', async () => {
    const response = await request(customApp).get('/zod-error')

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
      },
    })
    expect(Array.isArray(response.body.error.details)).toBe(true)
    expect(response.body.error.details).toHaveLength(1)
  })

  it('masks unhandled internal errors with 500 INTERNAL_SERVER_ERROR', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await request(customApp).get('/unexpected-error')

      expect(response.status).toBe(500)
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unexpected error',
        },
      })
      expect(consoleSpy).toHaveBeenCalledOnce()
    } finally {
      consoleSpy.mockRestore()
    }
  })
})

describe('contract of health and unknown routes', () => {
  it('GET /api/v1/health keeps the expected shape', async () => {
    const response = await request(app).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'access-control-api',
    })
    expect(typeof response.body.timestamp).toBe('string')
    expect(typeof response.body.uptimeSeconds).toBe('number')
  })

  it('GET /api/v1/unknown keeps the uniform error shape', async () => {
    const response = await request(app).get('/api/v1/does-not-exist')

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/v1/does-not-exist not found',
      },
    })
  })
})
