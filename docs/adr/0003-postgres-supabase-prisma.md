# ADR-0003: Supabase PostgreSQL + Prisma

- **Estado:** Aprobado
- **Fecha:** 2026-10-29

## Contexto

Se requiere una base relacional administrada, con acceso desde el backend y
posibilidad de integrarse con autenticacion.

## Decision

- Base de datos: **PostgreSQL** alojado en **Supabase**.
- ORM: **Prisma 7** con generador `prisma-client` y driver adapter
  `@prisma/adapter-pg` (paquete `pg`).
- La cadena de conexion se configura en `DATABASE_URL` (raiz, `.env` ignorado).
- El cliente Prisma se crea de forma perezosa para permitir arrancar la API sin
  credenciales.

## Motivos

- PostgreSQL es el motor soportado por Supabase y encaja con el modelo
  relacional del proyecto.
- Prisma aporta esquema tipado, migraciones y cliente generado.
- El driver adapter `pg` es el flujo recomendado en Prisma 7 para PostgreSQL.

## Consecuencias

- Las migraciones se ejecutaran solo cuando el modelo este aprobado.
- No se versionan credenciales.
- Prisma 7 no carga `.env` automaticamente: se carga de forma explicita desde
  `prisma.config.ts` y `src/config/env.ts`.
