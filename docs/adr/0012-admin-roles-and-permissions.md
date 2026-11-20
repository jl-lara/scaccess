# ADR-0012: Roles y permisos administrativos

- **Estado:** Aprobado
- **Fecha:** 2026-11-03

## Contexto

La web administrativa requiere control de acceso por rol, mientras que la app
movil de empleados debe limitarse al historial del propio empleado.

## Decision

Se aprueba un **RBAC administrativo** basado en:

- Tabla `roles` con roles de sistema `admin`, `operator`, `auditor` y `viewer`
  (codigo unico, `is_system` para roles protegidos).
- Tabla puente `user_roles` (N:M) que asigna roles a `user_accounts`, con
  `assigned_by` para auditoria y `assigned_at` para trazabilidad.
- La **autorizacion movil de empleados** queda estrictamente ligada a
  `user_accounts.employee_id`: un empleado autenticado solo ve su propio
  historial y nunca accede a funciones administrativas.

### Roles de sistema y matriz de acceso

| Rol (`code`) | Nombre (`name`) | Monitoreo (`dashboard`, lectura `areas`, lectura `access-events`) | Lectura de catalogos (`employees`, `credentials`, `access-permissions`, `access-devices`) | Escritura operativa (`employees`, `credentials`, `access-permissions`) | Administracion (`areas`, `access-devices`, credenciales de dispositivo) | Usuarios y roles (`/roles`, `/users`) |
| --- | --- | --- | --- | --- | --- | --- |
| `admin` | Administrador | Lectura | Lectura | Lectura y escritura | Lectura y escritura | Lectura y escritura |
| `operator` | Operador | Lectura | Lectura | Lectura y escritura | Sin escritura (`403`) | Sin acceso (`403`) |
| `auditor` | Auditor | Lectura | Lectura | Sin escritura (`403`) | Sin escritura (`403`) | Sin acceso (`403`) |
| `viewer` | Monitor | Lectura (`200`) | Sin acceso (`403`) | Sin acceso (`403`) | Sin acceso (`403`) | Sin acceso (`403`) |

Notas sobre `viewer` (`Monitor`):

- Permite monitoreo en vivo del panel (`GET /api/v1/dashboard/summary`), croquis
  o listado/detalle de areas (`GET /api/v1/areas`, `GET /api/v1/areas/{id}`) y
  bitacora general de eventos (`GET /api/v1/access-events`,
  `GET /api/v1/access-events/{id}`).
- No incluye exportacion ni consulta de catalogos operativos (`employees`,
  `credentials`, `access-permissions`, `access-devices`), administracion de
  cuentas/roles (`/roles`, `/users`) ni operaciones de escritura (`POST`/`PATCH`),
  que responden `403 FORBIDDEN`.

## Motivos

- La tabla puente permite varios roles por usuario y evita un enum rigido.
- Separar el rol administrativo del vinculo `employee_id` mantiene las dos
  identidades (negocio y autenticacion) limpias.

## Consecuencias

- La matriz por rol define los permisos concretos de cada endpoint
  administrativo bajo `/api/v1`, manteniendo la separacion entre monitoreo en
  vivo (`viewer`), auditoria de solo lectura (`auditor`), operacion
  (`operator`) y administracion completa (`admin`).
- El rol de "empleado" no se modela en `roles`: se deduce del vinculo con
  `employees`.
- `user_roles.user_id` y `user_roles.role_id` usan `ON DELETE RESTRICT`.
