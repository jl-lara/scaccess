# Base de datos

## Estado

- Motor: PostgreSQL 17 (Supabase).
- ORM: Prisma 7 (`prisma-client` + `@prisma/adapter-pg`).
- **El modelo conceptual y relacional ha sido aprobado por el lider tecnico**
  (ver ADR-0008 a ADR-0012) y esta plasmado en
  `apps/api/prisma/schema.prisma`: 12 tablas y 6 enums.
- **La instancia de Supabase ya tiene aplicadas las dos migraciones** de
  `apps/api/prisma/migrations` (init y RLS/indices). Ver
  [Migraciones aplicadas](#migraciones-aplicadas).
- **RLS esta habilitado en las 13 tablas de `public`** (12 del dominio mas
  `_prisma_migrations`) y ya no quedan llaves foraneas sin indice.
- Cualquier cambio futuro debe entrar como una migracion nueva y revisada; no
  se editan migraciones ya aplicadas.

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

## Migraciones aplicadas

| Migracion | Contenido | Estado en Supabase |
| --- | --- | --- |
| `20261104000000_init_access_control` | Crea las 12 tablas del dominio, 6 enums, indices y llaves foraneas | Aplicada el 2026-11-04 |
| `20261109000000_enable_rls_and_fk_indexes` | Habilita RLS en las 13 tablas de `public`, revoca accesos directos en `_prisma_migrations` y `device_credentials` y crea los 3 indices de FK faltantes | Aplicada el 2026-11-09 |

## Row Level Security

La API sigue siendo la unica capa con acceso a la base de datos y se conecta
con el rol duenio de las tablas, que omite RLS. Las politicas existen como
defensa en profundidad para los roles de la API de Supabase:

- `authenticated`: lectura de la fila propia en `user_accounts` (por
  `auth_user_id`), del empleado vinculado en `employees` y de sus propios
  eventos en `access_events` (por `employee_id`). Todas las expresiones usan
  `(select auth.uid())` para evitar `auth_rls_initplan`.
- `service_role`: acceso total (`FOR ALL USING (true) WITH CHECK (true)`) en
  las 13 tablas; es el rol previsto para el backend.
- `anon`: sin politicas, por lo que no puede leer ni escribir ninguna tabla.

Reglas adicionales:

- No se usa `auth.role()`; el rol se declara con `TO authenticated` o
  `TO service_role`.
- Hay una sola politica permisiva por rol y accion en cada tabla (sin
  `multiple_permissive_policies`).
- Todas las tablas con RLS tienen al menos una politica (sin
  `rls_enabled_no_policy`).
- `_prisma_migrations` y `device_credentials` tienen `REVOKE ALL` para `anon`
  y `authenticated`; solo `service_role` (y el duenio) puede acceder.

## Indices de llaves foraneas

Los tres indices que reportaba el Advisor de rendimiento ya existen y estan
declarados en `schema.prisma`:

| Tabla | Columna FK | Indice |
| --- | --- | --- |
| `user_roles` | `assigned_by` | `user_roles_assigned_by_idx` |
| `access_permissions` | `granted_by` | `access_permissions_granted_by_idx` |
| `access_events` | `credential_id` | `access_events_credential_id_idx` |

## Verificacion en vivo

Comprobado contra la instancia de Supabase el 2026-11-09:

- `pg_tables`: 13/13 tablas de `public` con `rowsecurity = true`; 0 tablas con
  RLS deshabilitado.
- `pg_policies`: 16 politicas, 0 tablas con RLS y sin politica, 0 casos de
  `auth_rls_initplan` y 0 casos de `multiple_permissive_policies`.
- `pg_indexes`: existen los 3 indices nuevos; la consulta del lint
  `unindexed_foreign_keys` devuelve 0 filas.
- `information_schema.role_table_grants`: `anon` y `authenticated` no tienen
  privilegios sobre `_prisma_migrations` ni `device_credentials`.
- Prueba funcional en una transaccion revertida: `authenticated` solo ve su
  propia cuenta, empleado y eventos; `anon` no ve filas y ambos reciben
  `permission denied` al intentar leer `device_credentials`.

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
   `DIRECT_URL` para migraciones) (hecho).
3. Generar una migracion y revisar el SQL **antes** de aplicarlo (hecho para
   las dos migraciones actuales).
4. Aplicar primero en una base de desarrollo (hecho: Supabase).
5. Documentar el cambio y los datos iniciales (seed) aprobados (el seed sigue
   pendiente).
6. Aplicar en produccion con `prisma migrate deploy`; no editar migraciones ya
   aplicadas ni usar `migrate dev` contra la base real sin revisar el SQL.

## Conexion a Supabase

- `DATABASE_URL`: conexion de runtime (pooler en produccion).
- `DIRECT_URL`: conexion directa (sin pooler) para migraciones, opcional.
- Ambas aceptan unicamente esquemas `postgres://` o `postgresql://`.
- Nunca versionar credenciales. `.env` esta en `.gitignore`.
- Prisma 7 no carga `.env` automaticamente; `prisma.config.ts` y
  `src/config/env.ts` cargan el `.env` de la raiz del monorepo.
