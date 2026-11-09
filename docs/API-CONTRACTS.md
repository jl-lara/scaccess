# Contratos de API

Prefijo: `/api/v1`. Formato: JSON. La interfaz de usuario sera en espanol; los
nombres de campos, rutas y codigos van en ingles.

> **Estado:** todos los endpoints de `/api/v1` estan **implementados**. La
> especificacion OpenAPI 3.1 se sirve en `GET /api/v1/openapi.json` y la
> documentacion interactiva en `GET /api/v1/docs`. El contrato de
> sincronizacion de dispositivos tambien esta implementado y probado.

## Convenciones

- Errores uniformes:

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request payload",
      "details": []
    }
  }
  ```

- Codigos usados: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
  `CONFLICT`, `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`,
  `INTERNAL_SERVER_ERROR`.
- Autenticacion de usuarios: `Authorization: Bearer <supabase-access-token>`.
- Autenticacion de dispositivos: `Authorization: Bearer <tokenId>.<secret>`
  (ver ADR-0009).
- Listados paginados:

  ```json
  {
    "data": [],
    "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
  }
  ```

  Parametros: `page` (entero, minimo 1, por defecto 1) y `pageSize` (entero,
  entre 1 y 100, por defecto 20).
- Fechas en ISO 8601 (`date-time`). Los `bigint` (`configVersion`,
  `deviceSequence`) se serializan como string para no perder precision.

## Autorizacion

| Rol | Alcance |
| --- | --- |
| `admin` | Acceso completo, incluidos usuarios, roles y credenciales de dispositivo. |
| `operator` | Empleados, tarjetas, permisos y lectura de dispositivos e historial. |
| `auditor` | Solo lectura: areas, empleados, tarjetas, permisos, dispositivos, historial y dashboard. |

Los endpoints moviles (`/me/access-events`) exigen una cuenta vinculada a un
empleado (`employeeId` no nulo). La identidad del empleado sale siempre del
token autenticado, nunca de un parametro del cliente.

## Resumen de rutas

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Salud del proceso (sin autenticacion). |
| `GET` | `/api/v1/openapi.json` | Documento OpenAPI 3.1.0. |
| `GET` | `/api/v1/docs` | Documentacion interactiva HTML. |
| `GET` | `/api/v1/auth/me` | Perfil del usuario autenticado. |
| `GET` | `/api/v1/roles` | Roles del sistema (admin). |
| `GET` | `/api/v1/users` | Listar cuentas (admin). |
| `POST` | `/api/v1/users` | Crear cuenta (admin). |
| `GET` | `/api/v1/users/{id}` | Obtener cuenta (admin). |
| `PATCH` | `/api/v1/users/{id}` | Actualizar cuenta (admin). |
| `GET` | `/api/v1/areas` | Listar areas. |
| `POST` | `/api/v1/areas` | Crear area (admin). |
| `GET` | `/api/v1/areas/{id}` | Obtener area. |
| `PATCH` | `/api/v1/areas/{id}` | Actualizar area (admin). |
| `GET` | `/api/v1/employees` | Listar empleados. |
| `POST` | `/api/v1/employees` | Crear empleado (admin/operator). |
| `GET` | `/api/v1/employees/{id}` | Obtener empleado. |
| `PATCH` | `/api/v1/employees/{id}` | Actualizar empleado (admin/operator). |
| `GET` | `/api/v1/credentials` | Listar tarjetas RFID. |
| `POST` | `/api/v1/credentials` | Registrar tarjeta (admin/operator). |
| `GET` | `/api/v1/credentials/{id}` | Obtener tarjeta. |
| `PATCH` | `/api/v1/credentials/{id}` | Actualizar tarjeta (admin/operator). |
| `GET` | `/api/v1/access-permissions` | Listar permisos. |
| `POST` | `/api/v1/access-permissions` | Otorgar permiso (admin/operator). |
| `POST` | `/api/v1/access-permissions/{id}/revoke` | Revocar permiso (admin/operator). |
| `GET` | `/api/v1/access-devices` | Listar dispositivos. |
| `POST` | `/api/v1/access-devices` | Registrar dispositivo (admin). |
| `GET` | `/api/v1/access-devices/{id}` | Obtener dispositivo. |
| `PATCH` | `/api/v1/access-devices/{id}` | Actualizar dispositivo (admin). |
| `POST` | `/api/v1/access-devices/{id}/credentials` | Emitir credencial (admin). |
| `POST` | `/api/v1/access-devices/{id}/credentials/{credentialId}/revoke` | Revocar credencial (admin). |
| `GET` | `/api/v1/access-devices/{id}/sync-state` | Estado de sincronizacion. |
| `GET` | `/api/v1/devices/{deviceId}/sync` | Descargar configuracion offline (dispositivo). |
| `POST` | `/api/v1/devices/{deviceId}/events/sync` | Subir eventos offline (dispositivo). |
| `GET` | `/api/v1/access-events` | Historial general (admin/operator/auditor). |
| `GET` | `/api/v1/access-events/{id}` | Detalle de evento (admin/operator/auditor). |
| `GET` | `/api/v1/me/access-events` | Historial personal (cuenta de empleado). |
| `GET` | `/api/v1/me/access-events/{id}` | Detalle personal (cuenta de empleado). |
| `GET` | `/api/v1/dashboard/summary` | Resumen agregado (admin/operator/auditor). |

## Sistema y documentacion

### GET /api/v1/health

Verifica que el proceso HTTP esta vivo. No consulta la base de datos.

Respuesta `200 OK`:

```json
{
  "status": "ok",
  "service": "access-control-api",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "uptimeSeconds": 42
}
```

### GET /api/v1/openapi.json

Devuelve el documento OpenAPI 3.1.0 completo, con `servers: [{ "url":
"/api/v1" }]`, esquemas de seguridad `supabaseBearer` y `deviceBearer`, y todos
los paths implementados.

### GET /api/v1/docs

Devuelve una pagina HTML autocontenida (sin CDN ni dependencias externas) que
lee `/api/v1/openapi.json` y permite explorar y probar los endpoints. La ruta
ajusta su `Content-Security-Policy` para permitir el script y los estilos
inline de la propia pagina.

## Autenticacion

### GET /api/v1/auth/me

Devuelve la cuenta vinculada al token de Supabase Auth y refresca
`lastLoginAt` como maximo cada cinco minutos.

Respuesta `200 OK`:

```json
{
  "id": "3f0f...",
  "authUserId": "9a7b...",
  "employeeId": "0c4d...",
  "email": "ana.lopez@example.com",
  "status": "active",
  "roles": ["operator"],
  "lastLoginAt": "2026-01-01T12:00:00.000Z",
  "createdAt": "2026-01-01T10:00:00.000Z",
  "updatedAt": "2026-01-01T12:00:00.000Z"
}
```

Errores: `401` si falta el token o no es valido; `403` si la cuenta esta
deshabilitada; `404` si la cuenta no existe en la base local.

## Catalogo administrativo

### Roles

`GET /api/v1/roles` (solo `admin`) devuelve un arreglo de roles:

```json
[
  {
    "id": "6b1a...",
    "code": "admin",
    "name": "Administrador",
    "description": "Acceso completo a la administracion del sistema",
    "isSystem": true
  }
]
```

El seed idempotente crea o actualiza los roles `admin`, `operator` y `auditor`.

### Usuarios

- `GET /api/v1/users`: filtros `status` (`active`/`disabled`) y `search`
  (email, codigo o nombre del empleado), mas paginacion.
- `POST /api/v1/users`: cuerpo con `authUserId`, `email`, `employeeId`
  opcional, `status` opcional y `roleCodes` opcional. Responde `201`.
- `GET /api/v1/users/{id}`: detalle.
- `PATCH /api/v1/users/{id}`: `status`, `employeeId` y/o `roleCodes`. Responde
  `200`. Todos los endpoints exigen rol `admin`.

La respuesta de cuenta usa la forma de `GET /auth/me`. Los conflictos de
unicidad (`authUserId`, `email`, `employeeId`) responden `409`.

### Areas

- `GET /api/v1/areas`: filtros `isActive` y `search`, mas paginacion.
- `POST /api/v1/areas` (admin): `code`, `name`, `description`, `isActive`,
  `timezone`. Responde `201`.
- `GET /api/v1/areas/{id}` y `PATCH /api/v1/areas/{id}` (admin para PATCH).

Respuesta `201`/`200`: `AreaDto` con `id`, `code`, `name`, `description`,
`isActive`, `timezone`, `createdAt`, `updatedAt`.

### Empleados

- `GET /api/v1/employees`: filtros `status` (`active`/`inactive`/`suspended`),
  `department` y `search`, mas paginacion.
- `POST /api/v1/employees` (admin/operator): `employeeCode`, `firstName`,
  `lastName`, `email`, `department`, `position`, `status`, `hiredAt`.
- `GET`/`PATCH /api/v1/employees/{id}`: `PATCH` para admin/operator.

### Tarjetas RFID (credenciales)

- `GET /api/v1/credentials`: filtros `employeeId`, `status`
  (`active`/`blocked`/`lost`/`retired`) y `cardUid`, mas paginacion.
- `POST /api/v1/credentials` (admin/operator): `employeeId`, `cardUid`,
  `label`, `status` (por defecto `active`). El UID se normaliza a mayusculas
  sin separadores y debe tener 8-32 caracteres hexadecimales con longitud par.
- `GET`/`PATCH /api/v1/credentials/{id}`: el PATCH permite `label`, `status` y
  `deactivationReason`. Las tarjetas no se eliminan: se bloquean, reportan como
  perdidas o se retiran.

### Permisos de acceso

- `GET /api/v1/access-permissions`: filtros `employeeId`, `areaId` y
  `activeOnly`, mas paginacion.
- `POST /api/v1/access-permissions` (admin/operator): `employeeId`, `areaId`,
  `validFrom`, `validTo` y `schedule`. El servidor registra `grantedById` a
  partir del usuario autenticado. Responde `201`.
- `POST /api/v1/access-permissions/{id}/revoke` (admin/operator): revocacion
  logica que fija `revokedAt`; responde `200` con el permiso actualizado.

## Dispositivos y sincronizacion

### Dispositivos

- `GET /api/v1/access-devices`: listado paginado.
- `POST /api/v1/access-devices` (admin): `deviceCode`, `name`, `location`,
  `hardwareModel`, `firmwareVersion`, `status`, `areaIds`. Responde `201`.
- `GET`/`PATCH /api/v1/access-devices/{id}`: el PATCH es solo para admin;
  reemplazar `areaIds` incrementa `configVersion` para forzar resincronizacion.
- `POST /api/v1/access-devices/{id}/credentials` (admin): emite una credencial
  y devuelve el token completo **una sola vez**:

  ```json
  {
    "id": "b3c2...",
    "deviceId": "d4e5...",
    "tokenId": "devtok_1f0c...",
    "token": "devtok_1f0c....<secret>",
    "createdAt": "2026-01-01T12:00:00.000Z",
    "expiresAt": null
  }
  ```

  El servidor solo almacena el hash SHA-256 del secreto.
- `POST /api/v1/access-devices/{id}/credentials/{credentialId}/revoke`
  (admin): revocacion logica e idempotente; responde `204`.
- `GET /api/v1/access-devices/{id}/sync-state`: estado de sincronizacion
  (`lastSyncRequestedAt`, `lastSyncCompletedAt`, `lastEventReceivedAt`,
  `lastEventOccurredAt`, `pendingEventCountReported`, `lastErrorCode`,
  `lastErrorAt`, `configVersion`).

### GET /api/v1/devices/{deviceId}/sync

Descarga el estado necesario para operar offline. Requiere la credencial del
dispositivo; `deviceId` puede ser el UUID o el `deviceCode`, y debe corresponder
al dispositivo autenticado.

Parametros de ruta:

| Parametro | Tipo | Descripcion |
| --- | --- | --- |
| `deviceId` | string | UUID o `deviceCode` del dispositivo |

Cabeceras:

| Cabecera | Descripcion |
| --- | --- |
| `Authorization` | Credencial del dispositivo (`<tokenId>.<secret>`) |
| `If-None-Match` | Version de sincronizacion conocida por el dispositivo (opcional) |

Respuesta `200 OK` (tipo `DeviceSyncPayload` de `@scaccess/shared`):

```json
{
  "deviceId": "d4e5...",
  "syncVersion": "42",
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "checksum": "sha256...",
  "areas": [
    { "id": "area_01", "code": "LAB", "name": "Laboratorio", "timezone": "America/Tijuana" }
  ],
  "employees": [
    {
      "id": "emp_01",
      "employeeCode": "E-0001",
      "firstName": "Ana",
      "lastName": "Lopez",
      "status": "active"
    }
  ],
  "credentials": [
    { "id": "cred_01", "employeeId": "emp_01", "cardUid": "A1B2C3D4", "status": "active" }
  ],
  "permissions": [
    {
      "employeeId": "emp_01",
      "areaId": "area_01",
      "validFrom": null,
      "validTo": null,
      "schedule": null
    }
  ],
  "config": { "configVersion": "42", "timezone": "America/Tijuana" }
}
```

- Solo se incluyen areas activas asignadas al dispositivo, empleados activos,
  sus credenciales y los permisos no revocados.
- `checksum` es el SHA-256 hexadecimal del contenido versionado (sin
  `generatedAt`), para que sea estable mientras no cambie `configVersion`.
- `syncVersion`/`config.configVersion` corresponden al contador monotono
  `config_version` (serializado como string por ser `bigint`).
- La respuesta `200` incluye `ETag: "<syncVersion>"`. Si `If-None-Match`
  coincide, responde `304 Not Modified` sin cuerpo.
- Ambas variantes actualizan `lastSeenAt` y el estado de sincronizacion.

### POST /api/v1/devices/{deviceId}/events/sync

Sube eventos almacenados localmente. Es idempotente: reintentar el mismo lote
no duplica eventos. Requiere credencial de dispositivo.

Solicitud (tipo `DeviceEventSyncRequest` de `@scaccess/shared`):

```json
{
  "deviceId": "dev_01",
  "events": [
    {
      "clientEventId": "dev_01-000001",
      "cardUid": "A1B2C3D4",
      "deviceId": "dev_01",
      "areaId": "area_01",
      "occurredAt": "2026-01-01T11:59:00.000Z",
      "decision": "granted",
      "reasonCode": "allowed",
      "deviceEpoch": "1f0c...",
      "deviceSequence": "1",
      "metadata": { "firmwareVersion": "1.2.0" }
    }
  ]
}
```

Reglas implementadas:

- `clientEventId` es unico por dispositivo; el servidor lo usa para deduplicar
  (`UNIQUE (device_id, client_event_id)`).
- `areaId` es obligatorio y debe estar asignado al dispositivo (o existir como
  area); si no, el evento se rechaza con `area_not_allowed`.
- `decision` y `reasonCode` deben ser coherentes: `granted` solo admite
  `allowed`; `denied` exige cualquier otro motivo. Un evento incoherente se
  rechaza con `invalid_decision_reason` sin abortar el lote.
- Un evento `granted` con tarjeta desconocida se rechaza con `card_unknown`.
  Los eventos `denied` de tarjetas desconocidas se aceptan sin empleado.
- `deviceEpoch` y `deviceSequence` son opcionales. `metadata` es opcional.
- El servidor registra `receivedAt` con su propio reloj, distinto de
  `occurredAt`.
- El lote admite entre 1 y 500 eventos.
- La respuesta informa aceptados, duplicados y rechazados con motivo.

Respuesta `200 OK` (tipo `DeviceEventSyncResponse` de `@scaccess/shared`):

```json
{
  "accepted": ["dev_01-000001"],
  "duplicated": [],
  "rejected": [
    { "clientEventId": "dev_01-000002", "reasonCode": "card_unknown", "message": "..." }
  ]
}
```

Errores:

- `400` con `VALIDATION_ERROR` si el cuerpo no cumple el esquema.
- `401` con `UNAUTHORIZED` si la credencial del dispositivo no es valida.
- `403` con `FORBIDDEN` si el token pertenece a otro dispositivo o el
  dispositivo no esta activo.
- `413` con `PAYLOAD_TOO_LARGE` cuando el cuerpo supera el limite de 1 MB.

## Historial y dashboard

### GET /api/v1/access-events

Historial general inmutable (sin `PATCH` ni `DELETE`). Filtros: `employeeId`,
`deviceId`, `areaId`, `decision` (`granted`/`denied`), `reasonCode`, `cardUid`,
`from` y `to` (fechas ISO sobre `occurredAt`), mas paginacion. Se ordena por
`occurredAt` descendente. Si `from` es posterior a `to`, responde `400`.

Cada evento (`AccessEventDto`) incluye: `id`, `deviceId`, `clientEventId`,
`deviceEpoch`, `cardUid`, `employeeId` (null para tarjetas desconocidas),
`credentialId`, `areaId`, `decision`, `reasonCode`, `occurredAt`, `receivedAt`,
`deviceSequence`, `metadata` y `createdAt`.

`GET /api/v1/access-events/{id}` devuelve el detalle o `404`.

### GET /api/v1/me/access-events

Historial personal para la app movil. Solo acepta paginacion; el servidor
filtra por el `employeeId` de la cuenta autenticada. Devuelve `403` si la cuenta
no esta vinculada a un empleado.

`GET /api/v1/me/access-events/{id}` devuelve el detalle propio. Un evento de
otro empleado responde `404` para no revelar su existencia.

### GET /api/v1/dashboard/summary

Resumen agregado para la web administrativa:

```json
{
  "employees": { "total": 10, "active": 9 },
  "credentials": { "total": 12, "active": 10, "blockedOrLost": 1 },
  "areas": { "total": 3, "active": 3 },
  "devices": { "total": 2, "active": 2, "outOfSync": 1 },
  "recentEvents24h": { "granted": 40, "denied": 3 }
}
```

`devices.outOfSync` cuenta dispositivos activos sin estado de sincronizacion o
con `configVersion` menor que la del dispositivo.

## Pendiente de definir

- Limites definitivos de retencion y exportacion del historial.
- Politica de rotacion y expiracion de credenciales de dispositivo.
- Autenticacion multifactor para usuarios administrativos.
