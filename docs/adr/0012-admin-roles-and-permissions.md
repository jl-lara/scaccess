# ADR-0012: Roles y permisos administrativos

- **Estado:** Aprobado
- **Fecha:** 2026-11-03

## Contexto

La web administrativa requiere control de acceso por rol, mientras que la app
movil de empleados debe limitarse al historial del propio empleado.

## Decision

Se aprueba un **RBAC administrativo** basado en:

- Tabla `roles` con roles iniciales `admin`, `operator`, `auditor`
  (codigo unico, `is_system` para roles protegidos).
- Tabla puente `user_roles` (N:M) que asigna roles a `user_accounts`, con
  `assigned_by` para auditoria y `assigned_at` para trazabilidad.
- La **autorizacion movil de empleados** queda estrictamente ligada a
  `user_accounts.employee_id`: un empleado autenticado solo ve su propio
  historial y nunca accede a funciones administrativas.

## Motivos

- La tabla puente permite varios roles por usuario y evita un enum rigido.
- Separar el rol administrativo del vinculo `employee_id` mantiene las dos
  identidades (negocio y autenticacion) limpias.

## Consecuencias

- Los roles y sus permisos concretos se detallaran al implementar los endpoints
  administrativos.
- El rol de "empleado" no se modela en `roles`: se deduce del vinculo con
  `employees`.
- `user_roles.user_id` y `user_roles.role_id` usan `ON DELETE RESTRICT`.
