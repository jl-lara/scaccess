import type { UserAccountDto } from '@scaccess/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
}))

vi.mock('../src/api/httpClient', () => ({
  apiFetch: mockApiFetch,
}))

import { getMe } from '../src/api/authApi'

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('solicita GET /auth/me y devuelve la cuenta del usuario', async () => {
    const account: UserAccountDto = {
      id: 'user-1',
      authUserId: 'auth-1',
      email: 'employee.qa@scaccess.local',
      employeeId: 'emp-1',
      status: 'active',
      roles: ['employee'],
      lastLoginAt: null,
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    }
    mockApiFetch.mockResolvedValueOnce(account)

    const result = await getMe()

    expect(mockApiFetch).toHaveBeenCalledWith('/auth/me')
    expect(result).toEqual(account)
  })
})
