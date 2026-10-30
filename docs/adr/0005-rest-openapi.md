# ADR-0005: API REST/JSON con OpenAPI

- **Estado:** Aprobado
- **Fecha:** 2026-10-29

## Contexto

Dos clientes distintos consumiran la API y el equipo necesita un contrato
claro y verificable.

## Decision

- API **REST/JSON** versionada bajo `/api/v1`.
- Documentacion con **OpenAPI/Swagger**.
- Validacion de request/response con Zod en el backend.
- Errores uniformes con `code`, `message` y `details` opcionales.

## Estado

- Implementado: estructura de rutas versionadas y endpoint de salud.
- Pendiente: especificacion OpenAPI, generacion de documentacion y endpoints
  de negocio.

## Consecuencias

- Los contratos se documentan antes de implementar cada modulo.
- Los clientes usan el paquete `@scaccess/shared` para tipos compartidos.
