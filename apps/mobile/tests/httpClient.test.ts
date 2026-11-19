import type { ApiErrorBody } from '@scaccess/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}))

vi.mock('../src/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}))

import { apiFetch, MobileApiError } from '../src/api/httpClient'
import { env } from '../src/config/env'

async function captureMobileApiError(promise: Promise<unknown>): Promise<MobileApiError> {
  try {
    await promise
  } catch (err) {
    expect(err).toBeInstanceOf(MobileApiError)
    return err as MobileApiError
  }
  throw new Error('Se esperaba que apiFetch lanzara MobileApiError')
}

describe('apiFetch', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-jwt-token' } },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lanza MobileApiError 401 UNAUTHORIZED cuando no hay sesion activa', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })

    const error = await captureMobileApiError(apiFetch('/auth/me'))

    expect(error.status).toBe(401)
    expect(error.code).toBe('UNAUTHORIZED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('devuelve el JSON y envia Authorization Bearer cuando responde 200 OK', async () => {
    const payload = { id: 'user-1', email: 'empleado@scaccess.local' }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await apiFetch<typeof payload>('/auth/me')

    expect(result).toEqual(payload)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`${env.API_BASE_URL}/auth/me`)
    expect(init?.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-jwt-token',
    })
  })

  it('conserva status, code y message cuando la API devuelve un error HTTP con ApiErrorBody', async () => {
    const errorBody: ApiErrorBody = {
      error: {
        code: 'FORBIDDEN',
        message: 'Employee account required',
      },
    }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const error = await captureMobileApiError(apiFetch('/me/access-events'))

    expect(error.status).toBe(403)
    expect(error.code).toBe('FORBIDDEN')
    expect(error.message).toBe('Employee account required')
  })

  it('convierte AbortError en MobileApiError con status 0 y code TIMEOUT', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValueOnce(abortError)

    const error = await captureMobileApiError(apiFetch('/me/access-events'))

    expect(error.status).toBe(0)
    expect(error.code).toBe('TIMEOUT')
    expect(error.message).toBe(
      'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
    )
  })

  it('convierte errores de red en MobileApiError con status 0 y code NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))

    const error = await captureMobileApiError(apiFetch('/me/access-events'))

    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toBe(
      'Sin conexión a Internet o servidor inaccesible. Inténtalo de nuevo.',
    )
  })
})
