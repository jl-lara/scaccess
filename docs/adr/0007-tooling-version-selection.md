# ADR-0007: Seleccion de versiones de TypeScript y Prisma

- **Estado:** Propuesto (requiere confirmacion del lider tecnico)
- **Fecha:** 2026-10-29

## Problema encontrado

Al consultar el registro de npm (2026-10-29):

- `typescript@latest` es **7.0.2**, pero `typescript-eslint@8.72.1` declara
  compatibilidad con `typescript >=4.8.4 <6.1.0`.
- `prisma@latest` es **8.0.0-rc.28**, una version candidata (pre-release). La
  version estable publicada es **7.10.1** (`@prisma/client@latest` = 7.10.1).

## Decision propuesta

- Fijar **TypeScript 5.9.3** (ultima estable de la linea 5.x) para mantener
  lint y tooling soportados.
- Fijar **Prisma 7.10.1** (CLI, cliente y `@prisma/adapter-pg`) hasta que
  Prisma 8 tenga una version estable.
- Node.js 22 LTS (probado con 22.18.0).

## Alternativas

### TypeScript 7

- Ventajas: compilador nativo, mas rapido.
- Desventajas: `typescript-eslint` aun no lo soporta; riesgo de friccion en
  lint, Vitest y configuracion.
- Impacto: habria que desactivar o degradar el lint tipado.

### Prisma 8 RC

- Ventajas: linea nueva, funciones recientes.
- Desventajas: pre-release; cambios incompatibles en configuracion, migraciones
  y cliente; no apto para una base que debe ser reproducible.
- Impacto: mayor riesgo de retrabajo.

## Consecuencias

- El proyecto usa versiones estables y verificadas.
- Se revisara la actualizacion a TypeScript 7 y Prisma 8 cuando el ecosistema y
  una version estable lo permitan.
- Cambiar estas versiones requiere aprobacion segun las reglas de trabajo.
