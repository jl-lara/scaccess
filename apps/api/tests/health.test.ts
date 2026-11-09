import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'

describe('GET /api/v1/health', () => {
  it('returns the service health status without requiring authentication', async () => {
    const response = await request(app).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'access-control-api',
    })
    expect(typeof response.body.timestamp).toBe('string')
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false)
    expect(typeof response.body.uptimeSeconds).toBe('number')
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })
})
