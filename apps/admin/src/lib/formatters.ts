import type {
  AccessDecision,
  AccessReason,
  AccountStatus,
  CredentialStatus,
  DeviceStatus,
  EmployeeStatus,
  RoleCode,
} from '@scaccess/shared'

export const ROLE_LABELS: Record<RoleCode | string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  auditor: 'Auditor',
  employee: 'Empleado',
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
}

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  active: 'Activa',
  blocked: 'Bloqueada',
  lost: 'Extraviada',
  retired: 'Retirada',
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Activa',
  disabled: 'Deshabilitada',
}

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  active: 'En linea / Activo',
  inactive: 'Inactivo',
  maintenance: 'En mantenimiento',
}

export const DECISION_LABELS: Record<AccessDecision, string> = {
  granted: 'Concedido',
  denied: 'Denegado',
}

export const REASON_LABELS: Record<AccessReason, string> = {
  allowed: 'Acceso autorizado',
  card_unknown: 'Tarjeta no registrada',
  card_blocked: 'Tarjeta bloqueada',
  card_lost: 'Tarjeta reportada extraviada',
  card_retired: 'Tarjeta retirada',
  employee_inactive: 'Empleado inactivo o suspendido',
  permission_missing: 'Sin permiso para esta area',
  permission_expired: 'Permiso vencido',
  permission_outside_schedule: 'Fuera de horario permitido',
  area_not_allowed: 'Area no autorizada en lector',
  area_inactive: 'Area deshabilitada',
  device_error: 'Error de lectura en controlador',
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function formatDateTimeWithSeconds(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(parsed)
}

export function formatRelativeMinutes(iso: string | null | undefined): string {
  if (!iso) return 'Sin registro'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  const diffSec = Math.round((Date.now() - parsed.getTime()) / 1000)
  if (diffSec < 60) return 'Hace unos segundos'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  return `Hace ${diffDays} d`
}
