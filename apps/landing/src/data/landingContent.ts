export type ReaderScenarioId = 'authorized' | 'unknown' | 'offline'

export interface ReaderScenario {
  id: ReaderScenarioId
  nodeId: string
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
    nodeId: 'ESP32-B2-01',
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
    nodeId: 'ESP32-DC-02',
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
    nodeId: 'ESP32-A1-03',
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

export interface KeyMetric {
  value: string
  label: string
  detail: string
}

export const KEY_METRICS: ReadonlyArray<KeyMetric> = [
  {
    value: '< 20 ms',
    label: 'Validación local en puerta',
    detail: 'Resolución inmediata contra memoria no volátil en ESP32-S3.',
  },
  {
    value: '100 %',
    label: 'Operación continua sin Wi-Fi',
    detail: 'Apertura autónoma y resguardo de eventos ante caídas de red.',
  },
  {
    value: '4 perfiles',
    label: 'Control RBAC + app móvil',
    detail: 'Permisos separados para consola administrativa y empleados.',
  },
  {
    value: '0 pérdidas',
    label: 'Bitácora inmutable idempotente',
    detail: 'Deduplicación por client_event_id incluyendo tarjetas desconocidas.',
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

export interface FloorplanZone {
  id: string
  name: string
  code: string
  currentOccupancy: number
  capacity: number
  deviceId: string
  syncState: string
  lastEvent: string
}

export const FLOORPLAN_ZONES: ReadonlyArray<FloorplanZone> = [
  {
    id: 'redes',
    name: 'Laboratorio de Redes',
    code: 'LAB-RED-B2',
    currentOccupancy: 14,
    capacity: 24,
    deviceId: 'ESP32-01',
    syncState: 'Sincronizado hace 4 s',
    lastEvent: 'Mtra. Valeria Mendoza · Acceso concedido (09:42)',
  },
  {
    id: 'datacenter',
    name: 'Centro de Datos Norte',
    code: 'DC-NORTE',
    currentOccupancy: 2,
    capacity: 4,
    deviceId: 'ESP32-02',
    syncState: 'Sincronizado hace 2 s',
    lastEvent: 'Tarjeta 04:F1:77:09:B4 · Acceso denegado (09:45)',
  },
  {
    id: 'prototipos',
    name: 'Taller de Prototipos',
    code: 'TALLER-A1',
    currentOccupancy: 9,
    capacity: 18,
    deviceId: 'ESP32-03',
    syncState: 'Modo local · 1 evento en cola',
    lastEvent: 'Ing. Diego Castellanos · Caché local (09:48)',
  },
  {
    id: 'archivo',
    name: 'Archivo Técnico',
    code: 'ARCH-TEC-04',
    currentOccupancy: 1,
    capacity: 6,
    deviceId: 'ESP32-04',
    syncState: 'Sincronizado hace 9 s',
    lastEvent: 'Lic. Sofía Navarro · Acceso concedido (09:15)',
  },
]

export interface MobileEventItem {
  id: string
  area: string
  timestamp: string
  decision: 'Permitido' | 'Denegado'
  cardUid: string
  method: string
}

export const MOBILE_EVENTS: ReadonlyArray<MobileEventItem> = [
  {
    id: 'evt-1',
    area: 'Laboratorio de Telemática B2',
    timestamp: 'Hoy · 08:14',
    decision: 'Permitido',
    cardUid: '04:A8:3C:92:1F',
    method: 'Validación en línea · ESP32-01',
  },
  {
    id: 'evt-2',
    area: 'Taller de Manufactura A1',
    timestamp: 'Ayer · 17:42',
    decision: 'Permitido',
    cardUid: '04:A8:3C:92:1F',
    method: 'Caché local offline · ESP32-03',
  },
  {
    id: 'evt-3',
    area: 'Centro de Datos Norte',
    timestamp: '19 nov · 12:05',
    decision: 'Denegado',
    cardUid: '04:A8:3C:92:1F',
    method: 'Área sin permiso vigente',
  },
]

export type RoleProfileId = 'admin' | 'operator' | 'auditor' | 'viewer' | 'employee'

export interface RbacRole {
  id: RoleProfileId
  label: string
  surface: string
  summary: string
  permissions: ReadonlyArray<string>
  restrictions: ReadonlyArray<string>
}

export const RBAC_ROLES: ReadonlyArray<RbacRole> = [
  {
    id: 'admin',
    label: 'Administrador',
    surface: 'Consola web administrativa',
    summary:
      'Gobierno total del sistema: configura áreas físicas, controladores ESP32-S3, cuentas de usuario y catálogos operativos.',
    permissions: [
      'Alta y edición de áreas físicas, zonas horarias y estado operativo.',
      'Provisión de controladores ESP32-S3 y emisión única de credenciales de dispositivo.',
      'Gestión de cuentas administrativas y asignación de perfiles RBAC.',
      'Exportación de reportes PDF y acceso completo al simulador de accesos.',
    ],
    restrictions: [
      'No puede eliminar eventos históricos de la bitácora de accesos.',
      'Los tokens de dispositivo se muestran una sola vez al emitirse.',
    ],
  },
  {
    id: 'operator',
    label: 'Operador',
    surface: 'Consola web administrativa',
    summary:
      'Encargado de la operación cotidiana: acredita colaboradores, asigna tarjetas RFID y administra permisos por área.',
    permissions: [
      'Registro y actualización de empleados y credenciales RFID hexagonales.',
      'Otorgamiento y revocación de permisos de acceso con vigencia opcional.',
      'Consulta de bitácora, exportación de reportes PDF y pruebas en simulador.',
    ],
    restrictions: [
      'Sin permisos para crear áreas físicas ni administrar controladores ESP32-S3.',
      'Sin acceso a la gestión de cuentas y roles administrativos.',
    ],
  },
  {
    id: 'auditor',
    label: 'Auditor',
    surface: 'Consola web administrativa',
    summary:
      'Supervisión independiente y cumplimiento institucional en modo solo lectura sobre catálogos, croquis y bitácora.',
    permissions: [
      'Consulta completa de la bitácora con marcas occurred_at y received_at.',
      'Inspección de metadatos JSON y exportación de reportes PDF institucionales.',
      'Visualización del catálogo de áreas, ocupación y estado de sincronización.',
    ],
    restrictions: [
      'Sin acciones de escritura sobre empleados, tarjetas, permisos ni equipos.',
      'Sin acceso al simulador de accesos ni cambios de configuración.',
    ],
  },
  {
    id: 'viewer',
    label: 'Monitor',
    surface: 'Consola web administrativa',
    summary:
      'Perfil acotado para casetas o recepción: supervisa ocupación en tiempo real y flujo de entradas sin exponer catálogos sensibles.',
    permissions: [
      'Vista directa del Croquis en vivo con ocupación por área.',
      'Indicadores generales de áreas protegidas y accesos de las últimas 24 horas.',
      'Consulta de bitácora en vivo con vista operativa simplificada.',
    ],
    restrictions: [
      'Sin filtros avanzados por empleado/controlador ni exportación PDF.',
      'Sin acceso a catálogos de empleados, tarjetas, dispositivos ni usuarios.',
    ],
  },
  {
    id: 'employee',
    label: 'Empleado',
    surface: 'App móvil Accesa (Expo)',
    summary:
      'Experiencia móvil enfocada en transparencia personal: cada colaborador revisa únicamente sus propios registros de entrada.',
    permissions: [
      'Inicio de sesión con cuenta vinculada a su expediente de empleado.',
      'Historial personal paginado con decisión, área y marca temporal local.',
      'Detalle individual de cada evento propio con UID y motivo.',
    ],
    restrictions: [
      'Aislamiento estricto: nunca visualiza datos ni eventos de otros colaboradores.',
      'Bloqueo automático de funciones administrativas en aplicación web o móvil.',
    ],
  },
]

export type ScenarioIconName = 'flask' | 'building' | 'wrench' | 'server'

export interface UseCaseScenario {
  id: string
  title: string
  description: string
  highlight: string
  iconName: ScenarioIconName
}

export const USE_CASE_SCENARIOS: ReadonlyArray<UseCaseScenario> = [
  {
    id: 'labs',
    title: 'Laboratorios y centros de cómputo',
    description:
      'Restringe el ingreso a equipos de alto valor únicamente a docentes, técnicos y estudiantes autorizados por periodo.',
    highlight: 'Control por vigencia de permiso y croquis de ocupación en vivo.',
    iconName: 'flask',
  },
  {
    id: 'campus',
    title: 'Campus y edificios académicos',
    description:
      'Coordina múltiples puertas desde una sola consola web mientras cada edificio conserva operación local autónoma.',
    highlight: 'Sincronización escalonada por versión de permisos en cada nodo.',
    iconName: 'building',
  },
  {
    id: 'workshops',
    title: 'Talleres y áreas técnicas',
    description:
      'Mantén abiertas las puertas autorizadas en zonas con cobertura Wi-Fi intermitente gracias a la validación en caché NVS.',
    highlight: 'Cola offline-first con entrega idempotente al restablecer enlace.',
    iconName: 'wrench',
  },
  {
    id: 'datacenter',
    title: 'Centros de datos y cuartos de TI',
    description:
      'Registra cada intento de acceso con trazabilidad exacta, conservando tarjetas desconocidas o rechazadas para revisión.',
    highlight: 'Bitácora inmutable con doble marca temporal y reportes PDF.',
    iconName: 'server',
  },
]

export interface WorkflowStep {
  stepNumber: number
  title: string
  description: string
  deliverable: string
}

export const WORKFLOW_STEPS: ReadonlyArray<WorkflowStep> = [
  {
    stepNumber: 1,
    title: 'Acredita al personal',
    description:
      'Registra colaboradores y asigna tarjetas RFID únicas desde la consola administrativa sin trámites manuales.',
    deliverable: 'Expediente y UID vinculados',
  },
  {
    stepNumber: 2,
    title: 'Define permisos por área',
    description:
      'Establece qué zonas puede abrir cada persona y consulta la distribución física del edificio en un croquis en vivo.',
    deliverable: 'Lista blanca versionada',
  },
  {
    stepNumber: 3,
    title: 'Valida en puerta sin depender de Internet',
    description:
      'El nodo ESP32-S3 resuelve cada lectura contra su caché local en milisegundos, incluso durante cortes de red.',
    deliverable: 'Respuesta < 20 ms en puerta',
  },
  {
    stepNumber: 4,
    title: 'Audita cada lectura al instante',
    description:
      'Los eventos suben de manera idempotente preservando la hora exacta de puerta y el momento de recepción en servidor.',
    deliverable: 'Bitácora y PDF auditables',
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

export const TECH_STACK_PILLS: ReadonlyArray<string> = [
  'ESP32-S3 + RC522',
  'PostgreSQL + RLS',
  'Express 5 + OpenAPI',
  'React + Vite',
  'Expo React Native',
]

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  {
    id: 'faq-offline',
    question: '¿Qué ocurre si se pierde la conexión Wi-Fi o Internet en el edificio?',
    answer:
      'Cada controlador ESP32-S3 conserva en memoria no volátil la versión más reciente de tarjetas y permisos autorizados para sus áreas asignadas. Las puertas siguen validando en menos de 20 ms y almacenan los eventos con su hora real (occurred_at) hasta que regresa el enlace.',
  },
  {
    id: 'faq-dedup',
    question: '¿Cómo evita Accesa eventos duplicados cuando vuelve la red?',
    answer:
      'Cada lectura generada en el controlador recibe un identificador único client_event_id. Al sincronizar lotes pendientes hacia el backend Express 5 y PostgreSQL, los eventos repetidos se deduplican de forma idempotente sin alterar la bitácora.',
  },
  {
    id: 'faq-hardware',
    question: '¿Qué hardware requiere cada puerta controlada?',
    answer:
      'La arquitectura base contempla un microcontrolador ESP32-S3, un lector RFID RC522 de 13.56 MHz y un módulo relevador para accionar la cerradura o chapa eléctrica correspondiente.',
  },
  {
    id: 'faq-mobile',
    question: '¿Un empleado puede ver accesos de otras personas desde la app móvil?',
    answer:
      'No. La app móvil consulta exclusivamente los endpoints personales (/me/access-events) vinculados al expediente del usuario autenticado y bloquea cuentas administrativas sin empleado asociado.',
  },
  {
    id: 'faq-audit',
    question: '¿Se pueden generar reportes para auditorías institucionales?',
    answer:
      'Sí. Administradores, operadores y auditores pueden filtrar la bitácora por área, controlador, empleado, UID, decisión o rango de fechas y exportar reportes PDF directamente desde la consola web.',
  },
  {
    id: 'faq-pilot',
    question: '¿Cómo solicitamos una demostración o piloto en campus?',
    answer:
      'Desde nuestra página de contacto puedes indicar tu institución, motivo y cantidad estimada de puertas. Coordinamos una sesión en vivo para revisar el flujo completo de consola, app móvil y sincronización offline.',
  },
]

export const CONTACT_REASONS: ReadonlyArray<string> = [
  'Demostración institucional',
  'Piloto en campus o laboratorio',
  'Arquitectura y hardware ESP32-S3',
  'Otro motivo',
]

export const DOOR_SCALE_OPTIONS: ReadonlyArray<string> = [
  '1 a 4 puertas',
  '5 a 15 puertas',
  '16 a 40 puertas',
  'Más de 40 puertas / campus completo',
]

export interface DemoTimelineStep {
  step: string
  title: string
  detail: string
}

export const DEMO_TIMELINE: ReadonlyArray<DemoTimelineStep> = [
  {
    step: '01',
    title: 'Revisión técnica del alcance',
    detail: 'Analizamos tus áreas, horarios operativos y número de puertas a controlar.',
  },
  {
    step: '02',
    title: 'Demostración en vivo del ecosistema',
    detail: 'Mostramos consola administrativa, croquis en vivo, app móvil y cola offline.',
  },
  {
    step: '03',
    title: 'Plan de piloto institucional',
    detail: 'Definimos nodos ESP32-S3, perfiles RBAC y métricas de validación en campus.',
  },
]
