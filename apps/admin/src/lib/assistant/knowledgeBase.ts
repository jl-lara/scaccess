import { REASON_LABELS } from '../formatters'
import type { WebPermissions } from '../permissions'
import {
  explainAccessEvent,
  extractJsonFromText,
  interpretMetadataObject,
} from './metadataInterpreter'
import type { AssistantProvider, AssistantReply, AssistantRequest } from './types'

function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function matchesAny(normalized: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => normalized.includes(keyword))
}

function isRoute(pathname: string, base: string): boolean {
  if (base === '/') return pathname === '/'
  return pathname === base || pathname.startsWith(`${base}/`)
}

/**
 * Devuelve preguntas rápidas contextuales adaptadas a la ruta actual y al perfil RBAC.
 * El perfil Monitor (viewer) nunca recibe sugerencias de administración de catálogos o cuentas,
 * y ningún perfil distinto de Administrador recibe sugerencias de gestión de cuentas y roles.
 */
export function getContextualSuggestions(
  pathname: string,
  permissions: WebPermissions,
): string[] {
  if (isRoute(pathname, '/access-events')) {
    const prompts = [
      '¿Cuál es la diferencia entre Ocurrió (lector) y Recibido (servidor)?',
      '¿Qué significan los motivos de denegación?',
      '¿Cómo interpreto los metadatos JSON de un evento?',
    ]
    if (permissions.canExportReports) {
      prompts.push('¿Cómo funciona la exportación a PDF?')
    }
    return prompts
  }

  if (isRoute(pathname, '/areas')) {
    const prompts = [
      '¿Cómo leer el croquis en vivo y el aforo por área?',
      '¿Qué significan los motivos de denegación?',
    ]
    if (permissions.canUseSimulator) {
      prompts.unshift('¿Qué reglas valida el simulador del croquis?')
    }
    return prompts
  }

  if (isRoute(pathname, '/employees') && permissions.canViewCatalogs) {
    return [
      '¿Cómo afecta el estado de un empleado al acceso RFID?',
      '¿Qué significan los motivos de denegación?',
      '¿Qué puede hacer cada rol en la consola?',
    ]
  }

  if (isRoute(pathname, '/credentials') && permissions.canViewCatalogs) {
    return [
      '¿Qué formato debe tener el UID de una tarjeta RFID?',
      '¿Qué diferencia hay entre tarjeta bloqueada, extraviada y retirada?',
      '¿Cómo interpreto los metadatos JSON de un evento?',
    ]
  }

  if (isRoute(pathname, '/permissions') && permissions.canViewCatalogs) {
    return [
      '¿Cómo funcionan las vigencias y horarios de un permiso?',
      '¿Qué significan los motivos de denegación?',
      '¿Qué reglas valida el simulador del croquis?',
    ].filter((prompt) => permissions.canUseSimulator || !prompt.includes('simulador'))
  }

  if (isRoute(pathname, '/devices') && permissions.canViewCatalogs) {
    return [
      '¿Cuándo aparece un controlador En línea vs Sin conexión?',
      '¿Qué indica configVersion y la sincronización pendiente?',
      '¿Cuál es la diferencia entre Ocurrió (lector) y Recibido (servidor)?',
    ]
  }

  if (isRoute(pathname, '/users') && permissions.canManageUsers) {
    return [
      '¿Qué puede hacer cada rol en la consola?',
      '¿Cómo gestionar cuentas y roles administrativos?',
    ]
  }

  // Ruta raíz ('/') u otras rutas generales
  if (!permissions.canViewCatalogs) {
    return [
      '¿Qué puede consultar el perfil Monitor?',
      '¿Cuál es la diferencia entre Ocurrió (lector) y Recibido (servidor)?',
      '¿Cómo leer el croquis en vivo y el aforo por área?',
      '¿Cómo interpreto los metadatos JSON de un evento?',
    ]
  }

  const dashboardPrompts = [
    '¿Cuándo aparece un controlador En línea vs Sin conexión?',
    '¿Cuál es la diferencia entre Ocurrió (lector) y Recibido (servidor)?',
    '¿Cómo interpreto los metadatos JSON de un evento?',
  ]

  if (permissions.canManageUsers) {
    dashboardPrompts.push('¿Qué puede hacer cada rol en la consola?')
  } else if (permissions.canExportReports) {
    dashboardPrompts.push('¿Cómo funciona la exportación a PDF?')
  }

  return dashboardPrompts
}

