# ADR-0010: Sincronizacion offline e idempotencia

- **Estado:** Aprobado
- **Fecha:** 2026-11-03

## Contexto

El dispositivo opera offline y luego sincroniza configuracion y eventos. Se
necesita detectar cambios de configuracion, evitar duplicados de eventos y
distinguir el momento del evento del de su recepcion.

## Decision

Se aprueba el siguiente flujo de sincronizacion:

1. **Versionado de configuracion:** contador monotono `config_version`
   (`bigint`) gestionado por el servidor y presente en `access_devices`. El
   dispositivo descarga la configuracion con su `checksum` y la aplica de forma
   atomica.
2. **Idempotencia de eventos:** `UNIQUE (device_id, client_event_id)` en
   `access_events`; un reintento no duplica el evento. `device_epoch` (`uuid`)
   identifica la epoca de aprovisionamiento y evita colisiones de ids tras un
   reset/reaprovisionamiento.
3. **Dos tiempos estrictos:** `occurred_at` (reloj del dispositivo) y
   `received_at` (reloj del servidor, default `now()`); nunca se confunden.
4. **Confirmacion granular por evento:** la respuesta de subida clasifica cada
   evento como `accepted`, `duplicated` o `rejected` (con motivo).
5. **Politica offline de disponibilidad:** el dispositivo sigue operando con la
   ultima configuracion aunque este obsoleta, y **alerta** (marca el evento)
   cuando la configuracion supera una antiguedad maxima. La denegacion por
   configuracion obsoleta queda como opcion de seguridad a evaluar en
   produccion.

## Motivos

- La restriccion unica en base (no solo en codigo) es la unica garantia real de
  idempotencia ante reintentos concurrentes.
- Separar `occurred_at` de `received_at` permite auditar la deriva de reloj del
  dispositivo.
- La confirmacion por evento permite acuses parciales y evita reenviar lotes
  completos.

## Consecuencias

- El servidor inserta con `ON CONFLICT (device_id, client_event_id) DO NOTHING`
  y clasifica el resultado.
- La politica de antiguedad maxima y la ventana de revocacion offline deben
  parametrizarse antes de produccion.
- `device_sequence` (opcional) aporta diagnostico de orden local del
  dispositivo.
