/**
 * Contratos compartidos entre los clientes y la API.
 *
 * Estos tipos son la referencia canonica para las respuestas HTTP. Se iran
 * adoptando desde `apps/api`, `apps/admin` y `apps/mobile` cuando se
 * implementen los endpoints correspondientes.
 */

export const API_VERSION = 'v1' as const
export const API_BASE_PATH = `/api/${API_VERSION}` as const

export interface ApiErrorDetail {
  path: string
  message: string
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: ApiErrorDetail[]
  }
}

export interface HealthCheckResponse {
  status: 'ok'
  service: string
  timestamp: string
  uptimeSeconds: number
}

export interface DeviceSyncPayload {
  deviceId: string
  syncVersion: string
  generatedAt: string
}

export interface DeviceEventSyncItem {
  clientEventId: string
  cardUid: string
  deviceId: string
  occurredAt: string
  decision: 'granted' | 'denied'
  areaId?: string
}

export interface DeviceEventSyncRequest {
  deviceId: string
  events: DeviceEventSyncItem[]
}

export interface DeviceEventSyncResponse {
  accepted: string[]
  duplicated: string[]
  rejected: Array<{ clientEventId: string; reason: string }>
}