function buildRoleGuidance(permissions: WebPermissions): string {
  const lines = [
    `Tu perfil activo es ${permissions.profileLabel} (${permissions.profileSummary}).`,
    '',
    'Capacidades por rol en Accesa:',
    '• Monitor (viewer): solo lectura en tiempo real de Panel de control, Bitácora de accesos y Croquis en vivo.',
    '• Auditor (auditor): lectura de bitácora, catálogos, dispositivos y exportación de reportes PDF.',
    '• Operador (operator): operación diaria sobre empleados, tarjetas RFID, permisos de acceso, simulador del croquis y reportes PDF.',
    '• Administrador (admin): control total, incluyendo áreas físicas, controladores ESP32 y Cuentas y roles.',
  ]

  if (permissions.canManageUsers) {
    lines.push(
      '',
      'En el módulo Cuentas y roles puedes vincular usuarios autenticados, asignar roles del sistema y habilitar o deshabilitar cuentas administrativas.',
    )
  }

  return lines.join('\n')
}

function buildDenialReasonsReply(): string {
  const entries = (Object.entries(REASON_LABELS) as [string, string][])
    .filter(([code]) => code !== 'allowed')
    .map(([code, label]) => `• ${label} (${code})`)

  return [
    'Motivos oficiales de denegación registrados en la bitácora:',
    ...entries,
    '',
    'Si abres el detalle de cualquier evento en la bitácora y pulsas "Explicar metadatos con el asistente", puedo analizar la causa exacta y sus campos técnicos.',
  ].join('\n')
}

function buildMetadataHelpReply(): string {
  return [
    'Los metadatos JSON de un evento contienen telemetría opcional enviada por el controlador ESP32-S3 junto con la lectura RFID.',
    '',
    'Claves más comunes que puedo interpretar automáticamente:',
    '• reader: módulo lector conectado (por ejemplo PN532 o RC522).',
    '• rssi: intensidad Wi-Fi en dBm (Excelente >= -55, Buena >= -70, Regular >= -85, Débil < -85).',
    '• offline: indica si el controlador validó la tarjeta localmente sin conexión.',
    '• direction / action: sentido del flujo (Entrada o Salida).',
    '• firmware / configVersion / latencyMs / battery / voltage / temperature / errorCode.',
    '',
    'Pega cualquier objeto JSON aquí (por ejemplo {"reader":"PN532","rssi":-62,"offline":true}) y te lo traduzco campo por campo.',
  ].join('\n')
}

function buildTimingReply(): string {
  return [
    'Diferencia entre "Ocurrió (lector)" y "Recibido (servidor)":',
    '• Ocurrió (lector) [occurredAt]: hora exacta en que el controlador ESP32-S3 leyó la tarjeta RFID en puerta.',
    '• Recibido (servidor) [receivedAt]: hora en que la API recibió y persistió el evento en PostgreSQL.',
    '',
    'Si el controlador perdió red temporalmente (operación offline), guarda los eventos en cola local y los sincroniza al reconectarse; en ese caso Recibido será posterior a Ocurrió.',
    'La idempotencia se garantiza mediante clientEventId para no duplicar lecturas si un envío se reintenta.',
  ].join('\n')
}

function buildRfidFormatReply(permissions: WebPermissions): string {
  const lines = [
    'Formato válido de UID para tarjetas RFID en Accesa:',
    '• Cadena hexadecimal en mayúsculas de longitud par entre 8 y 32 caracteres (equivalente a 4 a 16 bytes, por ejemplo 04A1B2C3D4E5F6).',
    '• Al capturar o filtrar, la consola normaliza espacios, guiones y dos puntos automáticamente.',
    '',
    'Estados de una credencial:',
    '• Activa: habilitada para validar acceso según permisos.',
    '• Bloqueada: suspendida temporalmente (deniega como "Tarjeta bloqueada").',
    '• Extraviada: reportada como perdida (deniega como "Tarjeta reportada extraviada").',
    '• Retirada: dada de baja definitiva.',
  ]

  if (!permissions.canWriteCatalog) {
    lines.push(
      '',
      'Nota: tu perfil actual es de solo lectura; los cambios de alta o bloqueo de tarjetas corresponden a Operador o Administrador.',
    )
  }

  return lines.join('\n')
}

function buildConnectivityReply(permissions: WebPermissions): string {
  const lines = [
    'Conectividad de controladores ESP32 y versión de configuración:',
    '• En línea: el controlador está en estado Activo y su último reporte (lastSeenAt) ocurrió hace 15 minutos o menos.',
    '• Sin conexión: no ha reportado actividad en más de 15 minutos, nunca ha sincronizado o está inactivo/en mantenimiento.',
    '• configVersion: compara la versión de catálogo/permisos aplicada en el ESP32 contra la esperada en el servidor. Si difieren, el panel marca sincronización pendiente hasta que el dispositivo descargue el nuevo paquete.',
  ]

  if (!permissions.canViewCatalogs) {
    lines.push(
      '',
      'Tu perfil Monitor consulta la actividad de accesos y el croquis sin acceder al inventario técnico de controladores.',
    )
  }

  return lines.join('\n')
}

