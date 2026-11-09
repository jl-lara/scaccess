# Registros de decisiones arquitectonicas (ADR)

Los estados se clasifican en:

- **Aprobado:** decision confirmada por el lider tecnico.
- **Propuesto:** decision tomada por el agente de implementacion que requiere
  revision/aprobacion.

| ADR | Decision | Estado |
| --- | --- | --- |
| [0001](0001-monorepo-npm-workspaces.md) | Monorepo con npm workspaces | Aprobado |
| [0002](0002-backend-express-typescript.md) | Backend Node.js + Express + TypeScript | Aprobado |
| [0003](0003-postgres-supabase-prisma.md) | Supabase PostgreSQL + Prisma | Aprobado |
| [0004](0004-supabase-auth.md) | Supabase Auth | Aprobado |
| [0005](0005-rest-openapi.md) | API REST/JSON + OpenAPI | Aprobado |
| [0006](0006-edge-offline-first.md) | Offline-first solo en el controlador fisico | Aprobado |
| [0007](0007-tooling-version-selection.md) | Versiones de TypeScript y Prisma | Aprobado |
| [0008](0008-data-model-and-integrity.md) | Modelo de datos e integridad (12 tablas, 6 enums) | Aprobado |
| [0009](0009-device-authentication.md) | Autenticacion de dispositivos por token opaco | Aprobado |
| [0010](0010-offline-sync-and-idempotency.md) | Sincronizacion offline e idempotencia de eventos | Aprobado |
| [0011](0011-supabase-connection-and-rls.md) | Conexion a Supabase (DATABASE_URL/DIRECT_URL) y RLS | Aprobado |
| [0012](0012-admin-roles-and-permissions.md) | RBAC administrativo (roles + user_roles) | Aprobado |
| [0013](0013-docker-containerization.md) | Empaquetado y despliegue con Docker | Aprobado |

## Decisiones pendientes

- Adopcion de TypeScript 7 / Prisma 8 cuando sean estables y compatibles
  (revision periodica, ver ADR-0007).
- Parametrizacion de la ventana de revocacion offline y de la antiguedad maxima
  de configuracion (ver ADR-0010) antes de produccion.
