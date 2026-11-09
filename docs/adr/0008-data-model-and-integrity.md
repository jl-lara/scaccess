# ADR-0008: Modelo de datos e integridad

- **Estado:** Aprobado
- **Fecha:** 2026-11-03

## Contexto

El sistema necesita un modelo relacional definitivo que soporte el control de
acceso offline, el historial de eventos y la administracion. Tras la auditoria
arquitectonica se consolidaron las entidades, estados e indices necesarios.

## Decision

Se aprueba el modelo de **12 entidades** y **6 enums**, materializado en
`apps/api/prisma/schema.prisma`:

- Entidades: `employees`, `user_accounts`, `roles`, `user_roles`,
  `credentials`, `areas`, `access_permissions`, `access_devices`,
  `device_areas`, `device_sync_states`, `device_credentials`,
  `access_events`.
- Enums: `employee_status`, `credential_status`, `account_status`,
  `device_status`, `access_decision`, `access_reason`.

Convenciones de integridad:

1. **IDs UUID** generados por la base con `gen_random_uuid()` (`@db.Uuid`).
2. **Timestamps con zona** (`timestamptz(6)`) en todos los `DateTime`, excepto
   `employees.hired_at` que es una fecha (`date`).
3. **Borrado logico por estado:** las entidades no se eliminan fisicamente; se
   marcan con `status` (`employee_status`, `credential_status`,
   `device_status`) y/o campos `deactivated_at` / `revoked_at`.
4. **Relaciones historicas `ON DELETE RESTRICT`:** no se puede borrar un
   empleado, tarjeta, area o dispositivo que tenga eventos o permisos.
5. **`access_events` append-only:** conserva un snapshot obligatorio de
   `card_uid` y de `area_id` (`NOT NULL`, identificado por el lector del
   dispositivo). No se actualiza ni se elimina.
6. **Permisos con vigencia opcional:** `valid_from`, `valid_to` y `schedule`
   (`jsonb`) para horarios; cada `area` lleva `timezone` (default
   `America/Tijuana`) para evaluar esos horarios.

## Motivos

- Los eventos deben seguir siendo interpretables aunque se reasigne una tarjeta
  o se desactive un empleado: por eso el snapshot de `card_uid` y las FKs
  `RESTRICT`.
- El borrado logico preserva el historial de accesos (requisito funcional).
- Los timestamps con zona evitan ambiguedad entre el reloj del dispositivo
  (`occurred_at`) y el del servidor (`received_at`).

## Consecuencias

- Prisma no expresa indices unicos parciales ni `CHECK`; esas restricciones se
  aplicaran en la migracion revisada manualmente.
- `access_reason` queda como enum cerrado; ampliarlo requiere una migracion.
- No se ejecutara `prisma migrate` hasta conectar la instancia de desarrollo.
