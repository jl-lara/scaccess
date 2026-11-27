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

export const HISTORY_DECISION_CHECKLIST: ReadonlyArray<{
  value: AccessDecision
  label: string
}> = [
  { value: 'granted', label: 'Permitidos' },
  { value: 'denied', label: 'Denegados' },
]

export const HISTORY_DATE_CHECKLIST: ReadonlyArray<{
  value: Exclude<HistoryDatePreset, 'all'>
  label: string
}> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
]

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

/** Cuenta cuántos filtros de historial están activos (`0..3`). */
export function countActiveHistoryFilters(filters: HistoryFilterState): number {
  let count = 0
  if (filters.decision !== 'all') {
    count += 1
  }
  if (filters.datePreset !== 'all') {
    count += 1
  }
  if (filters.areaId !== null) {
    count += 1
  }
  return count
}

/** Devuelve las etiquetas legibles de los filtros activos en orden de presentación. */
export function getActiveFilterSummaryLabels(
  filters: HistoryFilterState,
  areaOptions: HistoryAreaOption[],
): string[] {
  const labels: string[] = []

  if (filters.decision !== 'all') {
    const match = HISTORY_DECISION_CHECKLIST.find(
      (item) => item.value === filters.decision,
    )
    if (match) {
      labels.push(match.label)
    }
  }

  if (filters.datePreset !== 'all') {
    const match = HISTORY_DATE_CHECKLIST.find(
      (item) => item.value === filters.datePreset,
    )
    if (match) {
      labels.push(match.label)
    }
  }

  if (filters.areaId !== null) {
    const areaName =
      areaOptions.find((a) => a.id === filters.areaId)?.name ??
      'Área seleccionada'
    labels.push(areaName)
  }

  return labels
}

/** Alterna el filtro de decisión entre el valor objetivo y `'all'`. */
export function toggleDecisionFilter(
  current: HistoryDecisionFilter,
  target: AccessDecision,
): HistoryDecisionFilter {
  return current === target ? 'all' : target
}

/** Alterna el filtro de fecha predefinida entre el valor objetivo y `'all'`. */
export function toggleDatePresetFilter(
  current: HistoryDatePreset,
  target: Exclude<HistoryDatePreset, 'all'>,
): HistoryDatePreset {
  return current === target ? 'all' : target
}

/** Alterna el filtro de área entre el `areaId` indicado y `null`. */
export function toggleAreaFilter(
  current: string | null,
  areaId: string,
): string | null {
  return current === areaId ? null : areaId
}
