# ADR-0009: Autenticacion de dispositivos fisicos

- **Estado:** Aprobado
- **Fecha:** 2026-11-03

## Contexto

El controlador ESP32-S3 sincroniza empleados/tarjetas y sube eventos. Sin una
identidad de dispositivo, cualquiera podria descargar datos o inyectar eventos
falsos. Se requiere un mecanismo simple, revocable y compatible con hardware
restringido.

## Decision

Se autentica cada controlador con un **token opaco por dispositivo** enviado en
la cabecera `Authorization: Bearer <tokenId>.<secret>`.

- `token_id` es el identificador publico y unico del token (`varchar(64)`).
- `secret` es la parte secreta, generada con entropia suficiente y nunca
  almacenada en texto plano: en base solo se guarda `secret_hash`
  (Argon2id/bcrypt).
- El par `(token_id, secret_hash)` vive en `device_credentials`, relacionado
  con `access_devices`.
- Cada credencial soporta `expires_at` y `revoked_at` para **rotacion,
  expiracion y revocacion** sin reprovisionar el hardware; `last_used_at`
  registra el ultimo uso.

## Motivos

- No expone secretos en reposo (solo `secret_hash`).
- Permite revocar un dispositivo comprometido sin tocar el firmware ni el
  resto de credenciales.
- Encaja con el hardware limitado del ESP32-S3 (no requiere mTLS ni PKI).

## Consecuencias

- El token se transmite solo por TLS; el transporte debe usar HTTPS.
- Se contempla mTLS como evolucion para produccion, sin descartar la rotacion
  de credenciales.
- La comparacion de secretos debe usar comparacion en tiempo constante.
