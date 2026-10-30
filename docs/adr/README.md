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
| [0007](0007-tooling-version-selection.md) | Versiones de TypeScript y Prisma | Propuesto |

## Decisiones aun sin ADR

- Modelo de datos definitivo (ver [../DATABASE.md](../DATABASE.md)).
- Mecanismo de autenticacion de dispositivos fisicos.
- Estrategia de versionado de sincronizacion.
- Modelo de roles y permisos administrativos.
- Politicas de Row Level Security en Supabase.
