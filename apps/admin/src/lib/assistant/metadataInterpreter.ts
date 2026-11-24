import { DECISION_LABELS, REASON_LABELS, formatDateTimeWithSeconds } from '../formatters'
import type {
  AssistantEventContext,
  AssistantEventSummary,
  AssistantMetadataItem,
  AssistantTone,
} from './types'

const ENTRY_DIRECTION_VALUES = new Set([
  'in',
  'entry',
  'entrada',
  'enter',
  'arrival',
  'check-in',
  'checkin',
])

const EXIT_DIRECTION_VALUES = new Set([
  'out',
  'exit',
  'salida',
  'leave',
  'departure',
  'check-out',
  'checkout',
])

const REASON_ACTION_HINTS: Record<string, string> = {
  allowed: 'La credencial, el empleado y los permisos de área fueron válidos al momento de la lectura.',
  card_unknown:
    'La tarjeta no existe en el catálogo o aún no está sincronizada en el controlador. Verifica el UID hexadecimal en Tarjetas RFID.',
  card_blocked:
    'La tarjeta está bloqueada administrativamente. Su estado debe reactivarse antes de permitir nuevos accesos.',
  card_lost:
    'La tarjeta fue reportada como extraviada. Debe reemplazarse por una nueva credencial antes de habilitar al empleado.',
  card_retired:
    'La tarjeta fue dada de baja definitivamente. Asigna una credencial activa si el empleado requiere acceso.',
  employee_inactive:
    'El empleado asociado se encuentra inactivo o suspendido en el catálogo.',
  permission_missing:
    'El empleado no tiene un permiso asignado para esta área física.',
  permission_expired:
    'El permiso del empleado para esta área superó su fecha de vigencia (validTo).',
  permission_outside_schedule:
    'El intento ocurrió fuera de la franja horaria permitida en la regla del permiso.',
  area_not_allowed:
    'El controlador detectó que el área solicitada no está habilitada para ese lector o configuración.',
  area_inactive:
    'El área física está deshabilitada temporalmente.',
  device_error:
    'El controlador o el lector RFID reportó una falla técnica durante la lectura o validación.',
}

/** Convierte un valor desconocido a un objeto plano si aplica; devuelve null en otro caso. */
export function normalizeMetadataObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  return raw as Record<string, unknown>
}

function formatPrimitiveValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'Sin valor'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

/** Humaniza claves desconocidas en camelCase, snake_case o kebab-case. */
export function humanizeMetadataKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!spaced) return 'Campo técnico'
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

function classifyRssi(rssi: number): { band: string; tone: AssistantTone; note: string } {
  if (rssi >= -55) {
    return {
      band: 'Excelente',
      tone: 'success',
      note: 'Intensidad de señal óptima entre el controlador ESP32 y el punto de acceso.',
    }
  }
  if (rssi >= -70) {
    return {
      band: 'Buena',
      tone: 'success',
      note: 'Señal estable para sincronización en tiempo real sin pérdida esperada de paquetes.',
    }
  }
  if (rssi >= -85) {
    return {
      band: 'Regular',
      tone: 'warning',
      note: 'Señal moderada; si hay interferencia física podrían presentarse reintentos de envío.',
    }
  }
  return {
    band: 'Débil',
    tone: 'danger',
    note: 'Señal baja; el controlador puede operar en cola offline y sincronizar eventos más tarde.',
  }
}