function buildCroquisAndSimulatorReply(permissions: WebPermissions): string {
  const lines = [
    'Croquis en vivo y cálculo de presencia:',
    '• Muestra las áreas físicas configuradas, su ocupación actual, capacidad máxima (aforo) y el último movimiento conocido (Entrada o Salida) por persona.',
  ]

  if (permissions.canUseSimulator) {
    lines.push(
      '',
      'Reglas que valida el simulador de accesos en el croquis:',
      '1. Estado del empleado: debe encontrarse Activo (no inactivo ni suspendido).',
      '2. Tarjeta RFID: debe tener al menos una credencial en estado Activa.',
      '3. Permiso vigente: el área debe estar activa y el empleado debe contar con permiso no revocado dentro de vigencia y horario.',
      '4. Aforo del área: la ocupación actual debe ser menor a la capacidad configurada en la zona.',
    )
  } else {
    lines.push(
      '',
      'Tu perfil permite observar ocupación, aforo y líneas de movimiento en tiempo real; la simulación interactiva de entradas y salidas solo está habilitada para Operador y Administrador.',
    )
  }

  return lines.join('\n')
}

function buildPdfExportReply(permissions: WebPermissions): string {
  if (!permissions.canExportReports) {
    return 'La exportación de reportes PDF en la Bitácora de accesos está disponible para los perfiles Auditor, Operador y Administrador. Tu perfil Monitor está orientado únicamente a consulta en vivo en pantalla.'
  }

  return [
    'Cómo exportar reportes PDF desde la Bitácora de accesos:',
    '1. Aplica primero los filtros deseados (resultado, motivo, área, UID o rango de fechas).',
    '2. Pulsa "Exportar reporte PDF" en la barra superior de la bitácora.',
    '3. El navegador genera un documento PDF con el resumen de filtros activos, fecha de generación, total encontrado y las filas visibles (incluyendo hora de lector y servidor).',
  ].join('\n')
}

function buildEmployeeStatusReply(permissions: WebPermissions): string {
  if (!permissions.canViewCatalogs) {
    return 'Tu perfil Monitor solo consulta eventos y ocupación en vivo sin acceso al catálogo de empleados. Cuando un empleado está inactivo o suspendido, sus lecturas aparecen denegadas en la bitácora con el motivo "Empleado inactivo o suspendido".'
  }

  return [
    'Relación entre el estado del empleado y el control de acceso:',
    '• Activo: puede ingresar a las áreas donde tenga permiso vigente y credencial activa.',
    '• Inactivo o Suspendido: cualquier intento con sus tarjetas se deniega con el motivo "Empleado inactivo o suspendido" (employee_inactive).',
    '• Los códigos de empleado validan formato alfanumérico (2 a 32 caracteres con al menos una letra, por ejemplo EMP-001).',
  ].join('\n')
}

function buildPermissionsScheduleReply(permissions: WebPermissions): string {
  if (!permissions.canViewCatalogs) {
    return 'Las reglas de permisos por área son administradas por Operadores y Administradores. En la bitácora podrás ver los rechazos correspondientes como "Sin permiso para esta área", "Permiso vencido" o "Fuera de horario permitido".'
  }

  return [
    'Reglas de los permisos de acceso por área:',
    '• Cada permiso vincula un empleado con un área física y opcionalmente define vigencia (validFrom / validTo) y horario.',
    '• Si no existe permiso activo o fue revocado, el lector responde "Sin permiso para esta área".',
    '• Si venció la fecha límite responde "Permiso vencido"; si la lectura ocurre fuera de la franja horaria configurada responde "Fuera de horario permitido".',
  ].join('\n')
}

/**
 * Proveedor local determinista sin dependencias externas ni llamadas a red.
 * Interpreta JSON pegado por el usuario, explica eventos de bitácora y responde
 * consultas operativas respetando siempre el perfil RBAC de la sesión.
 */
export class LocalKnowledgeAssistantProvider implements AssistantProvider {
  readonly id = 'local-knowledge'
  readonly name = 'Asistente operativo local Accesa'

