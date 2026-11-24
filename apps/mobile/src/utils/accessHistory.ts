import type { AccessEventDto } from '@scaccess/shared'

import { formatDateKey, formatDayHeading } from './formatters'

/** Umbral en segundos a partir del cual una sincronizacion se considera diferida (offline). */
export const SYNC_DELAY_THRESHOLD_SECONDS = 60

export interface SyncDelayInfo {
  delaySeconds: number | null
  isDelayed: boolean
  shortLabel: string | null
  detailLabel: string
}

export interface AccessEventSection {
  dateKey: string
  title: string
  data: AccessEventDto[]
}

export interface AccessHistorySummary {
  totalCount: number
  loadedCount: number
  grantedCount: number
  deniedCount: number
  delayedCount: number
  latestOccurredAt: string | null
}

/** Formatea una duracion en segundos en una cadena compacta legible en espanol. */
export function formatDurationCompact(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const remMins = Math.floor((seconds % 3600) / 60)
    return remMins > 0 ? `${hours} h ${remMins} min` : `${hours} h`
  }
  const days = Math.floor(seconds / 86400)
  const remHours = Math.floor((seconds % 86400) / 3600)
  return remHours > 0 ? `${days} d ${remHours} h` : `${days} d`
}

/**
 * Calcula el desfase entre la lectura en el dispositivo fisico (`occurredAt`)
 * y su recepcion en el servidor (`receivedAt`).
 */
export function getSyncDelayInfo(
  occurredAt: string,
  receivedAt: string,
): SyncDelayInfo {
  const occurredMs = new Date(occurredAt).getTime()
  const receivedMs = new Date(receivedAt).getTime()
  if (Number.isNaN(occurredMs) || Number.isNaN(receivedMs)) {
    return {
      delaySeconds: null,
      isDelayed: false,
      shortLabel: null,
      detailLabel: 'Tiempo de sincronización no disponible',
    }
  }

  const delaySeconds = Math.max(0, Math.round((receivedMs - occurredMs) / 1000))
  if (delaySeconds < SYNC_DELAY_THRESHOLD_SECONDS) {
    return {
      delaySeconds,
      isDelayed: false,
      shortLabel: null,
      detailLabel: 'Sincronizado en tiempo real',
    }
  }

  const duration = formatDurationCompact(delaySeconds)
  return {
    delaySeconds,
    isDelayed: true,
    shortLabel: `Offline · +${duration}`,
    detailLabel: `Lectura offline sincronizada tras ${duration}`,
  }
}

/**
 * Agrupa eventos por dia local en Tijuana preservando el orden de llegada
 * tanto de las secciones como de los eventos dentro de cada seccion.
 */
export function groupEventsByDay(
  events: AccessEventDto[],
  now: Date = new Date(),
): AccessEventSection[] {
  const sectionsByDay = new Map<string, AccessEventSection>()

  for (const event of events) {
    const dateKey = formatDateKey(event.occurredAt) || 'unknown'
    const existing = sectionsByDay.get(dateKey)
    if (existing) {
      existing.data.push(event)
      continue
    }

    sectionsByDay.set(dateKey, {
      dateKey,
      title: formatDayHeading(dateKey, now),
      data: [event],
    })
  }

  return Array.from(sectionsByDay.values())
}

/** Calcula contadores agregados para el encabezado del historial personal. */
export function summarizeAccessEvents(
  events: AccessEventDto[],
  totalCount?: number,
): AccessHistorySummary {
  let grantedCount = 0
  let deniedCount = 0
  let delayedCount = 0

  for (const event of events) {
    if (event.decision === 'granted') {
      grantedCount += 1
    } else {
      deniedCount += 1
    }

    if (getSyncDelayInfo(event.occurredAt, event.receivedAt).isDelayed) {
      delayedCount += 1
    }
  }

  return {
    totalCount: totalCount ?? events.length,
    loadedCount: events.length,
    grantedCount,
    deniedCount,
    delayedCount,
    latestOccurredAt: events[0]?.occurredAt ?? null,
  }
}
