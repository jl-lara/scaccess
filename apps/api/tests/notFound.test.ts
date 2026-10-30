import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'

describe('unknown routes', () => {
  it('returns a structured 404 error', async () => {
    const response = await request(app).get('/api/v1/does-not-exist')

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
      },
    })
  })
})
