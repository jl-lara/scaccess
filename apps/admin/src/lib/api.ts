import {
  API_BASE_PATH,
  type AccessDecision,
  type AccessDeviceDto,
  type AccessEventDto,
  type AccessPermissionDto,
  type AccessReason,
  type AccountStatus,
  type ApiErrorBody,
  type AreaDto,
  type CredentialDto,
  type CredentialStatus,
  type DashboardSummaryDto,
  type DeviceCredentialIssuedDto,
  type DeviceStatus,
  type DeviceSyncStateDto,
  type EmployeeDto,
  type EmployeeStatus,
  type HealthCheckResponse,
  type PaginatedResponse,
  type RoleDto,
  type UserAccountDto,
} from '@scaccess/shared'
import { clientEnv } from './env'
import { getSupabaseClient } from './supabase'

// Render Free can take up to ~60 s to wake a suspended service; the read-only
// catalog screens should wait for that cold start instead of failing early.
const DEFAULT_TIMEOUT_MS = 60_000

const API_ERROR_MESSAGES: Record<string, string> = {
  BAD_REQUEST: 'La solicitud contiene datos inválidos. Revisa los campos e intenta de nuevo.',
  UNAUTHORIZED: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
  FORBIDDEN: 'No tienes permisos para realizar esta acción.',
  NOT_FOUND: 'El registro solicitado no existe o ya no está disponible.',
  CONFLICT: 'Ya existe un registro con esos datos. Revisa el código, correo o UID.',
  VALIDATION_ERROR: 'Revisa los datos capturados: hay campos inválidos o incompletos.',
  PAYLOAD_TOO_LARGE: 'La información enviada es demasiado grande.',
  INTERNAL_SERVER_ERROR: 'El servidor encontró un error. Intenta de nuevo en unos segundos.',
}

const SERVER_MESSAGE_TRANSLATIONS: ReadonlyArray<[RegExp, string]> = [
  [/employee code already exists/i, 'Ya existe un empleado registrado con ese código.'],
  [
    /employee email already exists/i,
    'Ya existe un empleado registrado con ese correo electrónico.',
  ],
  [
    /employee code or email already exists/i,
    'Ya existe un empleado con ese código o correo electrónico.',
  ],
  [/card uid already registered/i, 'Ya existe una tarjeta RFID registrada con ese UID.'],
  [/area code already exists/i, 'Ya existe un área física registrada con ese código.'],
  [/device code already exists/i, 'Ya existe un controlador registrado con ese código.'],
  [
    /active permission already exists/i,
    'Ya existe un permiso activo para este empleado en esa área.',
  ],
  [/permission is already revoked/i, 'Este permiso ya fue revocado anteriormente.'],
  [
    /authuserid is already linked/i,
    'Ese UUID de Supabase Auth ya está vinculado a otra cuenta.',
  ],
  [/email is already linked/i, 'Ese correo electrónico ya está vinculado a otra cuenta.'],
  [
    /employeeid is already linked/i,
    'Ese empleado ya está vinculado a otra cuenta de usuario.',
  ],
  [/validto must be after validfrom/i, 'La fecha de fin debe ser posterior a la fecha de inicio.'],
  [
    /validto cannot exceed 5 years/i,
    'La vigencia del permiso no puede exceder 5 años hacia el futuro.',
  ],
]

function localizeApiError(code: string, fallback: string): string {
  for (const [pattern, localized] of SERVER_MESSAGE_TRANSLATIONS) {
    if (pattern.test(fallback)) {
      return localized
    }
  }
  return API_ERROR_MESSAGES[code] ?? fallback
}

export class ApiClientError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

let customAccessTokenGetter: (() => Promise<string | null>) | null = null
let unauthorizedHandler: ((reason: string) => void | Promise<void>) | null = null
let handlingUnauthorized = false

export function setAccessTokenGetter(getter: (() => Promise<string | null>) | null): void {
  customAccessTokenGetter = getter
}

export function setUnauthorizedHandler(
  handler: ((reason: string) => void | Promise<void>) | null,
): void {
  unauthorizedHandler = handler
}

