import type { AccessEventDto, PaginatedResponse } from '@scaccess/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
}))

vi.mock('../src/api/httpClient', () => ({
  apiFetch: mockApiFetch,
}))

import { getMyAccessEventById, listMyAccessEvents } from '../src/api/accessEventsApi'

const sampleEvent: AccessEventDto = {
  id: 'evt-1',
  clientEventId: 'client-evt-1',
  deviceId: 'dev-1',
  deviceEpoch: '1',
  deviceSequence: '10',
  areaId: '8a983ee5-b312-454b-b51b-f53a79ea62ae',
  employeeId: 'emp-1',
  credentialId: 'cred-1',
  cardUid: '04A1B2C3D4E5F6',
  decision: 'granted',
  reasonCode: 'allowed',
  occurredAt: '2026-11-11T04:44:37.500Z',
  receivedAt: '2026-11-11T04:44:39.000Z',
  metadata: null,
  createdAt: '2026-11-11T04:44:39.000Z',
}

describe('accessEventsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta /me/access-events sin query string cuando no se indican parametros', async () => {
    const response: PaginatedResponse<AccessEventDto> = {
      data: [sampleEvent],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }
    mockApiFetch.mockResolvedValueOnce(response)

    const result = await listMyAccessEvents()

    expect(mockApiFetch).toHaveBeenCalledWith('/me/access-events')
    expect(result).toEqual(response)
  })

  it('construye la query string con page y pageSize', async () => {
    mockApiFetch.mockResolvedValueOnce({
      data: [],
      pagination: { page: 2, pageSize: 20, total: 25, totalPages: 2 },
    })

    await listMyAccessEvents({ page: 2, pageSize: 20 })
    expect(mockApiFetch).toHaveBeenCalledWith('/me/access-events?page=2&pageSize=20')

    mockApiFetch.mockResolvedValueOnce({
      data: [],
      pagination: { page: 3, pageSize: 20, total: 50, totalPages: 3 },
    })

    await listMyAccessEvents({ page: 3 })
    expect(mockApiFetch).toHaveBeenCalledWith('/me/access-events?page=3')
  })

  it('codifica correctamente el id al consultar /me/access-events/:id', async () => {
    mockApiFetch.mockResolvedValueOnce(sampleEvent)

    const result = await getMyAccessEventById('evt/123?x=1')

    expect(mockApiFetch).toHaveBeenCalledWith('/me/access-events/evt%2F123%3Fx%3D1')
    expect(result).toEqual(sampleEvent)
  })
})
