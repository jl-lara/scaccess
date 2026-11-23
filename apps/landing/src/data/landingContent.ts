export type ReaderScenarioId = 'authorized' | 'unknown' | 'offline'

export interface ReaderScenario {
  id: ReaderScenarioId
  label: string
  statusBadge: string
  statusTone: 'granted' | 'denied' | 'offline'
  cardUid: string
  holderName: string
  areaName: string
  latencyMs: string
  relayState: string
  syncQueueState: string
  occurredAt: string
  receivedAt: string
  explanation: string
}

export const READER_SCENARIOS: ReadonlyArray<ReaderScenario> = [
  {
    id: 'authorized',
    label: 'Tarjeta autorizada',
    statusBadge: 'Acceso concedido',
    statusTone: 'granted',
    cardUid: '04:A8:3C:92:1F',
    holderName: 'Mtra. Valeria Mendoza',
    areaName: 'Laboratorio de Telemática B2',
    latencyMs: '18 ms',
    relayState: 'Relevador liberado (3 s)',
    syncQueueState: 'Sincronizado en línea',
    occurredAt: '09:42:11.204',
    receivedAt: '09:42:11.348',
    explanation:
      'La credencial coincide con la lista blanca activa para el área y activa la cerradura eléctrica al instante.',
  },
  {
    id: 'unknown',
    label: 'Tarjeta desconocida',
    statusBadge: 'Acceso denegado',
    statusTone: 'denied',
    cardUid: '04:F1:77:09:B4',
    holderName: 'Tarjeta no registrada',
    areaName: 'Centro de Datos Norte',
    latencyMs: '14 ms',
    relayState: 'Cerradura bloqueada',
    syncQueueState: 'Evento conservado para auditoría',
    occurredAt: '09:45:03.812',
    receivedAt: '09:45:03.940',
    explanation:
      'Cada lectura no autorizada se rechaza en puerta y se conserva íntegra en la bitácora sin asociar empleado.',
  },
  {
    id: 'offline',
    label: 'Modo sin conexión',
    statusBadge: 'Validación local activa',
    statusTone: 'offline',
    cardUid: '04:5E:19:C4:80',
    holderName: 'Ing. Diego Castellanos',
    areaName: 'Taller de Manufactura A1',
    latencyMs: '11 ms',
    relayState: 'Relevador liberado (caché local)',
    syncQueueState: 'Cola NVS · 1 evento pendiente',
    occurredAt: '09:48:27.095',
    receivedAt: 'En espera de enlace',
    explanation:
      'Sin Wi-Fi ni Internet, el ESP32-S3 valida contra su memoria local y resguarda client_event_id hasta reconectar.',
  },
]

export interface HardwareSpec {
  term: string
  value: string
  detail: string
}

export const HARDWARE_SPECS: ReadonlyArray<HardwareSpec> = [
  {
    term: 'ESP32-S3',
    value: 'Controlador dual-core',
    detail: 'Ejecución autónoma en puerta con almacenamiento no volátil.',
  },
  {
    term: 'RFID 13.56 MHz',
    value: 'Lectura sin contacto',
    detail: 'Identificación rápida de credenciales institucionales en milisegundos.',
  },
  {
    term: 'Validación local',
    value: 'Operación offline-first',
    detail: 'Decisión autónoma sin depender de latencia o enlace hacia la nube.',
  },
  {
    term: 'Sincronización resiliente',
    value: 'Eventos idempotentes',
    detail: 'Cola segura con deduplicación por client_event_id al recuperar red.',
  },
]

export interface WorkflowStep {
  stepNumber: number
  title: string
  description: string
}

export const WORKFLOW_STEPS: ReadonlyArray<WorkflowStep> = [
  {
    stepNumber: 1,
    title: 'Acredita al personal',
    description:
      'Registra colaboradores y asigna tarjetas RFID únicas desde la consola administrativa sin trámites manuales.',
  },
  {
    stepNumber: 2,
    title: 'Define permisos por área',
    description:
      'Establece qué zonas puede abrir cada persona y consulta la distribución física del edificio en un croquis en vivo.',
  },
  {
    stepNumber: 3,
    title: 'Valida en puerta sin depender de Internet',
    description:
      'El nodo ESP32-S3 resuelve cada lectura contra su caché local en milisegundos, incluso durante cortes de red.',
  },
  {
    stepNumber: 4,
    title: 'Audita cada lectura al instante',
    description:
      'Los eventos suben de manera idempotente preservando la hora exacta de puerta y el momento de recepción en servidor.',
  },
]

export interface AboutPrinciple {
  title: string
  description: string
}

export const ABOUT_PRINCIPLES: ReadonlyArray<AboutPrinciple> = [
  {
    title: 'Autonomía real en cada puerta',
    description:
      'Un laboratorio o edificio no puede quedarse cerrado por una caída de Wi-Fi. La lógica crítica vive junto a la cerradura.',
  },
  {
    title: 'Trazabilidad histórica intacta',
    description:
      'Ningún registro de acceso se borra, incluidos intentos con tarjetas desconocidas, para respaldar auditorías reales.',
  },
  {
    title: 'Ingeniería aplicada desde Tijuana',
    description:
      'Diseñado y probado en la Universidad Tecnológica de Tijuana uniendo electrónica embebida, API REST y experiencia web clara.',
  },
]

export const CONTACT_REASONS: ReadonlyArray<string> = [
  'Demostración institucional',
  'Piloto en campus o laboratorio',
  'Arquitectura y hardware ESP32-S3',
  'Otro motivo',
]
