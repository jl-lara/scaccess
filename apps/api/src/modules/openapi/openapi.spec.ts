/**
 * OpenAPI 3.1.0 document for the Sistema de Control de Acceso API.
 *
 * The document is hand-written on purpose: it is the single source of truth
 * consumed by `GET /api/v1/openapi.json` and the interactive documentation at
 * `GET /api/v1/docs`. No extra runtime dependency is required.
 *
 * Paths are relative to the server URL (`/api/v1`), so `/health` in this
 * document corresponds to `GET /api/v1/health`.
 */

type SecurityRequirement = Record<string, string[]>

interface OpenApiOperation {
  tags: string[]
  summary: string
  description?: string
  operationId: string
  security?: SecurityRequirement[]
  parameters?: unknown[]
  requestBody?: unknown
  responses: Record<string, unknown>
}

interface OpenApiDocument {
  openapi: '3.1.0'
  info: {
    title: string
    version: string
    description: string
  }
  servers: Array<{ url: string; description?: string }>
  tags: Array<{ name: string; description: string }>
  components: {
    securitySchemes: Record<
      string,
      {
        type: 'http'
        scheme: 'bearer'
        bearerFormat?: string
        description: string
      }
    >
    schemas: Record<string, unknown>
    responses: Record<string, unknown>
    parameters: Record<string, unknown>
  }
  paths: Record<string, Record<string, OpenApiOperation>>
}

const schemaRef = (name: string): { $ref: string } => ({
  $ref: `#/components/schemas/${name}`,
})

const jsonContent = (schema: unknown): Record<string, unknown> => ({
  'application/json': { schema },
})

const jsonResponse = (description: string, schema: unknown): Record<string, unknown> => ({
  description,
  content: jsonContent(schema),
})

const emptyResponse = (description: string): Record<string, unknown> => ({
  description,
})

const errorResponse = (description: string): Record<string, unknown> =>
  jsonResponse(description, schemaRef('ApiError'))

const unauthorizedResponse = errorResponse(
  'Falta el token o la credencial no es valida.',
)
const forbiddenResponse = errorResponse(
  'El usuario autenticado no tiene el rol requerido.',
)
const notFoundResponse = errorResponse('El recurso solicitado no existe.')
const validationResponse = errorResponse(
  'El cuerpo, la ruta o los parametros de consulta no son validos.',
)
const conflictResponse = errorResponse(
  'El recurso entra en conflicto con un registro existente.',
)
const payloadTooLargeResponse = errorResponse('El lote de eventos excede el limite.')

const uuidPathParameter = (name = 'id', description?: string): Record<string, unknown> => ({
  name,
  in: 'path',
  required: true,
  ...(description === undefined ? {} : { description }),
  schema: { type: 'string', format: 'uuid' },
})

