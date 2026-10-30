# Arquitectura

## Vision general

El sistema es un **monolito modular** con una API REST/JSON como unico punto de
acceso a los datos. Dos clientes consumen la API:

1. Aplicacion web administrativa (React + Vite).
2. Aplicacion movil para empleados (React Native + Expo).

Ademas, un controlador fisico (ESP32-S3 + lector RC522) opera de forma
offline-first y sincroniza con la API.

```text
                        +-----------------------------+
                        |  Supabase PostgreSQL + Auth |
                        +--------------+--------------+
                                       |
                            Prisma (driver adapter pg)
                                       |
  +-------------+          +------------+-------------+          +-------------+
  |  apps/admin |  HTTPS   |        apps/api          |  HTTPS   | apps/mobile |
  | React+Vite  +--------->| Node + Express + TS      |<---------+ Expo        |
  +-------------+  REST    | /api/v1 (monolito        |  REST    +-------------+
                           |  modular)                |
                           +------------+-------------+
                                        |
                                        | HTTPS (sync)
                                        |
                           +------------+-------------+
                           | ESP32-S3 + RC522        |
                           | almacenamiento local    |
                           +-------------------------+
```

## Monolito modular

- Un solo proceso desplegable (`apps/api`).
- Separacion interna por modulos de negocio (`src/modules/<modulo>`), cada uno
  con sus rutas, controladores y servicios.
- Un modulo no accede a la base de datos de otro modulo por atajos: usa sus
  servicios o consultas Prisma encapsuladas.
- Se evitan microservicios, Kubernetes, colas distribuidas y otras piezas de
  infraestructura que no aportan al alcance del prototipo.

Modulos previstos: `health` (implementado), `employees`, `credentials`
(tarjetas), `areas`, `access-permissions`, `access-devices`,
`access-events`, `device-sync`, `auth`, `users`, `roles`.

## Responsabilidad de cada aplicacion

### API (`apps/api`)

- Expone los contratos REST/JSON versionados en `/api/v1`.
- Valida entradas con Zod y centraliza errores en un formato uniforme.
- Aplica autenticacion/autorizacion (Supabase Auth) en misiones posteriores.
- Es la unica capa con acceso directo a PostgreSQL via Prisma.
- Atiende la sincronizacion de los dispositivos fisicos.

### Web administrativa (`apps/admin`)

- Uso exclusivo de administradores y personal autorizado.
- Dashboard, gestion de empleados, tarjetas, areas, permisos, usuarios, roles,
  dispositivos, historial general y estado de sincronizacion.
- Requiere Internet.

### App movil (`apps/mobile`)

- Uso de empleados autenticados.
- Historial personal de accesos y detalle de eventos propios.
- Nunca puede consultar datos de otros empleados ni ejecutar funciones
  administrativas.
- Requiere Internet.

### `packages/shared`

- Tipos y constantes de contrato compartidos. Sin logica de negocio ni
  dependencias de runtime. Se adoptara desde los clientes cuando se
  implementen los endpoints de sincronizacion.

## Comunicacion clientes-backend

- REST sobre JSON, prefijo `/api/v1`.
- Autenticacion prevista con tokens de Supabase Auth (`Authorization: Bearer`).
- Errores uniformes:

  ```json
  { "error": { "code": "NOT_FOUND", "message": "...", "details": [] } }
  ```

- La documentacion OpenAPI/Swagger se generara a partir de los contratos
  aprobados. Aun no esta implementada.

## Persistencia

- PostgreSQL administrado por Supabase.
- Prisma 7 con el generador `prisma-client` y el driver adapter
  `@prisma/adapter-pg`.
- La URL de conexion se toma de `DATABASE_URL` (raiz del monorepo, archivo
  `.env` ignorado por Git).
- El cliente Prisma se instancia de forma perezosa: la API puede arrancar y
  responder `/api/v1/health` sin credenciales de base de datos.
- El modelo de datos definitivo esta pendiente de aprobacion. Ver
  [DATABASE.md](DATABASE.md).

## Integracion futura con ESP32-S3

El firmware no forma parte de esta mision. El backend ya contempla los
contratos de sincronizacion (ver [API-CONTRACTS.md](API-CONTRACTS.md)):

- `GET /api/v1/devices/{deviceId}/sync`: el dispositivo descarga empleados,
  tarjetas, permisos, areas y configuracion, junto con una version de
  sincronizacion.
- `POST /api/v1/devices/{deviceId}/events/sync`: el dispositivo sube eventos
  almacenados localmente.

Consideraciones de diseno:

- Identificador de evento generado por el dispositivo (`clientEventId`) para
  idempotencia.
- Distincion entre `occurredAt` (momento del evento fisico) y `receivedAt`
  (momento en que el servidor lo recibe).
- Autenticacion del dispositivo pendiente de definir (token de dispositivo).
- Si el dispositivo pierde Internet, sigue validando con su copia local y
  encola eventos.

## Estrategia offline

- **Solo el controlador fisico** es offline-first.
- La web administrativa y la app movil requieren Internet; no se implementa
  cache offline para ellas.
- El estado de sincronizacion se modela en el backend para que la web pueda
  mostrar dispositivos desactualizados o con eventos pendientes.

## Limites del prototipo

- Un solo backend desplegable.
- Sin microservicios, sin colas distribuidas, sin Kubernetes.
- Sin integracion de hardware real en esta etapa; no se simula como si lo
  fuera.
- Modelo de datos y reglas de permisos aun sujetos a aprobacion.
- La interfaz de usuario sera en espanol; identificadores de codigo en ingles.
