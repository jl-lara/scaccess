# @scaccess/shared

Paquete reservado para los contratos y utilidades compartidas entre la API, la
web administrativa y la aplicacion movil.

## Proposito

Evitar duplicar tipos de request/response, enums de dominio y constantes de la
API en cada cliente.

## Estado actual

- Contiene los tipos iniciales de salud de la API y de los contratos de
  sincronizacion de dispositivos.
- Todavia **no** es consumido por `apps/api`; se adoptara cuando se
  implementen los endpoints de sincronizacion.
- No incluye logica de negocio ni dependencias de runtime.

## Comandos

```bash
npm run build --workspace @scaccess/shared
npm run typecheck --workspace @scaccess/shared
```