const paginationParameters: unknown[] = [
  {
    name: 'page',
    in: 'query',
    description: 'Numero de pagina (empieza en 1).',
    schema: { type: 'integer', minimum: 1, default: 1 },
  },
  {
    name: 'pageSize',
    in: 'query',
    description: 'Registros por pagina (maximo 100).',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
]

const supabaseSecurity: SecurityRequirement[] = [{ supabaseBearer: [] }]
const deviceSecurity: SecurityRequirement[] = [{ deviceBearer: [] }]

const healthResponse = jsonResponse('Estado del servicio.', schemaRef('HealthCheckResponse'))
const roleListResponse = jsonResponse('Listado de roles del sistema.', {
  type: 'array',
  items: schemaRef('Role'),
})
const userResponse = jsonResponse('Cuenta de usuario.', schemaRef('UserAccount'))
const userPageResponse = jsonResponse('Pagina de cuentas de usuario.', schemaRef('UserAccountPage'))
const areaResponse = jsonResponse('Area registrada.', schemaRef('Area'))
const areaPageResponse = jsonResponse('Pagina de areas.', schemaRef('AreaPage'))
const employeeResponse = jsonResponse('Empleado registrado.', schemaRef('Employee'))
const employeePageResponse = jsonResponse('Pagina de empleados.', schemaRef('EmployeePage'))
const credentialResponse = jsonResponse('Credencial RFID.', schemaRef('Credential'))
const credentialPageResponse = jsonResponse(
  'Pagina de credenciales RFID.',
  schemaRef('CredentialPage'),
)
const permissionResponse = jsonResponse('Permiso de acceso.', schemaRef('AccessPermission'))
const permissionPageResponse = jsonResponse(
  'Pagina de permisos de acceso.',
  schemaRef('AccessPermissionPage'),
)
const deviceResponse = jsonResponse('Dispositivo de acceso.', schemaRef('AccessDevice'))
const devicePageResponse = jsonResponse(
  'Pagina de dispositivos de acceso.',
  schemaRef('AccessDevicePage'),
)
const deviceCredentialResponse = jsonResponse(
  'Credencial de dispositivo emitida. El token solo se devuelve en esta respuesta.',
  schemaRef('DeviceCredentialIssued'),
)
const deviceSyncStateResponse = jsonResponse(
  'Estado de sincronizacion del dispositivo.',
  schemaRef('DeviceSyncState'),
)
const accessEventResponse = jsonResponse('Evento de acceso.', schemaRef('AccessEvent'))
const accessEventPageResponse = jsonResponse(
  'Pagina de eventos de acceso.',
  schemaRef('AccessEventPage'),
)
const dashboardResponse = jsonResponse(
  'Resumen agregado para el dashboard.',
  schemaRef('DashboardSummary'),
)

export const openApiDocument: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Sistema de Control de Acceso API',
    version: '1.0.0',
    description:
      'API REST/JSON del Sistema de Control de Acceso (UTT). Expone la ' +
      'administracion de empleados, tarjetas RFID, areas, permisos, ' +
      'dispositivos y usuarios, el historial de accesos, el dashboard y la ' +
      'sincronizacion offline de los controladores ESP32-S3.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Prefijo versionado de la API.',
    },
  ],
  tags: [
    { name: 'Sistema', description: 'Salud y documentacion de la API.' },
    { name: 'Autenticacion', description: 'Perfil del usuario autenticado.' },
    { name: 'Catalogo', description: 'Roles, usuarios, areas y empleados.' },
    { name: 'Credenciales', description: 'Tarjetas RFID y permisos de acceso.' },
    { name: 'Dispositivos', description: 'Dispositivos fisicos y sus credenciales.' },
    {
      name: 'Sincronizacion',
      description: 'Sincronizacion offline de los controladores ESP32-S3.',
    },
    { name: 'Historial', description: 'Eventos de acceso administrativos y personales.' },
    { name: 'Dashboard', description: 'Indicadores agregados.' },
  ],
  components: {
    securitySchemes: {
      supabaseBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Token de acceso emitido por Supabase Auth. Se usa en la web ' +
          'administrativa y en la app movil (`Authorization: Bearer <jwt>`).',
      },
      deviceBearer: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Credencial del controlador fisico ESP32-S3 con formato ' +
          '`<tokenId>.<secret>` (`Authorization: Bearer <tokenId>.<secret>`).',
      },
    },
    schemas: {
      ApiError: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                description: 'Codigo estable del error.',
                examples: [
                  'BAD_REQUEST',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'NOT_FOUND',
                  'CONFLICT',
                  'VALIDATION_ERROR',
                  'PAYLOAD_TOO_LARGE',
                  'INTERNAL_SERVER_ERROR',
                ],
              },
              message: { type: 'string' },
              details: {
                description: 'Detalle adicional (por ejemplo, los issues de Zod).',
              },
            },
          },
        },
      },
      HealthCheckResponse: {
        type: 'object',
        required: ['status', 'service', 'timestamp', 'uptimeSeconds'],
        properties: {
          status: { type: 'string', const: 'ok' },
          service: { type: 'string', examples: ['access-control-api'] },
          timestamp: { type: 'string', format: 'date-time' },
          uptimeSeconds: { type: 'number' },
        },
      },
      PaginationMeta: {
        type: 'object',
        required: ['page', 'pageSize', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          pageSize: { type: 'integer', minimum: 1 },
          total: { type: 'integer', minimum: 0 },
          totalPages: { type: 'integer', minimum: 0 },
        },
      },
      Role: {
        type: 'object',
        required: ['id', 'code', 'name', 'description', 'isSystem'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', examples: ['admin', 'operator', 'auditor'] },
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          isSystem: { type: 'boolean' },
        },
      },
      UserAccount: {
        type: 'object',
        required: [
          'id',
          'authUserId',
          'employeeId',
          'email',
          'status',
          'roles',
          'lastLoginAt',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          authUserId: {
            type: 'string',
            format: 'uuid',
            description: 'Identificador del usuario en Supabase Auth.',
          },
          employeeId: { type: ['string', 'null'], format: 'uuid' },
          email: { type: 'string', format: 'email' },
          status: { type: 'string', enum: ['active', 'disabled'] },
          roles: {
            type: 'array',
            items: { type: 'string' },
            examples: [['admin']],
          },
          lastLoginAt: { type: ['string', 'null'], format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserAccountPage: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: schemaRef('UserAccount') },
          pagination: schemaRef('PaginationMeta'),
        },
      },
      UserCreate: {
        type: 'object',
        required: ['authUserId', 'email'],
        properties: {
          authUserId: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email', maxLength: 320 },
          employeeId: { type: ['string', 'null'], format: 'uuid' },
          status: { type: 'string', enum: ['active', 'disabled'] },
          roleCodes: {
            type: 'array',
            maxItems: 20,
            items: { type: 'string', minLength: 1, maxLength: 32 },
          },
        },
      },
      UserUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
          status: { type: 'string', enum: ['active', 'disabled'] },
          employeeId: { type: ['string', 'null'], format: 'uuid' },
          roleCodes: {
            type: 'array',
            maxItems: 20,
            items: { type: 'string', minLength: 1, maxLength: 32 },
          },
        },
      },
      Area: {
        type: 'object',
        required: [
          'id',
          'code',
          'name',
          'description',
          'isActive',
          'timezone',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string', examples: ['MAIN_ENTRANCE'] },
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          isActive: { type: 'boolean' },
          timezone: { type: 'string', examples: ['America/Tijuana'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AreaPage: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: schemaRef('Area') },
          pagination: schemaRef('PaginationMeta'),
        },
      },
      AreaCreate: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string', minLength: 1, maxLength: 32 },
          name: { type: 'string', minLength: 1, maxLength: 128 },
          description: { type: ['string', 'null'], maxLength: 1000 },
          isActive: { type: 'boolean' },
          timezone: { type: 'string', minLength: 1, maxLength: 64 },
        },
      },
      AreaUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 128 },
          description: { type: ['string', 'null'], maxLength: 1000 },
          isActive: { type: 'boolean' },
          timezone: { type: 'string', minLength: 1, maxLength: 64 },
        },
      },
      Employee: {
        type: 'object',
        required: [
          'id',
          'employeeCode',
          'firstName',
          'lastName',
          'email',
          'department',
          'position',
          'status',
          'hiredAt',
          'deactivatedAt',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          employeeCode: { type: 'string', examples: ['E-0001'] },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: ['string', 'null'], format: 'email' },
          department: { type: ['string', 'null'] },
          position: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          hiredAt: { type: ['string', 'null'], format: 'date' },
          deactivatedAt: { type: ['string', 'null'], format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      EmployeePage: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: schemaRef('Employee') },
          pagination: schemaRef('PaginationMeta'),
        },
      },
      EmployeeCreate: {
        type: 'object',
        required: ['employeeCode', 'firstName', 'lastName'],
        properties: {
          employeeCode: { type: 'string', minLength: 1, maxLength: 32 },
          firstName: { type: 'string', minLength: 1, maxLength: 100 },
          lastName: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: ['string', 'null'], format: 'email', maxLength: 320 },
          department: { type: ['string', 'null'], maxLength: 100 },
          position: { type: ['string', 'null'], maxLength: 100 },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          hiredAt: { type: ['string', 'null'], format: 'date' },
        },
      },
      EmployeeUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
          employeeCode: { type: 'string', minLength: 1, maxLength: 32 },
          firstName: { type: 'string', minLength: 1, maxLength: 100 },
          lastName: { type: 'string', minLength: 1, maxLength: 100 },
          email: { type: ['string', 'null'], format: 'email', maxLength: 320 },
          department: { type: ['string', 'null'], maxLength: 100 },
          position: { type: ['string', 'null'], maxLength: 100 },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          hiredAt: { type: ['string', 'null'], format: 'date' },
        },
      },
      Credential: {
        type: 'object',
        required: [
          'id',
          'employeeId',
          'cardUid',
          'label',
          'status',
          'issuedAt',
          'deactivatedAt',
          'deactivationReason',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          employeeId: { type: 'string', format: 'uuid' },
          cardUid: {
            type: 'string',
            pattern: '^[0-9A-F]{8,32}$',
            examples: ['A1B2C3D4'],
          },
          label: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['active', 'blocked', 'lost', 'retired'] },
          issuedAt: { type: ['string', 'null'], format: 'date-time' },
          deactivatedAt: { type: ['string', 'null'], format: 'date-time' },
          deactivationReason: { type: ['string', 'null'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CredentialPage: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: schemaRef('Credential') },
          pagination: schemaRef('PaginationMeta'),
        },
      },
      CredentialCreate: {
        type: 'object',
        required: ['employeeId', 'cardUid'],
        properties: {
          employeeId: { type: 'string', format: 'uuid' },
          cardUid: {
            type: 'string',
            description:
              'UID de la tarjeta (8-32 caracteres hexadecimales, longitud par). ' +
              'Se normaliza a mayusculas sin separadores.',
            pattern: '^[0-9A-Fa-f]{8,32}$',
          },
          label: { type: ['string', 'null'], maxLength: 64 },
          status: {
            type: 'string',
            enum: ['active', 'blocked', 'lost', 'retired'],
            default: 'active',
          },
        },
      },
      CredentialUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
          label: { type: ['string', 'null'], maxLength: 64 },
          status: { type: 'string', enum: ['active', 'blocked', 'lost', 'retired'] },
          deactivationReason: { type: ['string', 'null'], maxLength: 500 },
        },
      },
      AccessPermission: {
        type: 'object',
        required: [
          'id',
          'employeeId',
          'areaId',
          'validFrom',
          'validTo',
          'schedule',
          'revokedAt',
          'grantedById',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          employeeId: { type: 'string', format: 'uuid' },
          areaId: { type: 'string', format: 'uuid' },
          validFrom: { type: ['string', 'null'], format: 'date-time' },
          validTo: { type: ['string', 'null'], format: 'date-time' },
          schedule: {
            type: ['object', 'null'],
            description: 'Horario permitido; estructura libre.',
            additionalProperties: true,
          },
          revokedAt: { type: ['string', 'null'], format: 'date-time' },
          grantedById: { type: ['string', 'null'], format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AccessPermissionPage: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: schemaRef('AccessPermission') },
          pagination: schemaRef('PaginationMeta'),
        },
      },
      AccessPermissionCreate: {
        type: 'object',
        required: ['employeeId', 'areaId'],
        properties: {
          employeeId: { type: 'string', format: 'uuid' },
          areaId: { type: 'string', format: 'uuid' },
          validFrom: { type: ['string', 'null'], format: 'date-time' },
          validTo: { type: ['string', 'null'], format: 'date-time' },
          schedule: {
            type: ['object', 'null'],
            description: 'Horario permitido; estructura libre.',
            additionalProperties: true,
          },
        },
      },
      AccessDevice: {
        type: 'object',
        required: [
          'id',
          'deviceCode',
          'name',
          'location',
          'status',
          'hardwareModel',
          'firmwareVersion',
          'configVersion',
          'lastSeenAt',
          'provisionedAt',
          'areaIds',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceCode: { type: 'string', examples: ['dev_01'] },
          name: { type: 'string' },
          location: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
          hardwareModel: { type: ['string', 'null'] },
          firmwareVersion: { type: ['string', 'null'] },
          configVersion: {
            type: 'string',
            description: 'Contador monotono serializado como string (bigint).',
            examples: ['42'],
          },
          lastSeenAt: { type: ['string', 'null'], format: 'date-time' },
          provisionedAt: { type: ['string', 'null'], format: 'date-time' },
          areaIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AccessDevicePage: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: schemaRef('AccessDevice') },
          pagination: schemaRef('PaginationMeta'),
        },
      },
      AccessDeviceCreate: {
        type: 'object',
        required: ['deviceCode', 'name'],
        properties: {
          deviceCode: { type: 'string', minLength: 1, maxLength: 64 },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          location: { type: ['string', 'null'], maxLength: 128 },
          hardwareModel: { type: ['string', 'null'], maxLength: 32 },
          firmwareVersion: { type: ['string', 'null'], maxLength: 32 },
          status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
          areaIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
      AccessDeviceUpdate: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          location: { type: ['string', 'null'], maxLength: 128 },
          hardwareModel: { type: ['string', 'null'], maxLength: 32 },
          firmwareVersion: { type: ['string', 'null'], maxLength: 32 },
          status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
          areaIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
      DeviceCredentialIssued: {
        type: 'object',
        required: ['id', 'deviceId', 'tokenId', 'token', 'createdAt', 'expiresAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceId: { type: 'string', format: 'uuid' },
          tokenId: { type: 'string', examples: ['devtok_1f0c...'] },
          token: {
            type: 'string',
            description:
              'Credencial completa `<tokenId>.<secret>`. Solo se muestra al emitirla.',
          },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      DeviceSyncState: {
        type: 'object',
        required: [
          'deviceId',
          'configVersion',
          'lastSyncRequestedAt',
          'lastSyncCompletedAt',
          'lastEventReceivedAt',
          'lastEventOccurredAt',
          'pendingEventCountReported',
          'lastErrorCode',
          'lastErrorAt',
          'updatedAt',
        ],
        properties: {
          deviceId: { type: 'string', format: 'uuid' },
          configVersion: { type: 'string' },
          lastSyncRequestedAt: { type: ['string', 'null'], format: 'date-time' },
          lastSyncCompletedAt: { type: ['string', 'null'], format: 'date-time' },
          lastEventReceivedAt: { type: ['string', 'null'], format: 'date-time' },
          lastEventOccurredAt: { type: ['string', 'null'], format: 'date-time' },
          pendingEventCountReported: { type: ['integer', 'null'], minimum: 0 },
          lastErrorCode: { type: ['string', 'null'] },
          lastErrorAt: { type: ['string', 'null'], format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AccessEvent: {
        type: 'object',
        required: [
          'id',
          'deviceId',
          'clientEventId',
          'deviceEpoch',
          'cardUid',
          'employeeId',
          'credentialId',
          'areaId',
          'decision',
          'reasonCode',
          'occurredAt',
          'receivedAt',
          'deviceSequence',
          'metadata',
          'createdAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceId: { type: 'string', format: 'uuid' },
          clientEventId: { type: 'string' },
          deviceEpoch: { type: ['string', 'null'], format: 'uuid' },
          cardUid: { type: 'string' },
          employeeId: {
            type: ['string', 'null'],
            format: 'uuid',
            description: 'Null cuando la tarjeta no estaba registrada.',
          },
          credentialId: { type: ['string', 'null'], format: 'uuid' },
          areaId: { type: 'string', format: 'uuid' },
          decision: { type: 'string', enum: ['granted', 'denied'] },
          reasonCode: {
            type: 'string',
            enum: [
              'allowed',
              'card_unknown',
              'card_blocked',
              'card_lost',
              'card_retired',
              'employee_inactive',
              'permission_missing',
              'permission_expired',
              'permission_outside_schedule',
              'area_not_allowed',
              'area_inactive',
              'device_error',
            ],
          },
          occurredAt: {
            type: 'string',
            format: 'date-time',
            description: 'Momento del evento fisico, con el reloj del dispositivo.',
          },
          receivedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Momento en que el servidor recibio el evento.',
          },
          deviceSequence: {
            type: ['string', 'null'],
            description: 'Secuencia local del dispositivo (bigint serializado).',
          },
          metadata: { description: 'Contexto adicional enviado por el dispositivo.' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AccessEventPage: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: schemaRef('AccessEvent') },
          pagination: schemaRef('PaginationMeta'),
        },
      },
      DashboardSummary: {
        type: 'object',
        required: ['employees', 'credentials', 'areas', 'devices', 'recentEvents24h'],
        properties: {
          employees: {
            type: 'object',
            required: ['total', 'active'],
            properties: {
              total: { type: 'integer', minimum: 0 },
              active: { type: 'integer', minimum: 0 },
            },
          },
          credentials: {
            type: 'object',
            required: ['total', 'active', 'blockedOrLost'],
            properties: {
              total: { type: 'integer', minimum: 0 },
              active: { type: 'integer', minimum: 0 },
              blockedOrLost: { type: 'integer', minimum: 0 },
            },
          },
          areas: {
            type: 'object',
            required: ['total', 'active'],
            properties: {
              total: { type: 'integer', minimum: 0 },
              active: { type: 'integer', minimum: 0 },
            },
          },
          devices: {
            type: 'object',
            required: ['total', 'active', 'outOfSync'],
            properties: {
              total: { type: 'integer', minimum: 0 },
              active: { type: 'integer', minimum: 0 },
              outOfSync: { type: 'integer', minimum: 0 },
            },
          },
          recentEvents24h: {
            type: 'object',
            required: ['granted', 'denied'],
            properties: {
              granted: { type: 'integer', minimum: 0 },
              denied: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
      DeviceSyncArea: {
        type: 'object',
        required: ['id', 'code', 'name', 'timezone'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          name: { type: 'string' },
          timezone: { type: 'string' },
        },
      },
      DeviceSyncEmployee: {
        type: 'object',
        required: ['id', 'employeeCode', 'firstName', 'lastName', 'status'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          employeeCode: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
        },
      },
      DeviceSyncCredential: {
        type: 'object',
        required: ['id', 'employeeId', 'cardUid', 'status'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          employeeId: { type: 'string', format: 'uuid' },
          cardUid: { type: 'string' },
          status: { type: 'string', enum: ['active', 'blocked', 'lost', 'retired'] },
        },
      },
      DeviceSyncPermission: {
        type: 'object',
        required: ['employeeId', 'areaId', 'validFrom', 'validTo', 'schedule'],
        properties: {
          employeeId: { type: 'string', format: 'uuid' },
          areaId: { type: 'string', format: 'uuid' },
          validFrom: { type: ['string', 'null'], format: 'date-time' },
          validTo: { type: ['string', 'null'], format: 'date-time' },
          schedule: {
            type: ['object', 'null'],
            additionalProperties: true,
          },
        },
      },
      DeviceSyncConfig: {
        type: 'object',
        required: ['configVersion', 'timezone'],
        properties: {
          configVersion: { type: 'string' },
          timezone: { type: 'string' },
        },
      },
      DeviceSyncPayload: {
        type: 'object',
        required: [
          'deviceId',
          'syncVersion',
          'generatedAt',
          'checksum',
          'areas',
          'employees',
          'credentials',
          'permissions',
          'config',
        ],
        properties: {
          deviceId: { type: 'string', format: 'uuid' },
          syncVersion: {
            type: 'string',
            description: 'Contador de configuracion serializado como string.',
          },
          generatedAt: { type: 'string', format: 'date-time' },
          checksum: {
            type: 'string',
            description: 'SHA-256 hexadecimal del contenido versionado.',
          },
          areas: { type: 'array', items: schemaRef('DeviceSyncArea') },
          employees: { type: 'array', items: schemaRef('DeviceSyncEmployee') },
          credentials: { type: 'array', items: schemaRef('DeviceSyncCredential') },
          permissions: { type: 'array', items: schemaRef('DeviceSyncPermission') },
          config: schemaRef('DeviceSyncConfig'),
        },
      },
      DeviceEventSyncItem: {
        type: 'object',
        required: [
          'clientEventId',
          'cardUid',
          'deviceId',
          'areaId',
          'occurredAt',
          'decision',
          'reasonCode',
        ],
        properties: {
          clientEventId: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            description: 'Identificador idempotente generado por el dispositivo.',
          },
          cardUid: { type: 'string', pattern: '^[0-9A-Fa-f]{8,32}$' },
          deviceId: { type: 'string', minLength: 1, maxLength: 64 },
          areaId: { type: 'string', format: 'uuid' },
          occurredAt: { type: 'string', format: 'date-time' },
          decision: { type: 'string', enum: ['granted', 'denied'] },
          reasonCode: {
            type: 'string',
            enum: [
              'allowed',
              'card_unknown',
              'card_blocked',
              'card_lost',
              'card_retired',
              'employee_inactive',
              'permission_missing',
              'permission_expired',
              'permission_outside_schedule',
              'area_not_allowed',
              'area_inactive',
              'device_error',
            ],
          },
          deviceEpoch: { type: 'string', format: 'uuid' },
          deviceSequence: {
            type: 'string',
            pattern: '^\\d{1,19}$',
            description: 'Secuencia local del dispositivo (bigint como string).',
          },
          metadata: { description: 'Contexto adicional definido por el firmware.' },
        },
      },
      DeviceEventSyncRequest: {
        type: 'object',
        required: ['deviceId', 'events'],
        properties: {
          deviceId: { type: 'string', minLength: 1, maxLength: 64 },
          events: {
            type: 'array',
            minItems: 1,
            maxItems: 500,
            items: schemaRef('DeviceEventSyncItem'),
          },
        },
      },
      DeviceEventSyncRejected: {
        type: 'object',
        required: ['clientEventId', 'reasonCode', 'message'],
        properties: {
          clientEventId: { type: 'string' },
          reasonCode: { type: 'string' },
          message: { type: 'string' },
        },
      },
      DeviceEventSyncResponse: {
        type: 'object',
        required: ['accepted', 'duplicated', 'rejected'],
        properties: {
          accepted: { type: 'array', items: { type: 'string' } },
          duplicated: { type: 'array', items: { type: 'string' } },
          rejected: { type: 'array', items: schemaRef('DeviceEventSyncRejected') },
        },
      },
    },
    responses: {
      Unauthorized: unauthorizedResponse,
      Forbidden: forbiddenResponse,
      NotFound: notFoundResponse,
      ValidationError: validationResponse,
      Conflict: conflictResponse,
      PayloadTooLarge: payloadTooLargeResponse,
    },
    parameters: {
      Id: uuidPathParameter('id'),
      Page: paginationParameters[0] as Record<string, unknown>,
      PageSize: paginationParameters[1] as Record<string, unknown>,
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Estado del servicio',
        description:
          'Verifica que el proceso HTTP esta vivo. No consulta la base de datos, ' +
          'por lo que responde incluso sin credenciales configuradas.',
        operationId: 'getHealth',
        security: [],
        responses: {
          '200': healthResponse,
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Autenticacion'],
        summary: 'Perfil del usuario autenticado',
        description:
          'Devuelve la cuenta vinculada al token de Supabase Auth. ' +
          'Actualiza `lastLoginAt` como maximo cada cinco minutos.',
        operationId: 'getAuthenticatedProfile',
        security: supabaseSecurity,
        responses: {
          '200': userResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/roles': {
      get: {
        tags: ['Catalogo'],
        summary: 'Listar roles del sistema',
        description: 'Solo administradores. Devuelve los roles disponibles para asignar.',
        operationId: 'listRoles',
        security: supabaseSecurity,
        responses: {
          '200': roleListResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
    },
    '/users': {
      get: {
        tags: ['Catalogo'],
        summary: 'Listar cuentas de usuario',
        description: 'Solo administradores. Admite paginacion, estado y busqueda.',
        operationId: 'listUsers',
        security: supabaseSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['active', 'disabled'] },
          },
          {
            name: 'search',
            in: 'query',
            description: 'Busca por email, codigo de empleado o nombre.',
            schema: { type: 'string', minLength: 1, maxLength: 320 },
          },
        ],
        responses: {
          '200': userPageResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Crear cuenta de usuario',
        description:
          'Solo administradores. Vincula una cuenta de Supabase Auth con un ' +
          'empleado y asigna roles por codigo.',
        operationId: 'createUser',
        security: supabaseSecurity,
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('UserCreate')),
        },
        responses: {
          '201': userResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '409': conflictResponse,
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Catalogo'],
        summary: 'Obtener cuenta de usuario',
        description: 'Solo administradores.',
        operationId: 'getUser',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': userResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
      patch: {
        tags: ['Catalogo'],
        summary: 'Actualizar cuenta de usuario',
        description:
          'Solo administradores. Permite cambiar estado, empleado vinculado y roles.',
        operationId: 'updateUser',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('UserUpdate')),
        },
        responses: {
          '200': userResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
          '409': conflictResponse,
        },
      },
    },
    '/areas': {
      get: {
        tags: ['Catalogo'],
        summary: 'Listar areas',
        description: 'Roles admin, operator y auditor.',
        operationId: 'listAreas',
        security: supabaseSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: 'isActive',
            in: 'query',
            schema: { type: 'boolean' },
          },
          {
            name: 'search',
            in: 'query',
            description: 'Busca por codigo o nombre.',
            schema: { type: 'string', minLength: 1, maxLength: 100 },
          },
        ],
        responses: {
          '200': areaPageResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Crear area',
        description: 'Solo administradores.',
        operationId: 'createArea',
        security: supabaseSecurity,
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('AreaCreate')),
        },
        responses: {
          '201': areaResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '409': conflictResponse,
        },
      },
    },
    '/areas/{id}': {
      get: {
        tags: ['Catalogo'],
        summary: 'Obtener area',
        description: 'Roles admin, operator y auditor.',
        operationId: 'getArea',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': areaResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
      patch: {
        tags: ['Catalogo'],
        summary: 'Actualizar area',
        description: 'Solo administradores.',
        operationId: 'updateArea',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('AreaUpdate')),
        },
        responses: {
          '200': areaResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/employees': {
      get: {
        tags: ['Catalogo'],
        summary: 'Listar empleados',
        description: 'Roles admin, operator y auditor.',
        operationId: 'listEmployees',
        security: supabaseSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
          },
          {
            name: 'department',
            in: 'query',
            schema: { type: 'string', minLength: 1, maxLength: 100 },
          },
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string', minLength: 1, maxLength: 100 },
          },
        ],
        responses: {
          '200': employeePageResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Crear empleado',
        description: 'Roles admin y operator.',
        operationId: 'createEmployee',
        security: supabaseSecurity,
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('EmployeeCreate')),
        },
        responses: {
          '201': employeeResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '409': conflictResponse,
        },
      },
    },
    '/employees/{id}': {
      get: {
        tags: ['Catalogo'],
        summary: 'Obtener empleado',
        description: 'Roles admin, operator y auditor.',
        operationId: 'getEmployee',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': employeeResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
      patch: {
        tags: ['Catalogo'],
        summary: 'Actualizar empleado',
        description: 'Roles admin y operator.',
        operationId: 'updateEmployee',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('EmployeeUpdate')),
        },
        responses: {
          '200': employeeResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
          '409': conflictResponse,
        },
      },
    },
    '/credentials': {
      get: {
        tags: ['Credenciales'],
        summary: 'Listar credenciales RFID',
        description: 'Roles admin, operator y auditor.',
        operationId: 'listCredentials',
        security: supabaseSecurity,
        parameters: [
          ...paginationParameters,
          { name: 'employeeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['active', 'blocked', 'lost', 'retired'] },
          },
          { name: 'cardUid', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': credentialPageResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
      post: {
        tags: ['Credenciales'],
        summary: 'Registrar credencial RFID',
        description:
          'Roles admin y operator. El UID se normaliza a mayusculas y no puede ' +
          'estar duplicado.',
        operationId: 'createCredential',
        security: supabaseSecurity,
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('CredentialCreate')),
        },
        responses: {
          '201': credentialResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
          '409': conflictResponse,
        },
      },
    },
    '/credentials/{id}': {
      get: {
        tags: ['Credenciales'],
        summary: 'Obtener credencial RFID',
        description: 'Roles admin, operator y auditor.',
        operationId: 'getCredential',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': credentialResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
      patch: {
        tags: ['Credenciales'],
        summary: 'Actualizar credencial RFID',
        description:
          'Roles admin y operator. Permite bloquear, reportar perdida o retirar ' +
          'una tarjeta sin eliminarla.',
        operationId: 'updateCredential',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('CredentialUpdate')),
        },
        responses: {
          '200': credentialResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/access-permissions': {
      get: {
        tags: ['Credenciales'],
        summary: 'Listar permisos de acceso',
        description: 'Roles admin, operator y auditor.',
        operationId: 'listAccessPermissions',
        security: supabaseSecurity,
        parameters: [
          ...paginationParameters,
          { name: 'employeeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'areaId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          {
            name: 'activeOnly',
            in: 'query',
            description: 'Excluye permisos revocados.',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          '200': permissionPageResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
      post: {
        tags: ['Credenciales'],
        summary: 'Otorgar permiso de acceso',
        description:
          'Roles admin y operator. Registra quien otorgo el permiso en ' +
          '`grantedById`.',
        operationId: 'createAccessPermission',
        security: supabaseSecurity,
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('AccessPermissionCreate')),
        },
        responses: {
          '201': permissionResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
          '409': conflictResponse,
        },
      },
    },
    '/access-permissions/{id}/revoke': {
      post: {
        tags: ['Credenciales'],
        summary: 'Revocar permiso de acceso',
        description:
          'Roles admin y operator. La revocacion es logica (`revokedAt`); el ' +
          'registro se conserva para auditoria.',
        operationId: 'revokeAccessPermission',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': permissionResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/access-devices': {
      get: {
        tags: ['Dispositivos'],
        summary: 'Listar dispositivos de acceso',
        description: 'Roles admin, operator y auditor.',
        operationId: 'listAccessDevices',
        security: supabaseSecurity,
        parameters: [...paginationParameters],
        responses: {
          '200': devicePageResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
      post: {
        tags: ['Dispositivos'],
        summary: 'Registrar dispositivo de acceso',
        description:
          'Solo administradores. Crea el estado de sincronizacion inicial en ' +
          'version 0.',
        operationId: 'createAccessDevice',
        security: supabaseSecurity,
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('AccessDeviceCreate')),
        },
        responses: {
          '201': deviceResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '409': conflictResponse,
        },
      },
    },
    '/access-devices/{id}': {
      get: {
        tags: ['Dispositivos'],
        summary: 'Obtener dispositivo de acceso',
        description: 'Roles admin, operator y auditor.',
        operationId: 'getAccessDevice',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': deviceResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
      patch: {
        tags: ['Dispositivos'],
        summary: 'Actualizar dispositivo de acceso',
        description:
          'Solo administradores. Cambiar las areas asignadas incrementa ' +
          '`configVersion` para forzar la resincronizacion.',
        operationId: 'updateAccessDevice',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('AccessDeviceUpdate')),
        },
        responses: {
          '200': deviceResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
          '409': conflictResponse,
        },
      },
    },
    '/access-devices/{id}/credentials': {
      post: {
        tags: ['Dispositivos'],
        summary: 'Emitir credencial de dispositivo',
        description:
          'Solo administradores. Devuelve el token completo una unica vez; el ' +
          'servidor solo almacena el hash del secreto.',
        operationId: 'issueDeviceCredential',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '201': deviceCredentialResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/access-devices/{id}/credentials/{credentialId}/revoke': {
      post: {
        tags: ['Dispositivos'],
        summary: 'Revocar credencial de dispositivo',
        description: 'Solo administradores. La revocacion es logica e idempotente.',
        operationId: 'revokeDeviceCredential',
        security: supabaseSecurity,
        parameters: [
          { $ref: '#/components/parameters/Id' },
          {
            name: 'credentialId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': emptyResponse('Credencial revocada; sin contenido.'),
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/access-devices/{id}/sync-state': {
      get: {
        tags: ['Dispositivos'],
        summary: 'Consultar estado de sincronizacion',
        description: 'Roles admin, operator y auditor.',
        operationId: 'getDeviceSyncState',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': deviceSyncStateResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/devices/{deviceId}/sync': {
      get: {
        tags: ['Sincronizacion'],
        summary: 'Descargar configuracion offline',
        description:
          'Autenticacion de dispositivo. Devuelve areas, empleados, credenciales, ' +
          'permisos y configuracion vigentes. Responde `304` cuando el ' +
          '`If-None-Match` coincide con la version actual.',
        operationId: 'getDeviceSync',
        security: deviceSecurity,
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            description: 'UUID o `deviceCode` del dispositivo autenticado.',
            schema: { type: 'string' },
          },
          {
            name: 'If-None-Match',
            in: 'header',
            required: false,
            description: 'Version de sincronizacion conocida por el dispositivo.',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': jsonResponse(
            'Configuracion offline. Incluye cabecera `ETag` con la version.',
            schemaRef('DeviceSyncPayload'),
          ),
          '304': emptyResponse('La configuracion no cambio desde la version indicada.'),
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
    },
    '/devices/{deviceId}/events/sync': {
      post: {
        tags: ['Sincronizacion'],
        summary: 'Subir eventos almacenados offline',
        description:
          'Autenticacion de dispositivo. El lote es idempotente por ' +
          '`clientEventId`; el servidor clasifica cada evento como aceptado, ' +
          'duplicado o rechazado sin abortar el resto.',
        operationId: 'syncDeviceEvents',
        security: deviceSecurity,
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            description: 'UUID o `deviceCode` del dispositivo autenticado.',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: jsonContent(schemaRef('DeviceEventSyncRequest')),
        },
        responses: {
          '200': jsonResponse(
            'Resultado de la ingesta: aceptados, duplicados y rechazados.',
            schemaRef('DeviceEventSyncResponse'),
          ),
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '413': payloadTooLargeResponse,
        },
      },
    },
    '/access-events': {
      get: {
        tags: ['Historial'],
        summary: 'Listar eventos de acceso',
        description:
          'Roles admin, operator y auditor. El historial es inmutable y se ' +
          'ordena por `occurredAt` descendente.',
        operationId: 'listAccessEvents',
        security: supabaseSecurity,
        parameters: [
          ...paginationParameters,
          { name: 'employeeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'deviceId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'areaId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          {
            name: 'decision',
            in: 'query',
            schema: { type: 'string', enum: ['granted', 'denied'] },
          },
          { name: 'reasonCode', in: 'query', schema: { type: 'string' } },
          { name: 'cardUid', in: 'query', schema: { type: 'string' } },
          {
            name: 'from',
            in: 'query',
            description: 'Fecha ISO minima de `occurredAt`.',
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'to',
            in: 'query',
            description: 'Fecha ISO maxima de `occurredAt`.',
            schema: { type: 'string', format: 'date-time' },
          },
        ],
        responses: {
          '200': accessEventPageResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
    },
    '/access-events/{id}': {
      get: {
        tags: ['Historial'],
        summary: 'Obtener evento de acceso',
        description: 'Roles admin, operator y auditor.',
        operationId: 'getAccessEvent',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': accessEventResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/me/access-events': {
      get: {
        tags: ['Historial'],
        summary: 'Listar mis eventos de acceso',
        description:
          'App movil. Requiere una cuenta vinculada a un empleado; el servidor ' +
          'filtra siempre por el empleado autenticado.',
        operationId: 'listMyAccessEvents',
        security: supabaseSecurity,
        parameters: [...paginationParameters],
        responses: {
          '200': accessEventPageResponse,
          '400': validationResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
    },
    '/me/access-events/{id}': {
      get: {
        tags: ['Historial'],
        summary: 'Obtener mi evento de acceso',
        description:
          'App movil. Un evento de otro empleado responde `404` para no revelar ' +
          'su existencia.',
        operationId: 'getMyAccessEvent',
        security: supabaseSecurity,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': accessEventResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Resumen del dashboard',
        description:
          'Roles admin, operator y auditor. Agrega empleados, credenciales, ' +
          'areas, dispositivos y eventos de las ultimas 24 horas.',
        operationId: 'getDashboardSummary',
        security: supabaseSecurity,
        responses: {
          '200': dashboardResponse,
          '401': unauthorizedResponse,
          '403': forbiddenResponse,
        },
      },
    },
  },
}
