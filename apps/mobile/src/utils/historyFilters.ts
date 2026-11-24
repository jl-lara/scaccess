import type {
  AccessDecision,
  AccessEventDto,
  MyAccessPermissionDto,
} from '@scaccess/shared'

import type { ListMyAccessEventsParams } from '../api/accessEventsApi'

import { TIJUANA_TIME_ZONE } from './formatters'

export type HistoryDatePreset = 'all' | 'today' | '7d' | '30d'

export type HistoryDecisionFilter = 'all' | AccessDecision

export interface HistoryAreaOption {
  id: string
  name: string
  code?: string
}

export interface HistoryFilterState {
  decision: HistoryDecisionFilter
  datePreset: HistoryDatePreset
  areaId: string | null
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  decision: 'all',
  datePreset: 'all',
  areaId: null,
}

const ONE_DAY_MS = 86_400_000

/** Indica si hay algún filtro activo distinto al estado por defecto. */
export function hasActiveHistoryFilters(filters: HistoryFilterState): boolean {
  return (
    filters.decision !== 'all' ||
    filters.datePreset !== 'all' ||
    filters.areaId !== null
  )
}

/**
 * Calcula el instante ISO correspondiente a `00:00:00.000` del día actual
 * en la zona horaria de Tijuana, independientemente de la zona del dispositivo.
 */
export function getTijuanaStartOfDayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIJUANA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const getPart = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  const year = getPart('year')
  const month = getPart('month')
  const day = getPart('day')
  const hour = getPart('hour')
  const minute = getPart('minute')
  const second = getPart('second')

  const asUtcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  const offsetMs = asUtcMs - Math.floor(now.getTime() / 1000) * 1000
  const startOfDayUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs

  return new Date(startOfDayUtcMs).toISOString()
}

/** Construye los parámetros de consulta para `/me/access-events` a partir de los filtros activos. */
export function buildHistoryQueryParams(
  filters: HistoryFilterState,
  page: number,
  pageSize = 20,
  now: Date = new Date(),
): ListMyAccessEventsParams {
  const params: ListMyAccessEventsParams = {
    page,
    pageSize,
  }

  if (filters.decision !== 'all') {
    params.decision = filters.decision
  }

  if (filters.areaId !== null) {
    params.areaId = filters.areaId
  }

  if (filters.datePreset === 'today') {
    params.from = getTijuanaStartOfDayIso(now)
  } else if (filters.datePreset === '7d') {
    params.from = new Date(now.getTime() - 7 * ONE_DAY_MS).toISOString()
  } else if (filters.datePreset === '30d') {
    params.from = new Date(now.getTime() - 30 * ONE_DAY_MS).toISOString()
  }

  return params
}

/**
 * Combina áreas únicas por `id` desde los permisos del empleado y los eventos
 * cargados, ordenadas alfabéticamente por nombre en español.
 */
export function mergeAreaOptions(
  permissions: MyAccessPermissionDto[],
  events: AccessEventDto[],
): HistoryAreaOption[] {
  const byId = new Map<string, HistoryAreaOption>()

  for (const permission of permissions) {
    byId.set(permission.area.id, {
      id: permission.area.id,
      name: permission.area.name,
      code: permission.area.code,
    })
  }

  for (const event of events) {
    if (event.area && !byId.has(event.area.id)) {
      byId.set(event.area.id, {
        id: event.area.id,
        name: event.area.name,
        code: event.area.code,
      })
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es'),
  )
}