function interpretKnownMetadataEntry(key: string, value: unknown): AssistantMetadataItem | null {
  const normalizedKey = key.replace(/[_-]/g, '').toLowerCase()

  if (normalizedKey === 'reader' || normalizedKey === 'readermodel' || normalizedKey === 'readertype') {
    const readerName = formatPrimitiveValue(value)
    const upper = readerName.toUpperCase()
    let detail = 'Módulo lector RFID conectado al controlador ESP32-S3 que capturó el UID de la tarjeta.'
    if (upper.includes('PN532')) {
      detail = 'Lector NFC/RFID PN532 (13.56 MHz) conectado al ESP32-S3 para lectura de credenciales.'
    } else if (upper.includes('RC522') || upper.includes('MFRC522')) {
      detail = 'Lector RFID MFRC522/RC522 (13.56 MHz) para tarjetas MIFARE conectado al controlador.'
    } else if (upper.includes('WIEGAND')) {
      detail = 'Interfaz de lectura por protocolo Wiegand conectada al controlador de acceso.'
    }
    return {
      key,
      label: 'Lector RFID',
      value: readerName,
      explanation: detail,
      tone: 'neutral',
    }
  }

  if (normalizedKey === 'rssi') {
    const rssi = parseFiniteNumber(value)
    if (rssi === null) {
      return {
        key,
        label: 'Señal Wi-Fi (RSSI)',
        value: formatPrimitiveValue(value),
        explanation: 'Indicador de intensidad de señal inalámbrica reportado por el controlador.',
        tone: 'neutral',
      }
    }
    const bandInfo = classifyRssi(rssi)
    return {
      key,
      label: 'Señal Wi-Fi (RSSI)',
      value: `${rssi} dBm (${bandInfo.band})`,
      explanation: bandInfo.note,
      tone: bandInfo.tone,
    }
  }

  if (normalizedKey === 'offline') {
    const isOffline = parseBooleanValue(value)
    if (isOffline === null) {
      return {
        key,
        label: 'Modo de operación',
        value: formatPrimitiveValue(value),
        explanation: 'Indica si el controlador validó la tarjeta localmente sin conexión.',
        tone: 'neutral',
      }
    }
    return {
      key,
      label: 'Modo sin conexión',
      value: isOffline ? 'Sí (validación offline)' : 'No (en línea)',
      explanation: isOffline
        ? 'El ESP32-S3 validó el acceso localmente con su caché sincronizado y guardó el evento hasta recuperar conexión.'
        : 'El controlador contaba con conectividad activa al momento de registrar la lectura.',
      tone: isOffline ? 'warning' : 'success',
    }
  }

  if (normalizedKey === 'direction' || normalizedKey === 'action' || normalizedKey === 'movement') {
    const rawText = formatPrimitiveValue(value).trim()
    const lower = rawText.toLowerCase()
    if (ENTRY_DIRECTION_VALUES.has(lower)) {
      return {
        key,
        label: 'Sentido del movimiento',
        value: 'Entrada',
        explanation: `Lectura registrada como ingreso al área (valor original: "${rawText}").`,
        tone: 'success',
      }
    }
    if (EXIT_DIRECTION_VALUES.has(lower)) {
      return {
        key,
        label: 'Sentido del movimiento',
        value: 'Salida',
        explanation: `Lectura registrada como salida del área (valor original: "${rawText}").`,
        tone: 'neutral',
      }
    }
    return {
      key,
      label: 'Sentido / acción',
      value: rawText,
      explanation: 'Acción o dirección del flujo reportada por el lector o simulador.',
      tone: 'neutral',
    }
  }

  if (normalizedKey === 'firmware' || normalizedKey === 'firmwareversion') {
    return {
      key,
      label: 'Versión de firmware',
      value: formatPrimitiveValue(value),
      explanation: 'Versión de firmware instalada en el controlador ESP32-S3 cuando ocurrió el evento.',
      tone: 'neutral',
    }
  }

  if (normalizedKey === 'battery') {
    const num = parseFiniteNumber(value)
    const displayValue =
      num !== null && typeof value === 'number' ? `${num}%` : formatPrimitiveValue(value)
    const tone: AssistantTone = num !== null && num <= 20 ? 'warning' : 'neutral'
    return {
      key,
      label: 'Nivel de batería',
      value: displayValue,
      explanation:
        tone === 'warning'
          ? 'Respaldo de energía bajo; conviene revisar la alimentación eléctrica del punto de acceso.'
          : 'Nivel de respaldo de energía reportado por el dispositivo.',
      tone,
    }
  }

  if (normalizedKey === 'voltage') {
    const num = parseFiniteNumber(value)
    const displayValue =
      num !== null && typeof value === 'number' ? `${num} V` : formatPrimitiveValue(value)
    const tone: AssistantTone = num !== null && num < 3.0 ? 'warning' : 'neutral'
    return {
      key,
      label: 'Voltaje de alimentación',
      value: displayValue,
      explanation:
        tone === 'warning'
          ? 'Voltaje por debajo del rango nominal esperado (3.3 V / 5 V); podría afectar al lector RFID.'
          : 'Voltaje eléctrico medido en la etapa de alimentación del controlador.',
      tone,
    }
  }

  if (normalizedKey === 'temperature') {
    const num = parseFiniteNumber(value)
    const displayValue =
      num !== null && typeof value === 'number' ? `${num} °C` : formatPrimitiveValue(value)
    const tone: AssistantTone = num !== null && num >= 65 ? 'warning' : 'neutral'
    return {
      key,
      label: 'Temperatura del equipo',
      value: displayValue,
      explanation:
        tone === 'warning'
          ? 'Temperatura interna elevada; revisa ventilación o gabinete del controlador.'
          : 'Temperatura reportada por el sensor interno del controlador.',
      tone,
    }
  }

  if (normalizedKey === 'latencyms') {
    const ms = parseFiniteNumber(value)
    let tone: AssistantTone = 'neutral'
    let note = 'Tiempo de respuesta medido durante la operación o sincronización.'
    if (ms !== null) {
      if (ms <= 250) {
        tone = 'success'
        note = 'Latencia baja; la validación y respuesta del punto de acceso fueron ágiles.'
      } else if (ms <= 1000) {
        tone = 'warning'
        note = 'Latencia moderada en la lectura o transferencia hacia el servidor.'
      } else {
        tone = 'danger'
        note = 'Latencia alta; revisa estabilidad de red o carga del enlace.'
      }
    }
    return {
      key,
      label: 'Latencia',
      value: ms !== null ? `${ms} ms` : formatPrimitiveValue(value),
      explanation: note,
      tone,
    }
  }

  if (normalizedKey === 'synced') {
    const synced = parseBooleanValue(value)
    return {
      key,
      label: 'Estado de sincronización',
      value: synced === null ? formatPrimitiveValue(value) : synced ? 'Sincronizado' : 'Pendiente',
      explanation:
        synced === false
          ? 'El controlador marcó este registro como pendiente de confirmación al generarse.'
          : 'Indica que el evento quedó confirmado en el flujo de sincronización.',
      tone: synced === false ? 'warning' : synced === true ? 'success' : 'neutral',
    }
  }

  if (normalizedKey === 'error' || normalizedKey === 'errorcode') {
    const text = formatPrimitiveValue(value)
    const hasError = text.trim().length > 0 && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'none'
    return {
      key,
      label: 'Código de error técnico',
      value: text,
      explanation: hasError
        ? 'Detalle técnico de falla emitido por el controlador o el lector RFID.'
        : 'Sin código de error técnico reportado.',
      tone: hasError ? 'danger' : 'neutral',
    }
  }

  if (normalizedKey === 'reasoncode') {
    const raw = formatPrimitiveValue(value)
    const translated = REASON_LABELS[raw as keyof typeof REASON_LABELS]
    return {
      key,
      label: 'Motivo en metadatos',
      value: translated ? `${translated} (${raw})` : raw,
      explanation:
        REASON_ACTION_HINTS[raw] ?? 'Código de razón técnica adjunto en los metadatos del evento.',
      tone: raw === 'allowed' ? 'success' : 'warning',
    }
  }

  if (normalizedKey === 'configversion') {
    return {
      key,
      label: 'Versión de configuración',
      value: formatPrimitiveValue(value),
      explanation:
        'Instantánea de permisos, tarjetas y áreas que tenía descargada el controlador al evaluar la lectura.',
      tone: 'neutral',
    }
  }

  if (normalizedKey === 'protocol') {
    return {
      key,
      label: 'Protocolo',
      value: formatPrimitiveValue(value),
      explanation: 'Protocolo de comunicación o estándar de tarjeta RFID utilizado en la transacción.',
      tone: 'neutral',
    }
  }

  if (normalizedKey === 'antenna') {
    return {
      key,
      label: 'Antena / canal',
      value: formatPrimitiveValue(value),
      explanation: 'Antena o canal físico del lector que detectó la credencial RFID.',
      tone: 'neutral',
    }
  }

  if (normalizedKey === 'simulated') {
    const isSimulated = parseBooleanValue(value)
    return {
      key,
      label: 'Origen simulado',
      value: isSimulated ? 'Sí (simulador)' : 'No (hardware real)',
      explanation: isSimulated
        ? 'Evento generado desde el simulador operativo del croquis en vivo.'
        : 'Lectura originada desde un punto de acceso físico.',
      tone: 'neutral',
    }
  }

  return null
}

