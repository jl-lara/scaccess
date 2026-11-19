# Sistema de Control de Acceso (Accesa / SCAccess)

Monorepo del Sistema de Control de Acceso: control de acceso de empleados a areas de una instalacion mediante tarjetas RFID, historial auditable de eventos y sincronizacion con controladores fisicos.

Proyecto academico de Ingenieria en Desarrollo y Gestión de Software de la Universidad Tecnologica de Tijuana.

## Arquitectura general

- **Backend (`apps/api`):** monolito modular con Node.js, Express 5, TypeScript 5.9 y Zod. Unica capa con acceso directo a la base de datos.
- **Base de datos y autenticacion:** PostgreSQL en Supabase administrado con Prisma 7 (`prisma-client` + `@prisma/adapter-pg`, politicas RLS e indices) y **Supabase Auth**.
- **Web administrativa (`apps/admin`):** consola minimalista **Accesa** en React 19 + Vite 6 + TypeScript (requiere Internet).
- **App movil (`apps/mobile`):** aplicacion para empleados **Accesa Móvil** en React Native + Expo (requiere Internet) para consultar su historial y detalle de eventos propios.
- **Contratos compartidos (`packages/shared`):** tipos y constantes comunes (`@scaccess/shared`), sin logica de negocio.
- **API REST/JSON y OpenAPI:** rutas versionadas bajo `/api/v1`, especificacion en `/api/v1/openapi.json` y documentacion interactiva en `/api/v1/docs`.
- **Controlador ESP32-S3 + RC522:** contratos de sincronizacion offline-first implementados en el backend (`sync` y `events/sync`); firmware en desarrollo por separado.

Detalle completo en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requisitos del entorno

- Node.js >= 22.12 (ver `.nvmrc`).
- npm >= 10.
- Git >= 2.40.
- PostgreSQL/Supabase solo si vas a ejecutar tareas de base de datos o migraciones; la API puede arrancar, responder `/api/v1/health`, compilar y pasar pruebas sin credenciales reales.

## Instalacion

```bash
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run prisma:generate
```

Edita `.env` con tus valores reales cuando necesites conectar la base de datos. Los archivos `.env` estan ignorados por Git.

## Ejecucion rapida

```bash
npm run dev                                  # API en desarrollo (http://localhost:3000)
npm run dev:admin                            # Web administrativa Accesa (http://localhost:5173)
npm run start --workspace @scaccess/mobile   # App movil Expo
npm run build                                # Compila shared, api, admin y verifica mobile
```

Prueba rapida de salud de la API:

```bash
curl http://localhost:3000/api/v1/health
```

## Estructura de carpetas

```text
scaccess/
├── apps/
│   ├── api/                    Backend Express 5 + Prisma 7 + OpenAPI 3.1
│   ├── admin/                  Consola web administrativa Accesa (React + Vite)
│   └── mobile/                 App movil para empleados (Expo + React Native)
├── packages/
│   └── shared/                 Contratos y constantes compartidas (@scaccess/shared)
├── docs/
│   ├── ARCHITECTURE.md         Arquitectura y limites del monolito modular
│   ├── API-CONTRACTS.md        Contratos HTTP /api/v1 y sincronizacion offline
│   ├── DATABASE.md             Modelo relacional, indices y politicas RLS
│   ├── DEVELOPMENT.md          Variables de entorno, pruebas y despliegue Docker
│   ├── QA-TEST-DATA.md         Catalogo de datos y cuentas QA
│   └── adr/                    Registros de decisiones arquitectonicas (ADR-0001..0013)
├── logo/                       Activos originales de marca Accesa
├── .github/workflows/ci.yml    Pipeline CI (lint, typecheck, test y build)
├── Dockerfile                  Imagen Docker multi-etapa del backend
├── docker-compose.yml          Ejecucion local contenerizada de la API
├── render.yaml                 Blueprint de despliegue en Render
├── AGENTS.md                   Reglas permanentes del repositorio
└── package.json                Configuracion del monorepo (npm workspaces)
```

## Comandos disponibles

| Comando | Descripcion |
| --- | --- |
| `npm run dev` | API en modo desarrollo (`tsx watch`) |
| `npm run dev:admin` | Web administrativa en modo desarrollo (`vite`) |
| `npm run start --workspace @scaccess/mobile` | Servidor Expo de la app movil |
| `npm run lint` | ESLint sobre todo el repositorio |
| `npm run typecheck` | Verificacion de tipos TypeScript por workspace |
| `npm test` | Compila `@scaccess/shared` (`pretest`) y ejecuta Vitest en `api`, `admin` y `mobile` |
| `npm run build` | Compila/verifica todos los workspaces |
| `npm run prisma:generate` | Genera el cliente Prisma |
| `npm run prisma:migrate` | Ejecuta migraciones en desarrollo (requiere base de datos) |
| `npm run prisma:studio` | Abre Prisma Studio (requiere base de datos) |
| `npm run docker:build` | Construye la imagen Docker `scaccess-api:latest` |
| `npm run docker:up` | Levanta la API con Docker Compose |

## Estado actual

- **Implementado y probado:** backend modular (`/api/v1`, OpenAPI, RLS, autenticacion de dispositivos, Docker/Render), consola web administrativa Accesa (`apps/admin`) y app movil para empleados (`apps/mobile`).
- **Pendiente:** firmware del controlador fisico ESP32-S3 + lector RC522 e integracion opcional de pruebas E2E Selenium en CI.

## Documentacion

- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos](docs/DATABASE.md)
- [Contratos de API](docs/API-CONTRACTS.md)
- [Guia de desarrollo y despliegue](docs/DEVELOPMENT.md)
- [Datos de prueba QA](docs/QA-TEST-DATA.md)
- [Decisiones arquitectonicas](docs/adr/README.md)
- [Web administrativa (`apps/admin`)](apps/admin/README.md)
- [App movil (`apps/mobile`)](apps/mobile/README.md)
- [Contratos compartidos (`packages/shared`)](packages/shared/README.md)
- [Instrucciones para agentes](AGENTS.md)