async function resolveAccessToken(): Promise<string | null> {
  if (customAccessTokenGetter) {
    return customAccessTokenGetter()
  }
  const supabase = getSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function refreshAccessToken(): Promise<string | null> {
  if (customAccessTokenGetter) {
    return null
  }
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session?.access_token) {
      return null
    }
    return data.session.access_token
  } catch {
    return null
  }
}

async function notifyUnauthorized(message: string): Promise<void> {
  if (!unauthorizedHandler || handlingUnauthorized) {
    return
  }
  handlingUnauthorized = true
  try {
    await unauthorizedHandler(message)
  } finally {
    handlingUnauthorized = false
  }
}

function buildQueryString(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const serialized = search.toString()
  return serialized ? `?${serialized}` : ''
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  skipAuth?: boolean
  timeoutMs?: number
  _retriedAuth?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    skipAuth = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    _retriedAuth = false,
  } = options
  const url = `${clientEnv.apiBaseUrl}${API_BASE_PATH}${path}${buildQueryString(query)}`

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (!skipAuth) {
    const token = await resolveAccessToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    })

    if (response.status === 204) {
      return undefined as T
    }

    if (response.status === 401 && !skipAuth && !_retriedAuth) {
      const refreshedToken = await refreshAccessToken()
      if (refreshedToken) {
        clearTimeout(timeoutId)
        return await apiRequest<T>(path, { ...options, _retriedAuth: true })
      }
    }

    const contentType = response.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')
    const payload: unknown = isJson ? await response.json() : await response.text()

    if (!response.ok) {
      const apiErr = payload as Partial<ApiErrorBody> | undefined
      const code = apiErr?.error?.code ?? `HTTP_${response.status}`
      const serverMessage =
        apiErr?.error?.message ??
        (isJson && typeof payload === 'string' && payload.length > 0
          ? payload
          : `Error HTTP ${response.status} al comunicarse con el servidor`)
      const message = localizeApiError(code, serverMessage)
      if (response.status === 401 && !skipAuth) {
        await notifyUnauthorized(message)
      }
      throw new ApiClientError(response.status, code, message, apiErr?.error?.details)
    }

    return payload as T
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError(
        504,
        'TIMEOUT',
        'El servidor no respondió a tiempo. Si Render estaba suspendido, espera unos segundos y vuelve a intentarlo.',
      )
    }
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'No fue posible conectar con la API. Verifica tu conexión a Internet y vuelve a intentarlo.',
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export const api = {
  getHealth: () => apiRequest<HealthCheckResponse>('/health', { skipAuth: true }),

  getMe: () => apiRequest<UserAccountDto>('/auth/me'),

  getDashboardSummary: () => apiRequest<DashboardSummaryDto>('/dashboard/summary'),

  // Empleados
  listEmployees: (params?: {
    page?: number
    pageSize?: number
    status?: EmployeeStatus
    department?: string
    search?: string
  }) => apiRequest<PaginatedResponse<EmployeeDto>>('/employees', { query: params }),

  createEmployee: (body: {
    employeeCode: string
    firstName: string
    lastName: string
    email?: string | null
    department?: string | null
    position?: string | null
    status?: EmployeeStatus
    hiredAt?: string | null
  }) => apiRequest<EmployeeDto>('/employees', { method: 'POST', body }),

  updateEmployee: (
    id: string,
    body: {
      employeeCode?: string
      firstName?: string
      lastName?: string
      email?: string | null
      department?: string | null
      position?: string | null
      status?: EmployeeStatus
      hiredAt?: string | null
    },
  ) => apiRequest<EmployeeDto>(`/employees/${id}`, { method: 'PATCH', body }),

  // Tarjetas RFID (credenciales)
  listCredentials: (params?: {
    page?: number
    pageSize?: number
    employeeId?: string
    status?: CredentialStatus
    cardUid?: string
  }) => apiRequest<PaginatedResponse<CredentialDto>>('/credentials', { query: params }),

  createCredential: (body: {
    employeeId: string
    cardUid: string
    label?: string | null
    status?: CredentialStatus
  }) => apiRequest<CredentialDto>('/credentials', { method: 'POST', body }),

  updateCredential: (
    id: string,
    body: {
      label?: string | null
      status?: CredentialStatus
      deactivationReason?: string | null
    },
  ) => apiRequest<CredentialDto>(`/credentials/${id}`, { method: 'PATCH', body }),

  // Areas
  listAreas: (params?: {
    page?: number
    pageSize?: number
    isActive?: boolean
    search?: string
  }) => apiRequest<PaginatedResponse<AreaDto>>('/areas', { query: params }),

  createArea: (body: {
    code: string
    name: string
    description?: string | null
    isActive?: boolean
    timezone?: string
  }) => apiRequest<AreaDto>('/areas', { method: 'POST', body }),

  updateArea: (
    id: string,
    body: {
      name?: string
      description?: string | null
      isActive?: boolean
      timezone?: string
    },
  ) => apiRequest<AreaDto>(`/areas/${id}`, { method: 'PATCH', body }),

  // Permisos de acceso
  listAccessPermissions: (params?: {
    page?: number
    pageSize?: number
    employeeId?: string
    areaId?: string
    activeOnly?: boolean
  }) => apiRequest<PaginatedResponse<AccessPermissionDto>>('/access-permissions', { query: params }),

  createAccessPermission: (body: {
    employeeId: string
    areaId: string
    validFrom?: string | null
    validTo?: string | null
  }) => apiRequest<AccessPermissionDto>('/access-permissions', { method: 'POST', body }),

  revokeAccessPermission: (id: string) =>
    apiRequest<AccessPermissionDto>(`/access-permissions/${id}/revoke`, { method: 'POST' }),

  // Dispositivos y sincronizacion
  listAccessDevices: (params?: { page?: number; pageSize?: number }) =>
    apiRequest<PaginatedResponse<AccessDeviceDto>>('/access-devices', { query: params }),

  createAccessDevice: (body: {
    deviceCode: string
    name: string
    location?: string | null
    hardwareModel?: string | null
    firmwareVersion?: string | null
    status?: DeviceStatus
    areaIds?: string[]
  }) => apiRequest<AccessDeviceDto>('/access-devices', { method: 'POST', body }),

  updateAccessDevice: (
    id: string,
    body: {
      name?: string
      location?: string | null
      hardwareModel?: string | null
      firmwareVersion?: string | null
      status?: DeviceStatus
      areaIds?: string[]
    },
  ) => apiRequest<AccessDeviceDto>(`/access-devices/${id}`, { method: 'PATCH', body }),

  getDeviceSyncState: (id: string) =>
    apiRequest<DeviceSyncStateDto>(`/access-devices/${id}/sync-state`),

  issueDeviceCredential: (id: string) =>
    apiRequest<DeviceCredentialIssuedDto>(`/access-devices/${id}/credentials`, { method: 'POST' }),

  revokeDeviceCredential: (deviceId: string, credentialId: string) =>
    apiRequest<void>(`/access-devices/${deviceId}/credentials/${credentialId}/revoke`, {
      method: 'POST',
    }),

  // Historial general de eventos
  listAccessEvents: (params?: {
    page?: number
    pageSize?: number
    employeeId?: string
    deviceId?: string
    areaId?: string
    decision?: AccessDecision
    reasonCode?: AccessReason
    cardUid?: string
    from?: string
    to?: string
  }) => apiRequest<PaginatedResponse<AccessEventDto>>('/access-events', { query: params }),

  getAccessEvent: (id: string) => apiRequest<AccessEventDto>(`/access-events/${id}`),

  // Usuarios y roles (admin)
  listRoles: () => apiRequest<RoleDto[]>('/roles'),

  listUsers: (params?: {
    page?: number
    pageSize?: number
    status?: AccountStatus
    search?: string
  }) => apiRequest<PaginatedResponse<UserAccountDto>>('/users', { query: params }),

  createUser: (body: {
    authUserId: string
    email: string
    employeeId?: string | null
    status?: AccountStatus
    roleCodes?: string[]
  }) => apiRequest<UserAccountDto>('/users', { method: 'POST', body }),

  updateUser: (
    id: string,
    body: {
      status?: AccountStatus
      employeeId?: string | null
      roleCodes?: string[]
    },
  ) => apiRequest<UserAccountDto>(`/users/${id}`, { method: 'PATCH', body }),
}
