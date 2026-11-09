# Base de datos

## Estado

- Motor: PostgreSQL (Supabase).
- ORM: Prisma 7 (`prisma-client` + `@prisma/adapter-pg`).
- **El modelo conceptual y relacional ha sido aprobado por el lider tecnico**
  (ver ADR-0008 a ADR-0012) y esta plasmado en
  `apps/api/prisma/schema.prisma`: 12 tablas y 6 enums.
- **No se han creado migraciones ni se ha modificado ninguna base de datos.**
- No se debe ejecutar `prisma migrate` contra una base real hasta conectar la
  instancia de desarrollo y revisar la migracion generada.

## Enums aprobados

| Enum | Valores | Uso |
| --- | --- | --- |
| `employee_status` | `active`, `inactive`, `suspended` | Estado del empleado |
| `credential_status` | `active`, `blocked`, `lost`, `retired` | Estado de la tarjeta |
| `account_status` | `active`, `disabled` | Estado de la cuenta autenticada |
| `device_status` | `active`, `inactive`, `maintenance` | Estado del controlador |
| `access_decision` | `granted`, `denied` | Resultado del intento |
| `access_reason` | `allowed`, `card_unknown`, `card_blocked`, `card_lost`, `card_retired`, `employee_inactive`, `permission_missing`, `permission_expired`, `permission_outside_schedule`, `area_not_allowed`, `area_inactive`, `device_error` | Motivo de la decision |

## Tablas aprobadas

| Tabla | Proposito |
| --- | --- |
| `employees` | Personas que usan tarjetas |
| `user_accounts` | Cuentas autenticadas (Supabase Auth), vinculadas 0..1 a empleado |
| `roles` | Roles administrativos (`admin`, `operator`, `auditor`) |
| `user_roles` | Tabla puente usuario-rol (N:M) |
| `credentials` | Tarjetas RFID (UID unico y estado) |
| `areas` | Areas fisicas de la instalacion (con `timezone`) |
| `access_permissions` | Permisos empleado-area con vigencia y horario opcionales |
| `access_devices` | Controladores fisicos (estado y `config_version`) |
| `device_areas` | Areas administradas por un dispositivo (N:M) |
| `device_sync_states` | Estado de sincronizacion por dispositivo (1:1) |
| `device_credentials` | Credenciales de autenticacion del dispositivo |
| `access_events` | Historial append-only de intentos de acceso |

## Reglas de diseno

1. **Separacion de identidades:** `user_accounts` no se mezcla con `employees`.
2. **IDs UUID** generados por la base (`gen_random_uuid()`).
3. **Timestamps con zona** (`timestamptz`); `hired_at` es `date`.
4. **Borrado logico por estado** (`status`, `deactivated_at`, `revoked_at`);
   nunca se elimina fisicamente una entidad con historial.
5. **Historial append-only:** `access_events` nunca se actualiza ni elimina; el
   rol de runtime solo `SELECT`/`INSERT`.
6. **Snapshot en eventos:** cada evento conserva `card_uid` obligatorio y
   `area_id` obligatorio (identificado por el lector del dispositivo).
7. **Relaciones historicas `ON DELETE RESTRICT`:** no se puede borrar un
   empleado, tarjeta, area o dispositivo referenciado por eventos o permisos.
8. **Idempotencia:** `UNIQUE (device_id, client_event_id)`; `device_epoch`
   identifica la epoca de aprovisionamiento.
9. **Dos tiempos:** `occurred_at` (dispositivo) y `received_at` (servidor).
10. **Permisos evaluables offline:** vigencia opcional (`valid_from`,
    `valid_to`) y `schedule` (`jsonb`), con `timezone` en `areas` (default
    `America/Tijuana`).

## Relaciones

```text
employees 1---N credentials
employees 1---N access_permissions N---1 areas
employees 0---1 user_accounts
user_accounts N---N roles            (user_roles)
access_devices N---N areas           (device_areas)
access_devices 1---1 device_sync_states
access_devices 1---N access_events
access_devices 1---N device_credentials
access_events N---1 credentials      (nullable)
access_events N---1 employees        (nullable)
access_events N---1 areas            (obligatorio)
```

## Notas de implementacion en Prisma 7

- Prisma no expresa indices unicos parciales ni `CHECK`; se implementaran en la
  migracion revisada manualmente.
- `config_version` y `device_sequence` son `bigint`; en JSON se serializan como
  string.
- Los enums se modelan con `enum` de Prisma; ampliar `access_reason` requiere
  migracion.

## Estrategia de migraciones

1. Modelo aprobado y esquema Prisma escrito (hecho).
2. Conectar la instancia de desarrollo (`DATABASE_URL` y opcionalmente
   `DIRECT_URL` para migraciones).
3. Generar una migracion y revisar el SQL **antes** de aplicarlo.
4. Aplicar primero en una base de desarrollo.
5. Documentar el cambio y los datos iniciales (seed) aprobados.

## Conexion a Supabase

- `DATABASE_URL`: conexion de runtime (pooler en produccion).
- `DIRECT_URL`: conexion directa (sin pooler) para migraciones, opcional.
- Ambas aceptan unicamente esquemas `postgres://` o `postgresql://`.
- Nunca versionar credenciales. `.env` esta en `.gitignore`.
- Prisma 7 no carga `.env` automaticamente; `prisma.config.ts` y
  `src/config/env.ts` cargan el `.env` de la raiz del monorepo.
