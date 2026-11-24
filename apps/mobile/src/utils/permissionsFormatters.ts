import type { MyAccessPermissionDto } from '@scaccess/shared'

import { formatDate } from './formatters'

export type PermissionEffectiveStatus =
  | 'active'
  | 'scheduled'
  | 'expired'
  | 'revoked'
  | 'area_inactive'

export const PERMISSION_STATUS_LABELS: Record<
  PermissionEffectiveStatus,
  string
> = {
  active: 'Vigente',
  scheduled: 'Próximo',
  expired: 'Vencido',
  revoked: 'Revocado',
  area_inactive: 'Área inactiva',
}

const DAY_LABELS: Record<string, string> = {
  '0': 'Dom',
  '1': 'Lun',
  '2': 'Mar',
  '3': 'Mié',
  '4': 'Jue',
  '5': 'Vie',
  '6': 'Sáb',
  '7': 'Dom',
  mon: 'Lun',
  monday: 'Lun',
  lun: 'Lun',
  lunes: 'Lun',
  tue: 'Mar',
  tuesday: 'Mar',
  mar: 'Mar',
  martes: 'Mar',
  wed: 'Mié',
  wednesday: 'Mié',
  mie: 'Mié',
  mié: 'Mié',
  miercoles: 'Mié',
  miércoles: 'Mié',
  thu: 'Jue',
  thursday: 'Jue',
  jue: 'Jue',
  jueves: 'Jue',
  fri: 'Vie',
  friday: 'Vie',
  vie: 'Vie',
  viernes: 'Vie',
  sat: 'Sáb',
  saturday: 'Sáb',
  sab: 'Sáb',
  sáb: 'Sáb',
  sabado: 'Sáb',
  sábado: 'Sáb',
  sun: 'Dom',
  sunday: 'Dom',
  dom: 'Dom',
  domingo: 'Dom',
}

/** Determina el estado efectivo actual de un permiso de acceso. */
export function getPermissionEffectiveStatus(
  permission: MyAccessPermissionDto,
  now: Date = new Date(),
): PermissionEffectiveStatus {
  if (permission.revokedAt !== null) {
    return 'revoked'
  }
  if (!permission.area.isActive) {
    return 'area_inactive'
  }
  if (permission.validFrom !== null) {
    const validFromMs = new Date(permission.validFrom).getTime()
    if (!Number.isNaN(validFromMs) && validFromMs > now.getTime()) {
      return 'scheduled'
    }
  }
  if (permission.validTo !== null) {
    const validToMs = new Date(permission.validTo).getTime()
    if (!Number.isNaN(validToMs) && validToMs < now.getTime()) {
      return 'expired'
    }
  }
  return 'active'
}

/** Formatea la vigencia (`validFrom` y `validTo`) de un permiso en español. */
export function formatValidityRange(
  validFrom: string | null,
  validTo: string | null,
): string {
  if (validFrom !== null && validTo !== null) {
    return `${formatDate(validFrom)} – ${formatDate(validTo)}`
  }
  if (validFrom !== null) {
    return `Desde ${formatDate(validFrom)}`
  }
  if (validTo !== null) {
    return `Hasta ${formatDate(validTo)}`
  }
  return 'Permanente (sin vencimiento)'
}

function formatDayToken(day: unknown): string | null {
  if (typeof day === 'number' && Number.isInteger(day)) {
    return DAY_LABELS[String(day)] ?? null
  }
  if (typeof day === 'string') {
    return DAY_LABELS[day.trim().toLowerCase()] ?? null
  }
  return null
}

/** Formatea el horario permitido de un permiso en una cadena legible en español. */
export function formatPermissionSchedule(schedule: unknown): string {
  if (schedule === null || schedule === undefined) {
    return 'Cualquier horario (24/7)'
  }

  if (typeof schedule === 'string') {
    const trimmed = schedule.trim()
    return trimmed.length > 0 ? trimmed : 'Cualquier horario (24/7)'
  }

  if (Array.isArray(schedule)) {
    if (schedule.length === 0) {
      return 'Cualquier horario (24/7)'
    }
    return schedule.map((item) => formatPermissionSchedule(item)).join(' · ')
  }

  if (typeof schedule === 'object') {
    const record = schedule as Record<string, unknown>
    const rawDays = record.days ?? record.weekdays
    const rawStart = record.start ?? record.startTime ?? record.from
    const rawEnd = record.end ?? record.endTime ?? record.to

    const formattedDays = Array.isArray(rawDays)
      ? rawDays
          .map(formatDayToken)
          .filter((label): label is string => label !== null)
      : []
    const daysText = formattedDays.length > 0 ? formattedDays.join(', ') : null

    const startText =
      typeof rawStart === 'string' && rawStart.trim().length > 0
        ? rawStart.trim()
        : null
    const endText =
      typeof rawEnd === 'string' && rawEnd.trim().length > 0
        ? rawEnd.trim()
        : null
    const windowText =
      startText && endText ? `${startText}–${endText}` : null

    if (daysText && windowText) {
      return `${daysText} · ${windowText}`
    }
    if (daysText) {
      return daysText
    }
    if (windowText) {
      return windowText
    }

    return 'Horario personalizado'
  }

  return 'Horario personalizado'
}