/**
 * Interpreta un objeto de metadatos JSON en una lista ordenada de elementos
 * comprensibles en español para operadores, auditores y monitores.
 */
export function interpretMetadataObject(
  metadata: Record<string, unknown> | null,
): AssistantMetadataItem[] {
  if (!metadata) {
    return []
  }

  const entries = Object.entries(metadata)
  if (entries.length === 0) {
    return []
  }

  return entries.map(([key, value]) => {
    const known = interpretKnownMetadataEntry(key, value)
    if (known) {
      return known
    }
    return {
      key,
      label: humanizeMetadataKey(key),
      value: formatPrimitiveValue(value),
      explanation: `Campo adicional reportado en los metadatos del evento (${key}).`,
      tone: 'neutral',
    }
  })
}

/**
 * Extrae el primer objeto JSON válido dentro de un texto libre o bloque Markdown.
 */
export function extractJsonFromText(input: string): Record<string, unknown> | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      const normalized = normalizeMetadataObject(parsed)
      if (normalized) return normalized
    } catch {
      // Continuar con búsqueda por llaves balanceadas si hay texto alrededor o formato mixto.
    }
  }

  for (let start = 0; start < input.length; start += 1) {
    if (input[start] !== '{') continue

    let depth = 0
    let inString = false
    let escaped = false

    for (let cursor = start; cursor < input.length; cursor += 1) {
      const ch = input[cursor]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\' && inString) {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue

      if (ch === '{') {
        depth += 1
      } else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          const candidate = input.slice(start, cursor + 1)
          try {
            const parsed: unknown = JSON.parse(candidate)
            const normalized = normalizeMetadataObject(parsed)
            if (normalized) return normalized
          } catch {
            // Intentar con la siguiente apertura de llave.
          }
          break
        }
      }
    }
  }

  return null
}

