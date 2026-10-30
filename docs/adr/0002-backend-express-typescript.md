# ADR-0002: Backend Node.js + Express + TypeScript

- **Estado:** Aprobado
- **Fecha:** 2026-10-29

## Contexto

Se necesita una API REST/JSON mantenible, tipada y facil de desplegar para un
proyecto academico.

## Decision

- Node.js + Express 5.
- TypeScript en modo estricto.
- Arquitectura de monolito modular: un proceso, modulos por dominio.
- Validacion de entrada con Zod.
- Pruebas con Vitest + Supertest.

## Motivos

- Express es minimo, conocido y suficiente para el alcance.
- TypeScript mejora la seguridad de tipos y el trabajo en equipo.
- El monolito modular evita la complejidad operativa de microservicios.

## Consecuencias

- Un unico despliegue de API.
- Los modulos se comunican mediante servicios internos, no por red.
- La documentacion OpenAPI se generara a partir de los contratos (ver
  ADR-0005).
