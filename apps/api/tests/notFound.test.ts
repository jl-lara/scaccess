import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'

describe('unknown routes', () => {
  it('returns a structured 404 error for unknown GET and POST routes', async () => {
    const getResponse = await request(app).get('/api/v1/does-not-exist')

    expect(getResponse.status).toBe(404)
    expect(getResponse.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/v1/does-not-exist not found',
      },
    })

    const postResponse = await request(app).post('/unknown-root-path')

    expect(postResponse.status).toBe(404)
    expect(postResponse.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route POST /unknown-root-path not found',
      },
    })
  })
})