function describeTimingLag(occurredAt: string, receivedAt: string): string {
  const occurredMs = new Date(occurredAt).getTime()
  const receivedMs = new Date(receivedAt).getTime()

  if (!Number.isFinite(occurredMs) || !Number.isFinite(receivedMs)) {
    return 'No fue posible calcular la diferencia de tiempo entre el lector y el servidor.'
  }

  const diffSeconds = Math.round((receivedMs - occurredMs) / 1000)

  if (diffSeconds < -5) {
    return `El servidor registró una marca ${Math.abs(diffSeconds)} s anterior a la hora del lector (${formatDateTimeWithSeconds(occurredAt)} vs ${formatDateTimeWithSeconds(receivedAt)}), lo que sugiere desfase de reloj en el controlador.`
  }

  if (diffSeconds <= 10) {
    return `Sincronización prácticamente en tiempo real (${Math.max(0, diffSeconds)} s de diferencia entre la lectura en el controlador y la recepción en el servidor).`
  }

  if (diffSeconds < 60) {
    return `El evento tardó ${diffSeconds} s en llegar al servidor tras ocurrir en el lector, consistente con reintento de red o cola breve.`
  }

  const minutes = Math.round(diffSeconds / 60)
  return `El evento tardó aproximadamente ${minutes} min en sincronizarse con el servidor, señal habitual de operación offline temporal en el ESP32-S3.`
}

/**
 * Construye una explicación operativa completa en español para un evento
 * seleccionado desde el detalle de la bitácora de accesos.
 */
export function explainAccessEvent(ctx: AssistantEventContext): {
  content: string
  metadataItems: AssistantMetadataItem[]
  eventSummary: AssistantEventSummary
} {
  const decisionLabel = DECISION_LABELS[ctx.decision] ?? ctx.decision
  const reasonLabel = REASON_LABELS[ctx.reasonCode as keyof typeof REASON_LABELS] ?? ctx.reasonCode
  const reasonHint =
    REASON_ACTION_HINTS[ctx.reasonCode] ??
    'Revisa las reglas de vigencia, estado de tarjeta y permisos del área asociada.'
  const timingSummary = describeTimingLag(ctx.occurredAt, ctx.receivedAt)

  const metadataRecord = normalizeMetadataObject(ctx.metadata)
  const metadataItems = interpretMetadataObject(metadataRecord)

  const lines: string[] = [
    `Resultado: ${decisionLabel} — ${reasonLabel}.`,
    reasonHint,
    '',
    `Lectura: tarjeta ${ctx.cardUid} (${ctx.employeeLabel}) en ${ctx.areaLabel} mediante ${ctx.deviceLabel}.`,
    `Tiempos: ${timingSummary}`,
    '',
    'Trazabilidad técnica:',
    `• clientEventId (${ctx.clientEventId}): identificador único generado por el controlador para evitar duplicados al reenviar eventos sincronizados.`,
    `• deviceEpoch (${ctx.deviceEpoch ?? 'sin reportar'}) y deviceSequence (${ctx.deviceSequence ?? 'sin reportar'}): marcan el ciclo de arranque del ESP32-S3 y el orden correlativo de cada lectura.`,
  ]

  if (metadataItems.length === 0) {
    lines.push('', 'Metadatos JSON: este evento no incluyó campos técnicos adicionales.')
  } else {
    lines.push(
      '',
      `Metadatos JSON: se interpretaron ${metadataItems.length} ${metadataItems.length === 1 ? 'campo técnico' : 'campos técnicos'} debajo.`,
    )
  }

  return {
    content: lines.join('\n'),
    metadataItems,
    eventSummary: {
      title: `${ctx.areaLabel} · ${ctx.employeeLabel}`,
      decision: ctx.decision,
      decisionLabel,
      reasonLabel,
      cardUid: ctx.cardUid,
    },
  }
}
