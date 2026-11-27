import type { AccessEventDto } from '@scaccess/shared'

import { getSyncDelayInfo } from './accessHistory'
import {
  DECISION_LABELS,
  REASON_LABELS,
  getEventAreaDisplayName,
} from './areaLabels'
import { formatCardUid, formatDateTime } from './formatters'

export interface EventReceiptSharePayload {
  title: string
  message: string
}

/**
 * Construye el texto legible en espanol para compartir un comprobante
 * del evento de acceso desde la pantalla de detalle.
 */
export function buildEventReceiptMessage(
  event: AccessEventDto,
): EventReceiptSharePayload {
  const syncDelay = getSyncDelayInfo(event.occurredAt, event.receivedAt)
  const lines = [
    'Comprobante de evento de acceso — Accesa',
    `Resultado: ${DECISION_LABELS[event.decision]}`,
    `Motivo: ${REASON_LABELS[event.reasonCode]}`,
    `Área: ${getEventAreaDisplayName(event)}`,
    `Fecha y hora: ${formatDateTime(event.occurredAt)}`,
    `Registrado en sistema: ${formatDateTime(event.receivedAt)}`,
    `Sincronización: ${syncDelay.detailLabel}`,
    `Tarjeta RFID: ${formatCardUid(event.cardUid) || '—'}`,
    `Referencia: ${event.clientEventId}`,
  ]

  return {
    title: 'Comprobante de acceso — Accesa',
    message: lines.join('\n'),
  }
}
