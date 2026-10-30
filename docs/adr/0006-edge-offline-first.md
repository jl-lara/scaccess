# ADR-0006: Offline-first solo en el controlador fisico

- **Estado:** Aprobado
- **Fecha:** 2026-10-29

## Contexto

El requisito diferenciador es que el control de acceso fisico siga funcionando
sin Internet. La web y la app movil no tienen ese requisito.

## Decision

- Solo el **ESP32-S3 + RC522** opera offline-first.
- El dispositivo descarga empleados, tarjetas, permisos y configuracion, los
  conserva localmente y valida sin conexion.
- Los eventos se almacenan localmente y se sincronizan al recuperar Internet.
- La web administrativa y la app movil requieren Internet; no se implementa
  cache offline para ellas.
- El backend contempla desde el diseno los contratos de sincronizacion, aunque
  el firmware se desarrolle despues.

## Motivos

- Evita complejidad innecesaria en los clientes.
- Mantiene el foco del requisito diferencial en el hardware.

## Consecuencias

- Se necesita idempotencia de eventos y dos marcas de tiempo
  (`occurred_at` / `received_at`).
- Se debe modelar el estado de sincronizacion por dispositivo.
- No se simulara una integracion fisica real como si existiera.
