# ADR-0004: Autenticacion con Supabase Auth

- **Estado:** Aprobado (integracion pendiente)
- **Fecha:** 2026-10-29

## Contexto

Se necesitan cuentas para administradores y empleados, con separacion estricta
de permisos entre ambos tipos de usuario.

## Decision

Usar **Supabase Auth** como proveedor de identidad.

- La API validara los tokens de acceso de Supabase.
- La informacion de negocio (empleados, roles) se guarda en PostgreSQL y se
  relaciona con el identificador de la cuenta.
- La app movil solo accede a datos del empleado autenticado.
- La web administrativa requiere rol autorizado.

## Estado

No implementado en la mision 01. Las variables `SUPABASE_URL`,
`SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` estan reservadas en
`.env.example`.

## Consecuencias

- El backend nunca expone la `SERVICE_ROLE_KEY` a clientes.
- Se debe definir el modelo de roles y la relacion `employees` -
  `user_accounts`.
- Se evaluara Row Level Security como defensa adicional.