  async reply(request: AssistantRequest): Promise<AssistantReply> {
    const { message, pageContext, eventContext } = request
    const { pathname, permissions } = pageContext

    // 1. Detectar JSON pegado directamente en el mensaje
    const extractedJson = extractJsonFromText(message)
    if (extractedJson) {
      const items = interpretMetadataObject(extractedJson)
      if (items.length === 0) {
        return {
          content:
            'Detecté un objeto JSON válido, pero está vacío ({}), por lo que no contiene metadatos técnicos para interpretar.',
          metadataItems: [],
          suggestions: getContextualSuggestions(pathname, permissions),
        }
      }
      return {
        content: `Interpreté ${items.length} ${items.length === 1 ? 'campo' : 'campos'} de los metadatos JSON proporcionados:`,
        metadataItems: items,
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    const normalized = normalizeQuery(message)

    // 2. Si hay un evento activo y el usuario pregunta por el evento actual
    if (
      eventContext &&
      matchesAny(normalized, ['este evento', 'evento actual', 'analizar evento', 'explica el evento'])
    ) {
      const explanation = explainAccessEvent(eventContext)
      return {
        content: explanation.content,
        metadataItems: explanation.metadataItems,
        eventSummary: explanation.eventSummary,
      }
    }

    // 3. Gestión de cuentas/roles restringida para no-admins
    if (
      matchesAny(normalized, ['cuenta', 'cuentas', 'usuario', 'usuarios', 'gestionar rol', 'crear rol']) &&
      !permissions.canManageUsers
    ) {
      return {
        content: [
          'La administración de Cuentas y roles es exclusiva del perfil Administrador.',
          '',
          buildRoleGuidance(permissions),
        ].join('\n'),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 4. Diferencia Ocurrió vs Recibido / latencia de sincronización
    if (
      matchesAny(normalized, [
        'ocurrio',
        'recibido',
        'servidor',
        'diferencia',
        'desfase',
        'retraso',
        'clienteventid',
        'idempoten',
      ])
    ) {
      return {
        content: buildTimingReply(),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 5. Motivos de denegación
    if (
      matchesAny(normalized, [
        'motivo',
        'denegac',
        'denegado',
        'rechazo',
        'rechaz',
        'reason',
        'card_unknown',
        'permission_missing',
      ])
    ) {
      return {
        content: buildDenialReasonsReply(),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 6. Metadatos JSON / RSSI / PN532 / offline
    if (
      matchesAny(normalized, [
        'metadato',
        'json',
        'rssi',
        'pn532',
        'rc522',
        'reader',
        'telemetria',
        'epoch',
        'secuencia',
      ])
    ) {
      return {
        content: buildMetadataHelpReply(),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 7. Tarjetas RFID y formato UID
    if (
      matchesAny(normalized, [
        'uid',
        'tarjeta',
        'rfid',
        'hexadecimal',
        'credencial',
        'bloqueada',
        'extraviada',
        'retirada',
      ])
    ) {
      return {
        content: buildRfidFormatReply(permissions),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 8. Conectividad ESP32 y configVersion
    if (
      matchesAny(normalized, [
        'en linea',
        'sin conexion',
        'conectividad',
        'esp32',
        'controlador',
        'configversion',
        'sincroniz',
        'heartbeat',
        '15 min',
      ])
    ) {
      return {
        content: buildConnectivityReply(permissions),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 9. Croquis en vivo y simulador
    if (
      matchesAny(normalized, [
        'croquis',
        'simulad',
        'aforo',
        'capacidad',
        'ocupacion',
        'zona',
        'presencia',
      ])
    ) {
      return {
        content: buildCroquisAndSimulatorReply(permissions),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 10. Exportación PDF
    if (matchesAny(normalized, ['pdf', 'exportar', 'reporte', 'imprimir'])) {
      return {
        content: buildPdfExportReply(permissions),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 11. Vigencias y horarios de permisos
    if (matchesAny(normalized, ['vigencia', 'horario', 'validto', 'validfrom', 'permiso'])) {
      return {
        content: buildPermissionsScheduleReply(permissions),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 12. Estado de empleado
    if (matchesAny(normalized, ['empleado', 'inactivo', 'suspendido', 'codigo de empleado'])) {
      return {
        content: buildEmployeeStatusReply(permissions),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 13. Roles y perfil Monitor
    if (
      matchesAny(normalized, [
        'rol',
        'perfil',
        'monitor',
        'viewer',
        'auditor',
        'operador',
        'administrador',
        'rbac',
        'cuenta',
      ])
    ) {
      return {
        content: buildRoleGuidance(permissions),
        suggestions: getContextualSuggestions(pathname, permissions),
      }
    }

    // 14. Respuesta de respaldo adaptada al perfil
    const capabilitiesNote = permissions.canViewCatalogs
      ? 'Puedo ayudarte a interpretar metadatos JSON, revisar motivos de denegación, validar formatos de UID RFID, entender la sincronización de controladores ESP32, exportar PDF o consultar las reglas del croquis.'
      : 'Puedo ayudarte a interpretar metadatos JSON de eventos, entender los motivos de denegación, distinguir la hora del lector vs servidor y leer la ocupación del croquis en vivo.'

    return {
      content: [
        `No identifiqué una consulta específica para "${message.trim()}".`,
        '',
        capabilitiesNote,
        'También puedes pegar directamente un bloque JSON de metadatos para obtener su traducción campo por campo.',
      ].join('\n'),
      suggestions: getContextualSuggestions(pathname, permissions),
    }
  }
}
