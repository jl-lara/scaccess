import type { MyPermissionsResponseDto, MyProfileResponseDto } from '@scaccess/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
}))

vi.mock('../src/api/httpClient', () => ({
  apiFetch: mockApiFetch,
}))

import { getMyProfile, listMyPermissions } from '../src/api/meApi'

const sampleProfile: MyProfileResponseDto = {
  account: {
    id: 'acc-1',
    authUserId: 'auth-1',
    employeeId: 'emp-1',
    email: 'ana.lopez@utt.edu.mx',
    status: 'active',
    roles: ['employee'],
    lastLoginAt: '2026-11-10T10:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  },
  employee: {
    id: 'emp-1',
    employeeCode: 'EMP-001',
    firstName: 'Ana',
    lastName: 'López',
    email: 'ana.lopez@utt.edu.mx',
    department: 'Ingeniería',
    position: 'Técnico de laboratorio',
    status: 'active',
    hiredAt: '2025-02-01T00:00:00.000Z',
  },
  credentials: [
    {
      id: 'cred-1',
      cardUid: '04A1B2C3D4E5F6',
      label: 'Tarjeta principal',
      status: 'active',
      issuedAt: '2025-02-01T00:00:00.000Z',
      deactivatedAt: null,
    },
  ],
}

const samplePermissions: MyPermissionsResponseDto = {
  data: [
    {
      id: 'perm-1',
      areaId: 'area-1',
      validFrom: null,
      validTo: null,
      schedule: null,
      revokedAt: null,
      area: {
        id: 'area-1',
        code: 'MAIN_ENTRANCE',
        name: 'Acceso Principal',
        description: null,
        isActive: true,
        timezone: 'America/Tijuana',
      },
    },
  ],
}

describe('meApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta /me/profile al obtener el perfil propio', async () => {
    mockApiFetch.mockResolvedValueOnce(sampleProfile)

    const result = await getMyProfile()

    expect(mockApiFetch).toHaveBeenCalledWith('/me/profile')
    expect(result).toEqual(sampleProfile)
  })

  it('consulta /me/permissions sin query string cuando no se indica activeOnly', async () => {
    mockApiFetch.mockResolvedValueOnce(samplePermissions)

    const result = await listMyPermissions()

    expect(mockApiFetch).toHaveBeenCalledWith('/me/permissions')
    expect(result).toEqual(samplePermissions)
  })

  it('serializa activeOnly=true y activeOnly=false al consultar /me/permissions', async () => {
    mockApiFetch.mockResolvedValueOnce(samplePermissions)
    await listMyPermissions({ activeOnly: true })
    expect(mockApiFetch).toHaveBeenCalledWith('/me/permissions?activeOnly=true')

    mockApiFetch.mockResolvedValueOnce(samplePermissions)
    await listMyPermissions({ activeOnly: false })
    expect(mockApiFetch).toHaveBeenCalledWith('/me/permissions?activeOnly=false')
  })
})
