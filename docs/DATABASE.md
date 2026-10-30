# Base de datos

## Estado

- Motor: PostgreSQL (Supabase).
- ORM: Prisma 7 (`prisma-client` + `@prisma/adapter-pg`).
- **El modelo definitivo no esta aprobado.** El archivo
  `apps/api/prisma/schema.prisma` solo contiene `datasource` y `generator`.
- **No se han creado migraciones ni se ha modificado ninguna base de datos.**
- No se deben ejecutar `prisma migrate` contra una base real hasta que el lider
  tecnico apruebe el modelo.

## Entidades conceptuales

Las entidades solicitadas son:

| Entidad | Proposito | Notas |
| --- | --- | --- |
| `employees` | Personas que usan tarjetas | Sus campos definitivos no estan aprobados |
| `user_accounts` | Cuentas autenticadas (Supabase Auth) | Separadas de `employees`; un empleado puede o no tener cuenta |
| `roles` | Roles administrativos | Modelo de permisos pendiente |
| `credentials` | Tarjetas RFID | UID identificable y estado (activa, bloqueada, etc.) |
| `areas` | Areas fisicas de la instalacion | Catalogo pendiente de definicion |
| `access_permissions` | Permisos empleado-area | Puede requerir vigencia temporal; pendiente |
| `access_devices` | Controladores fisicos | Identificador estable, estado, version de configuracion |
| `device_areas` | Areas administradas por un dispositivo | Relacion N:M |
| `access_events` | Historial de intentos de acceso | Conserva autorizados y rechazados |
| `device_sync_states` | Estado de sincronizacion por dispositivo | Ultima sincronizacion, version, pendientes |

## Reglas de diseno ya establecidas

1. **Separacion de identidades:** `user_accounts` no se mezcla con `employees`.
   La cuenta es el sujeto de autenticacion; el empleado es el sujeto de negocio.
2. **Tarjetas:** una tarjeta tiene un UID unico y un estado. Un empleado puede
   tener varias tarjetas asociadas.
3. **Permisos:** relacionan empleados con areas. Se debe poder revocar un
   permiso sin borrar el historial.
4. **Dispositivos y areas:** un dispositivo puede administrar una o varias
   areas (`device_areas`). La cardinalidad definitiva se aprobara junto con el
   modelo.
5. **Historial completo:** `access_events` guarda eventos autorizados y
   rechazados. Nunca se eliminan por borrar un empleado o una tarjeta.
6. **Tarjeta desconocida:** un evento puede existir sin empleado asociado
   (tarjeta no registrada o inactiva).
7. **Dos tiempos:** cada evento debe distinguir:
   - `occurred_at`: cuando ocurrio el intento en el dispositivo.
   - `received_at`: cuando el servidor recibio el evento (sincronizacion).
8. **Idempotencia:** cada evento sincronizado lleva un `client_event_id` unico
   por dispositivo. Un reintento no debe duplicar el evento.
9. **Campos abiertos:** no se asumen los campos definitivos de empleados ni el
   catalogo oficial de areas.

## Borrador de relaciones (sujeto a aprobacion)

```text
employees 1---N credentials
employees 1---N access_permissions N---1 areas
employees 0---1 user_accounts
user_accounts N---N roles            (tabla puente por definir)
access_devices N---N areas           (device_areas)
access_devices 1---1 device_sync_states
access_devices 1---N access_events
access_events N---1 credentials      (nullable)
access_events N---1 employees        (nullable)
access_events N---1 areas            (nullable segun diseno)
```

## Decisiones pendientes

- Formato y normalizacion del UID de tarjeta (hex, mayusculas, longitud).
- Si un evento guarda el area solicitada, el area del dispositivo o ambas.
- Vigencia temporal de permisos (fecha inicio/fin, horarios).
- Modelo de roles y permisos administrativos (RBAC simple vs. granular).
- Uso de borrado logico (`deleted_at`) en empleados, tarjetas, areas y
  dispositivos.
- Identificacion y autenticacion de dispositivos (token, certificado).
- Estrategia de versionado para sincronizacion (contador incremental vs.
  `updated_at` + cursor).
- Politicas de Row Level Security en Supabase y rol usado por el backend
  (service role solo del lado servidor).
- Indices definitivos (se propondran con las consultas reales).

## Estrategia de migraciones

1. Aprobar el modelo conceptual y los tipos.
2. Escribir el esquema Prisma.
3. Generar una migracion y revisar el SQL **antes** de aplicarlo.
4. Aplicar primero en una base de desarrollo.
5. Documentar el cambio y los datos iniciales (seed) aprobados.

Mientras no se apruebe el modelo, `npm run prisma:migrate` no debe usarse
contra una base real.

## Conexion a Supabase

- Usar la cadena de conexion de PostgreSQL del proyecto Supabase en
  `DATABASE_URL`.
- Para entornos con pooling, usar el URI del pooler que indique Supabase.
- Nunca versionar credenciales. `.env` esta en `.gitignore`.
- Prisma 7 no carga `.env` automaticamente; `prisma.config.ts` y
  `src/config/env.ts` cargan el `.env` de la raiz del monorepo.
