/**
 * Contratos compartidos entre los clientes y la API.
 *
 * Estos tipos son la referencia canonica para las respuestas HTTP y los
 * contratos de sincronizacion. Se adoptan desde `apps/api`, `apps/admin` y
 * `apps/mobile` para evitar duplicar y divergir.
 *
 * Sin logica de negocio ni dependencias de runtime: solo tipos y constantes.
 */

export const API_VERSION = 'v1' as const
export const API_BASE_PATH = `/api/${API_VERSION}` as const

// ---------------------------------------------------------------------------
// Estados de dominio (alineados con los enums de apps/api/prisma/schema.prisma)
// ---------------------------------------------------------------------------

export type EmployeeStatus = 'active' | 'inactive' | 'suspended'

export type CredentialStatus = 'active' | 'blocked' | 'lost' | 'retired'

export type AccountStatus = 'active' | 'disabled'

export type DeviceStatus = 'active' | 'inactive' | 'maintenance'

export type AccessDecision = 'granted' | 'denied'

export type AccessReason =
  | 'allowed'
  | 'card_unknown'
  | 'card_blocked'
  | 'card_lost'
  | 'card_retired'
  | 'employee_inactive'
  | 'permission_missing'
  | 'permission_expired'
  | 'permission_outside_schedule'
  | 'area_not_allowed'
  | 'area_inactive'
  | 'device_error'

// ---------------------------------------------------------------------------
// Errores de API
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_SERVER_ERROR'

export interface ApiErrorDetail {
  path: string
  message: string
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode | (string & {})
    message: string
    details?: unknown
  }
}

// ---------------------------------------------------------------------------
// Salud
// ---------------------------------------------------------------------------

export interface HealthCheckResponse {
  status: 'ok'
  service: string
  timestamp: string
  uptimeSeconds: number
}

// ---------------------------------------------------------------------------
// Sincronizacion de dispositivos
// ---------------------------------------------------------------------------

export interface DeviceSyncAreaItem {
  id: string
  code: string
  name: string
  timezone: string
}

export interface DeviceSyncEmployeeItem {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  status: EmployeeStatus
}

export interface DeviceSyncCredentialItem {
  id: string
  employeeId: string
  cardUid: string
  status: CredentialStatus
}

export interface DeviceSyncPermissionItem {
  employeeId: string
  areaId: string
  validFrom: string | null
  validTo: string | null
  schedule: unknown | null
}

export interface DeviceSyncConfig {
  configVersion: string
  timezone: string
}

export interface DeviceSyncPayload {
  deviceId: string
  syncVersion: string
  generatedAt: string
  checksum: string
  areas: DeviceSyncAreaItem[]
  employees: DeviceSyncEmployeeItem[]
  credentials: DeviceSyncCredentialItem[]
  permissions: DeviceSyncPermissionItem[]
  config: DeviceSyncConfig
}

export interface DeviceEventSyncItem {
  clientEventId: string
  cardUid: string
  deviceId: string
  areaId: string
  occurredAt: string
  decision: AccessDecision
  reasonCode: AccessReason
  deviceEpoch?: string
  deviceSequence?: string
  metadata?: unknown
}

export interface DeviceEventSyncRequest {
  deviceId: string
  events: DeviceEventSyncItem[]
}

export interface DeviceEventSyncRejectedItem {
  clientEventId: string
  reasonCode: string
  message: string
}

export interface DeviceEventSyncResponse {
  accepted: string[]
  duplicated: string[]
  rejected: DeviceEventSyncRejectedItem[]
}

// ---------------------------------------------------------------------------
// Contratos HTTP de la API administrativa
// ---------------------------------------------------------------------------

export type RoleCode = 'admin' | 'operator' | 'auditor'

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface AreaDto {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  timezone: string
  createdAt: string
  updatedAt: string
}

export interface EmployeeDto {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string | null
  department: string | null
  position: string | null
  status: EmployeeStatus
  hiredAt: string | null
  deactivatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CredentialDto {
  id: string
  employeeId: string
  cardUid: string
  label: string | null
  status: CredentialStatus
  issuedAt: string | null
  deactivatedAt: string | null
  deactivationReason: string | null
  createdAt: string
  updatedAt: string
}

export interface AccessPermissionDto {
  id: string
  employeeId: string
  areaId: string
  validFrom: string | null
  validTo: string | null
  schedule: unknown | null
  revokedAt: string | null
  grantedById: string | null
  createdAt: string
  updatedAt: string
}

export interface AccessDeviceDto {
  id: string
  deviceCode: string
  name: string
  location: string | null
  status: DeviceStatus
  hardwareModel: string | null
  firmwareVersion: string | null
  configVersion: string
  lastSeenAt: string | null
  provisionedAt: string | null
  areaIds: string[]
  createdAt: string
  updatedAt: string
}

export interface DeviceSyncStateDto {
  deviceId: string
  configVersion: string
  lastSyncRequestedAt: string | null
  lastSyncCompletedAt: string | null
  lastEventReceivedAt: string | null
  lastEventOccurredAt: string | null
  pendingEventCountReported: number | null
  lastErrorCode: string | null
  lastErrorAt: string | null
  updatedAt: string
}

export interface DeviceCredentialIssuedDto {
  id: string
  deviceId: string
  tokenId: string
  token: string
  createdAt: string
  expiresAt: string | null
}

export interface AccessEventDto {
  id: string
  deviceId: string
  clientEventId: string
  deviceEpoch: string | null
  cardUid: string
  employeeId: string | null
  credentialId: string | null
  areaId: string
  decision: AccessDecision
  reasonCode: AccessReason
  occurredAt: string
  receivedAt: string
  deviceSequence: string | null
  metadata: unknown | null
  createdAt: string
}

export interface RoleDto {
  id: string
  code: RoleCode | (string & {})
  name: string
  description: string | null
  isSystem: boolean
}

export interface UserAccountDto {
  id: string
  authUserId: string
  employeeId: string | null
  email: string
  status: AccountStatus
  roles: string[]
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardSummaryDto {
  employees: { total: number; active: number }
  credentials: { total: number; active: number; blockedOrLost: number }
  areas: { total: number; active: number }
  devices: { total: number; active: number; outOfSync: number }
  recentEvents24h: { granted: number; denied: number }
}
