# Contratos de API

Prefijo: `/api/v1`. Formato: JSON. La interfaz de usuario sera en espanol; los
nombres de campos, rutas y codigos van en ingles.

> **Estado:** solo `GET /api/v1/health` esta implementado. Los contratos de
> sincronizacion estan documentados como diseno previsto y **no** estan
> implementados todavia.

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
  `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`.
- Autenticacion prevista: `Authorization: Bearer <supabase-access-token>`.
- Autenticacion de dispositivos: pendiente de definir (token de dispositivo).

## Implementado

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

## Previsto: sincronizacion de dispositivos

Ambos endpoints pertenecen al flujo offline del controlador ESP32-S3. El
dispositivo conserva empleados, tarjetas, permisos y configuracion localmente,
y encola eventos hasta recuperar conexion.

### GET /api/v1/devices/{deviceId}/sync

Descarga el estado necesario para operar offline.

Parametros de ruta:

| Parametro | Tipo | Descripcion |
| --- | --- | --- |
| `deviceId` | string | Identificador estable del dispositivo |

Cabeceras previstas:

| Cabecera | Descripcion |
| --- | --- |
| `Authorization` | Credencial del dispositivo (mecanismo pendiente) |
| `If-None-Match` | Version de sincronizacion conocida por el dispositivo (opcional) |

Respuesta `200 OK` (borrador, pendiente de aprobacion):

```json
{
  "deviceId": "dev_01",
  "syncVersion": "2026-01-01T12:00:00.000Z:42",
  "generatedAt": "2026-01-01T12:00:00.000Z",
  "areas": [],
  "employees": [],
  "credentials": [],
  "permissions": [],
  "config": {}
}
```

Respuesta `304 Not Modified` si el dispositivo ya tiene la version vigente
(mecanismo a confirmar).

### POST /api/v1/devices/{deviceId}/events/sync

Sube eventos almacenados localmente. Debe ser idempotente: reintentar el mismo
lote no duplica eventos.

Solicitud (borrador):

```json
{
  "deviceId": "dev_01",
  "events": [
    {
      "clientEventId": "dev_01-000001",
      "cardUid": "A1B2C3D4",
      "deviceId": "dev_01",
      "occurredAt": "2026-01-01T11:59:00.000Z",
      "decision": "granted",
      "areaId": "area_01"
    }
  ]
}
```

Reglas previstas:

- `clientEventId` es unico por dispositivo; el servidor lo usa para deduplicar.
- El servidor registra `received_at` con su propio reloj, distinto de
  `occurredAt`.
- Eventos de tarjetas desconocidas se aceptan sin empleado asociado.
- La respuesta informa aceptados, duplicados y rechazados con motivo.

Respuesta `200 OK` (borrador):

```json
{
  "accepted": ["dev_01-000001"],
  "duplicated": [],
  "rejected": []
}
```

## Pendiente de definir

- Versionado y formato exacto del payload de sincronizacion.
- Autenticacion y autorizacion de dispositivos.
- Limites de tamano de lote y paginacion del historial.
- Endpoints administrativos (CRUD) y de consulta movil.
- Generacion de OpenAPI/Swagger a partir de estos contratos.
