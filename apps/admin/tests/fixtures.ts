import type {
  AccessDeviceDto,
  AccessEventDto,
  AccessPermissionDto,
  AreaDto,
  CredentialDto,
  DeviceSyncStateDto,
  EmployeeDto,
  PaginatedResponse,
  RoleDto,
  UserAccountDto,
} from '@scaccess/shared'
import type { AuthContextValue } from '../src/context/AuthContext'

const BASE_DATE = '2026-11-01T00:00:00.000Z'

export function paginated<T>(
  data: T[],
  page = 1,
  pageSize = 20,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total: data.length,
      totalPages: Math.ceil(data.length / pageSize),
    },
  }
}

export const EMPLOYEE_ANA: EmployeeDto = {
  id: 'emp-1',
  employeeCode: 'EMP-001',
  firstName: 'Ana',
  lastName: 'Torres',
  email: 'ana.torres@scaccess.local',
  department: 'Ingenieria',
  position: 'Analista de seguridad',
  status: 'active',
  hiredAt: '2025-02-10T00:00:00.000Z',
  deactivatedAt: null,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const EMPLOYEE_LUIS: EmployeeDto = {
  id: 'emp-2',
  employeeCode: 'EMP-002',
  firstName: 'Luis',
  lastName: 'Ramos',
  email: 'luis.ramos@scaccess.local',
  department: 'Operaciones',
  position: 'Supervisor',
  status: 'inactive',
  hiredAt: '2024-06-01T00:00:00.000Z',
  deactivatedAt: '2026-10-01T00:00:00.000Z',
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const EMPLOYEES: EmployeeDto[] = [EMPLOYEE_ANA, EMPLOYEE_LUIS]

export const EMPLOYEE_CREATED: EmployeeDto = {
  ...EMPLOYEE_ANA,
  id: 'emp-3',
  employeeCode: 'EMP-003',
  firstName: 'Luis',
  lastName: 'Mendoza',
  email: 'luis.mendoza@scaccess.local',
  department: 'Mantenimiento',
  position: 'Tecnico',
}

export const AREA_MAIN: AreaDto = {
  id: 'area-1',
  code: 'MAIN_ENTRANCE',
  name: 'Acceso Principal',
  description: 'Entrada general del edificio',
  isActive: true,
  timezone: 'America/Tijuana',
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const AREA_LAB: AreaDto = {
  id: 'area-2',
  code: 'NETWORK_LAB',
  name: 'Laboratorio de Redes',
  description: 'Laboratorio con equipo critico',
  isActive: true,
  timezone: 'America/Tijuana',
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const AREAS: AreaDto[] = [AREA_MAIN, AREA_LAB]

export const CREDENTIAL_ACTIVE: CredentialDto = {
  id: 'cred-1',
  employeeId: 'emp-1',
  cardUid: '04A1B2C3D4E5F6',
  label: 'Tarjeta principal',
  status: 'active',
  issuedAt: '2026-10-15T00:00:00.000Z',
  deactivatedAt: null,
  deactivationReason: null,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const CREDENTIAL_BLOCKED: CredentialDto = {
  id: 'cred-2',
  employeeId: 'emp-2',
  cardUid: '04FFEEDDCCBBAA',
  label: 'Tarjeta de respaldo',
  status: 'blocked',
  issuedAt: '2026-09-01T00:00:00.000Z',
  deactivatedAt: '2026-10-20T00:00:00.000Z',
  deactivationReason: 'Reporte de extravio',
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const CREDENTIALS: CredentialDto[] = [CREDENTIAL_ACTIVE, CREDENTIAL_BLOCKED]

export const PERMISSION_ACTIVE: AccessPermissionDto = {
  id: 'permission-1',
  employeeId: 'emp-1',
  areaId: 'area-1',
  validFrom: '2020-01-01T00:00:00.000Z',
  validTo: null,
  schedule: null,
  revokedAt: null,
  grantedById: null,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const PERMISSION_REVOKED: AccessPermissionDto = {
  id: 'permission-2',
  employeeId: 'emp-2',
  areaId: 'area-2',
  validFrom: '2026-01-01T00:00:00.000Z',
  validTo: '2026-12-31T00:00:00.000Z',
  schedule: null,
  revokedAt: '2026-10-05T00:00:00.000Z',
  grantedById: null,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const PERMISSIONS: AccessPermissionDto[] = [PERMISSION_ACTIVE, PERMISSION_REVOKED]

export const DEVICE_MAIN: AccessDeviceDto = {
  id: 'device-1',
  deviceCode: 'ESP32-QA-01',
  name: 'Lector Entrada Principal',
  location: 'Edificio A, acceso norte',
  status: 'active',
  hardwareModel: 'ESP32-S3',
  firmwareVersion: '1.2.0',
  configVersion: '4',
  lastSeenAt: '2026-11-10T11:55:00.000Z',
  provisionedAt: '2026-10-01T00:00:00.000Z',
  areaIds: ['area-1', 'area-2'],
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const DEVICES: AccessDeviceDto[] = [DEVICE_MAIN]

export const SYNC_STATE_OUTDATED: DeviceSyncStateDto = {
  deviceId: 'device-1',
  configVersion: '3',
  lastSyncRequestedAt: '2026-11-10T10:00:00.000Z',
  lastSyncCompletedAt: '2026-11-10T10:00:08.000Z',
  lastEventReceivedAt: '2026-11-10T11:54:30.000Z',
  lastEventOccurredAt: '2026-11-10T11:54:25.000Z',
  pendingEventCountReported: 7,
  lastErrorCode: null,
  lastErrorAt: null,
  updatedAt: '2026-11-10T11:55:00.000Z',
}

export const ISSUED_TOKEN = {
  id: 'issued-1',
  deviceId: 'device-1',
  tokenId: 'token-abc',
  token: 'token-abc.secret-123',
  createdAt: '2026-11-10T12:00:00.000Z',
  expiresAt: null,
}

export const EVENT_GRANTED: AccessEventDto = {
  id: 'event-1',
  deviceId: 'device-1',
  clientEventId: 'client-evt-1',
  deviceEpoch: 'epoch-3',
  cardUid: '04A1B2C3D4E5F6',
  employeeId: 'emp-1',
  credentialId: 'cred-1',
  areaId: 'area-1',
  decision: 'granted',
  reasonCode: 'allowed',
  occurredAt: '2026-11-10T12:00:00.000Z',
  receivedAt: '2026-11-10T12:00:02.000Z',
  deviceSequence: '1042',
  metadata: { reader: 'PN532', rssi: -62, offline: true },
  createdAt: '2026-11-10T12:00:02.000Z',
}

export const EVENT_UNKNOWN: AccessEventDto = {
  id: 'event-2',
  deviceId: 'device-1',
  clientEventId: 'client-evt-2',
  deviceEpoch: 'epoch-3',
  cardUid: 'DEADBEEF1234',
  employeeId: null,
  credentialId: null,
  areaId: 'area-2',
  decision: 'denied',
  reasonCode: 'card_unknown',
  occurredAt: '2026-11-10T12:05:00.000Z',
  receivedAt: '2026-11-10T12:05:01.000Z',
  deviceSequence: '1043',
  metadata: null,
  createdAt: '2026-11-10T12:05:01.000Z',
}

export const EVENTS: AccessEventDto[] = [EVENT_GRANTED, EVENT_UNKNOWN]

export const ROLES: RoleDto[] = [
  {
    id: 'role-admin',
    code: 'admin',
    name: 'Administrador',
    description: 'Acceso completo a la administracion del sistema',
    isSystem: true,
  },
  {
    id: 'role-operator',
    code: 'operator',
    name: 'Operador',
    description: 'Gestion del catalogo operativo',
    isSystem: true,
  },
  {
    id: 'role-auditor',
    code: 'auditor',
    name: 'Auditor',
    description: 'Consulta del historial de accesos',
    isSystem: true,
  },
]

export const USER_ADMIN: UserAccountDto = {
  id: 'user-1',
  authUserId: '11111111-1111-4111-8111-111111111111',
  employeeId: null,
  email: 'admin.qa@scaccess.local',
  status: 'active',
  roles: ['admin'],
  lastLoginAt: '2026-11-10T09:00:00.000Z',
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const USER_AUDITOR: UserAccountDto = {
  id: 'user-2',
  authUserId: '22222222-2222-4222-8222-222222222222',
  employeeId: 'emp-1',
  email: 'auditor.qa@scaccess.local',
  status: 'disabled',
  roles: ['auditor'],
  lastLoginAt: null,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
}

export const USERS: UserAccountDto[] = [USER_ADMIN, USER_AUDITOR]

export function makeAuth(roles: string[]): AuthContextValue {
  return {
    user: {
      id: 'session-user',
      authUserId: '11111111-1111-4111-8111-111111111111',
      employeeId: null,
      email: 'admin.qa@scaccess.local',
      status: 'active',
      roles,
      lastLoginAt: null,
      createdAt: BASE_DATE,
      updatedAt: BASE_DATE,
    },
    loading: false,
    error: null,
    isAdmin: roles.includes('admin'),
    canWriteCatalog: roles.some((role) => role === 'admin' || role === 'operator'),
    signIn: async () => {},
    signOut: async () => {},
    refreshProfile: async () => {},
  }
}
