# ADR-0011: Conexion a Supabase y Row Level Security

- **Estado:** Aprobado
- **Fecha:** 2026-11-03

## Contexto

Supabase suele ofrecer dos URI de PostgreSQL: uno con pooler (para la
aplicacion) y uno directo (para migraciones). Ademas, la API debe ejecutarse con
el minimo privilegio y, en Supabase, conviene RLS como defensa en profundidad.

## Decision

- `DATABASE_URL` es la cadena de conexion de **runtime** (pooler en produccion).
- `DIRECT_URL` es opcional y apunta a la conexion **directa** para ejecutar
  migraciones.
- Ambas variables, cuando estan definidas, validan esquema `postgres://` o
  `postgresql://`.
- El rol de **runtime** opera con privilegios minimos: solo `SELECT`/`INSERT`
  sobre `access_events` (nunca `UPDATE`/`DELETE`), coherente con su naturaleza
  append-only.
- En Supabase se aplican **politicas RLS** como defensa en profundidad, sin
  sustituir la autorizacion de la API (que sigue siendo la unica capa con
  acceso a la base de datos).

## Motivos

- El pooler evita agotar conexiones en entornos serverless; la conexion directa
  es necesaria para migraciones.
- Validar el esquema evita pasar URLs no PostgreSQL al driver `pg`.
- El privilegio minimo y RLS reducen el radio de dano ante una fuga de
  credenciales.

## Consecuencias

- `prisma.config.ts`/`env.ts` cargan y validan ambas variables.
- El `secret` de servicio de Supabase solo se usa del lado servidor y nunca se
  expone a clientes.
- Se documenta `DIRECT_URL` en `.env.example` y `docs/DEVELOPMENT.md`.
