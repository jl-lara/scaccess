import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'

describe('GET /api/v1/health', () => {
  it('returns the service health status', async () => {
    const response = await request(app).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'access-control-api',
    })
    expect(typeof response.body.timestamp).toBe('string')
    expect(typeof response.body.uptimeSeconds).toBe('number')
  })
})
