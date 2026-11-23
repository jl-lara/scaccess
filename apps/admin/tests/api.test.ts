import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  ApiClientError,
  apiRequest,
  setAccessTokenGetter,
  setUnauthorizedHandler,
} from '../src/lib/api'

const API_ORIGIN = 'https://scaccess-api.onrender.com/api/v1'

const fetchMock = vi.fn()

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }
}

function lastFetchCall(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1)
  if (!call) {
    throw new Error('fetch was not called')
  }
  return { url: String(call[0]), init: call[1] as RequestInit }
}

describe('api client contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAccessTokenGetter(async () => 'test-access-token')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(jsonResponse({}))
  })

  afterEach(() => {
    setAccessTokenGetter(null)
    vi.unstubAllGlobals()
  })

  it('targets every admin read endpoint used by the web console', async () => {
    const cases: Array<{
      path: string
      label: string
      call: () => Promise<unknown>
    }> = [
      { path: '/auth/me', label: 'auth/me', call: () => api.getMe() },
      {
        path: '/dashboard/summary',
        label: 'dashboard/summary',
        call: () => api.getDashboardSummary(),
      },
      {
        path: '/employees?page=1&pageSize=20',
        label: 'employees',
        call: () => api.listEmployees({ page: 1, pageSize: 20 }),
      },
      {
        path: '/credentials?page=1&pageSize=20',
        label: 'credentials',
        call: () => api.listCredentials({ page: 1, pageSize: 20 }),
      },
      {
        path: '/areas?page=1&pageSize=100',
        label: 'areas',
        call: () => api.listAreas({ page: 1, pageSize: 100 }),
      },
      {
        path: '/access-permissions?page=1&pageSize=20',
        label: 'access-permissions',
        call: () => api.listAccessPermissions({ page: 1, pageSize: 20 }),
      },
      {
        path: '/access-devices?page=1&pageSize=20',
        label: 'access-devices',
        call: () => api.listAccessDevices({ page: 1, pageSize: 20 }),
      },
      {
        path: '/access-events?page=1&pageSize=20',
        label: 'access-events',
        call: () => api.listAccessEvents({ page: 1, pageSize: 20 }),
      },
      { path: '/roles', label: 'roles', call: () => api.listRoles() },
      {
        path: '/users?page=1&pageSize=20',
        label: 'users',
        call: () => api.listUsers({ page: 1, pageSize: 20 }),
      },
    ]

    for (const testCase of cases) {
      fetchMock.mockResolvedValueOnce(jsonResponse({}))
      await testCase.call()
      const { url, init } = lastFetchCall()
      expect(url, testCase.label).toBe(`${API_ORIGIN}${testCase.path}`)
      expect(init.method, testCase.label).toBe('GET')
      expect(new Headers(init.headers).get('Authorization'), testCase.label).toBe(
        'Bearer test-access-token',
      )
    }
  })

  it('uses the expected HTTP verbs and paths for administrative mutations', async () => {
    const cases: Array<{
      path: string
      method: string
      body?: unknown
      call: () => Promise<unknown>
    }> = [
      {
        path: '/employees',
        method: 'POST',
        body: { employeeCode: 'EMP-9', firstName: 'Ada', lastName: 'Lovelace' },
        call: () =>
          api.createEmployee({
            employeeCode: 'EMP-9',
            firstName: 'Ada',
            lastName: 'Lovelace',
          }),
      },
      {
        path: '/employees/emp-1',
        method: 'PATCH',
        body: { firstName: 'Ada' },
        call: () => api.updateEmployee('emp-1', { firstName: 'Ada' }),
      },
      {
        path: '/credentials',
        method: 'POST',
        body: { employeeId: 'emp-1', cardUid: '04A1B2C3D4E5F6' },
        call: () => api.createCredential({ employeeId: 'emp-1', cardUid: '04A1B2C3D4E5F6' }),
      },
      {
        path: '/credentials/cred-1',
        method: 'PATCH',
        body: { status: 'blocked' },
        call: () => api.updateCredential('cred-1', { status: 'blocked' }),
      },
      {
        path: '/areas',
        method: 'POST',
        body: { code: 'QA', name: 'QA Area' },
        call: () => api.createArea({ code: 'QA', name: 'QA Area' }),
      },
      {
        path: '/areas/area-1',
        method: 'PATCH',
        body: { name: 'QA Area 2' },
        call: () => api.updateArea('area-1', { name: 'QA Area 2' }),
      },
      {
        path: '/access-permissions',
        method: 'POST',
        body: { employeeId: 'emp-1', areaId: 'area-1' },
        call: () => api.createAccessPermission({ employeeId: 'emp-1', areaId: 'area-1' }),
      },
      {
        path: '/access-permissions/permission-1/revoke',
        method: 'POST',
        call: () => api.revokeAccessPermission('permission-1'),
      },
      {
        path: '/access-devices',
        method: 'POST',
        body: { deviceCode: 'ESP32-QA-02', name: 'QA Reader' },
        call: () => api.createAccessDevice({ deviceCode: 'ESP32-QA-02', name: 'QA Reader' }),
      },
      {
        path: '/access-devices/device-1',
        method: 'PATCH',
        body: { name: 'QA Reader 2' },
        call: () => api.updateAccessDevice('device-1', { name: 'QA Reader 2' }),
      },
      {
        path: '/access-devices/device-1/sync-state',
        method: 'GET',
        call: () => api.getDeviceSyncState('device-1'),
      },
      {
        path: '/access-devices/device-1/credentials',
        method: 'POST',
        call: () => api.issueDeviceCredential('device-1'),
      },
      {
        path: '/access-devices/device-1/credentials/credential-1/revoke',
        method: 'POST',
        call: () => api.revokeDeviceCredential('device-1', 'credential-1'),
      },
      {
        path: '/access-events/event-1',
        method: 'GET',
        call: () => api.getAccessEvent('event-1'),
      },
      {
        path: '/users',
        method: 'POST',
        body: { authUserId: 'auth-1', email: 'qa@scaccess.local' },
        call: () =>
          api.createUser({ authUserId: 'auth-1', email: 'qa@scaccess.local' }),
      },
      {
        path: '/users/user-1',
        method: 'PATCH',
        body: { status: 'disabled' },
        call: () => api.updateUser('user-1', { status: 'disabled' }),
      },
    ]

    for (const testCase of cases) {
      fetchMock.mockResolvedValueOnce(jsonResponse({}))
      await testCase.call()
      const { url, init } = lastFetchCall()
      expect(url, testCase.path).toBe(`${API_ORIGIN}${testCase.path}`)
      expect(init.method, testCase.path).toBe(testCase.method)
      if (testCase.body !== undefined) {
        expect(init.body, testCase.path).toBe(JSON.stringify(testCase.body))
        expect(new Headers(init.headers).get('Content-Type'), testCase.path).toBe(
          'application/json',
        )
      }
    }
  })

  it('serializes every supported access-event filter', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], pagination: {} }))

    await api.listAccessEvents({
      page: 2,
      pageSize: 50,
      employeeId: 'emp-1',
      deviceId: 'device-1',
      areaId: 'area-1',
      decision: 'denied',
      reasonCode: 'card_unknown',
      cardUid: 'DEADBEEF1234',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-10T23:59:59.000Z',
    })

    const { url } = lastFetchCall()
    expect(url).toContain('page=2')
    expect(url).toContain('pageSize=50')
    expect(url).toContain('employeeId=emp-1')
    expect(url).toContain('deviceId=device-1')
    expect(url).toContain('areaId=area-1')
    expect(url).toContain('decision=denied')
    expect(url).toContain('reasonCode=card_unknown')
    expect(url).toContain('cardUid=DEADBEEF1234')
    expect(url).toContain('from=2026-11-01T00%3A00%3A00.000Z')
    expect(url).toContain('to=2026-11-10T23%3A59%3A59.000Z')
  })

  it('keeps the health probe public and respects JSON error envelopes', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: 'ok',
        service: 'scaccess-api',
        timestamp: '2026-11-10T12:00:00.000Z',
        uptimeSeconds: 120,
      }),
    )
    await api.getHealth()

    const healthCall = lastFetchCall()
    expect(healthCall.url).toBe(`${API_ORIGIN}/health`)
    expect(new Headers(healthCall.init.headers).get('Authorization')).toBeNull()

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'La cuenta no tiene permisos administrativos.',
            details: { requiredRole: 'admin' },
          },
        },
        403,
      ),
    )

    await expect(api.getMe()).rejects.toMatchObject({
      name: 'ApiClientError',
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'No tienes permisos para realizar esta acción.',
      details: { requiredRole: 'admin' },
    })
  })

  it('translates known 409 conflict messages into specific Spanish messages (H8)', async () => {
    const conflicts: Array<{ raw: string; expected: string }> = [
      {
        raw: 'Employee code already exists',
        expected: 'Ya existe un empleado registrado con ese código.',
      },
      {
        raw: 'Employee email already exists',
        expected: 'Ya existe un empleado registrado con ese correo electrónico.',
      },
      {
        raw: 'Card UID already registered',
        expected: 'Ya existe una tarjeta RFID registrada con ese UID.',
      },
      {
        raw: 'Area code already exists',
        expected: 'Ya existe un área física registrada con ese código.',
      },
    ]

    for (const entry of conflicts) {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'CONFLICT',
              message: entry.raw,
            },
          },
          409,
        ),
      )

      await expect(api.getMe()).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
        message: entry.expected,
      })
    }
  })

  it('invokes unauthorized handler on 401 responses but not on 403', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    try {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Expired token',
            },
          },
          401,
        ),
      )

      await expect(api.getMe()).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED',
      })
      expect(onUnauthorized).toHaveBeenCalledTimes(1)

      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient role',
            },
          },
          403,
        ),
      )

      await expect(api.getMe()).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      })
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
    } finally {
      setUnauthorizedHandler(null)
    }
  })

  it('never renders an HTML proxy error page in the interface', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
      json: async () => null,
      text: async () => '<!doctype html><html><body>Bad gateway</body></html>',
    })

    await expect(api.getHealth()).rejects.toMatchObject({
      statusCode: 502,
      code: 'HTTP_502',
      message: 'Error HTTP 502 al comunicarse con el servidor',
    })
  })

  it('turns network failures into a NETWORK_ERROR and supports 204 responses', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiRequest('/health', { skipAuth: true })).rejects.toBeInstanceOf(
      ApiClientError,
    )
    await expect(apiRequest('/health', { skipAuth: true })).rejects.toMatchObject({
      statusCode: 0,
      code: 'NETWORK_ERROR',
    })

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() })
    await expect(
      api.revokeDeviceCredential('device-1', 'credential-1'),
    ).resolves.toBeUndefined()
  })
})
