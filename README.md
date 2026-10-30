# Sistema de Control de Acceso

Monorepo del Sistema de Control de Acceso: control de acceso de empleados a
areas de una instalacion mediante tarjetas RFID, con historial de eventos y
sincronizacion de dispositivos.

Proyecto academico de Ingenieria en Desarrollo y Gestion de Software de la
Universidad Tecnologica de Tijuana.

## Arquitectura general

- **Monolito modular** en el backend (Node.js + Express + TypeScript).
- **PostgreSQL en Supabase** como base de datos, administrada con **Prisma**.
- **Supabase Auth** para autenticacion (integracion pendiente).
- **Web administrativa** con React + Vite + TypeScript (pendiente).
- **App movil** con React Native + Expo (pendiente).
- **API REST/JSON** versionada en `/api/v1`, documentada con OpenAPI (pendiente).
- **Controlador ESP32-S3 + RC522** que opera offline y sincroniza eventos
  cuando recupera Internet (firmware pendiente).

Detalle completo en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requisitos del entorno

- Node.js >= 22.12 (probado con 22.18.0).
- npm >= 10 (probado con 10.9.3).
- Git >= 2.40 (probado con 2.51.0).
- PostgreSQL accesible (local o Supabase) solo para tareas de base de datos.

Esta mision no necesita credenciales reales para instalar, compilar ni probar
la API: el endpoint de salud no toca la base de datos.

## Instalacion

```bash
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run prisma:generate
```

Edita `.env` con tus valores reales. El archivo `.env` esta ignorado por Git.

## Ejecucion

```bash
npm run dev          # API en modo desarrollo (tsx watch)
npm run build        # compila API y paquetes
npm start --workspace @scaccess/api
```

La API escucha por defecto en `http://localhost:3000`.

Prueba rapida:

```bash
curl http://localhost:3000/api/v1/health
```

## Estructura de carpetas

```text
access-control-system/          (raiz del repositorio actual)
├── apps/
│   ├── api/                    Backend Express + TypeScript (implementado)
│   │   ├── prisma/             Esquema Prisma (modelo pendiente)
│   │   ├── src/
│   │   │   ├── config/         Validacion de entorno y cliente Prisma
│   │   │   ├── middleware/     Manejo de errores y 404
│   │   │   ├── modules/        Modulos de negocio (health por ahora)
│   │   │   ├── routes/         Enrutamiento versionado
│   │   │   ├── utils/          Utilidades (ApiError)
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   └── tests/              Pruebas con Vitest + Supertest
│   ├── admin/                  Reservado: web administrativa (README)
│   └── mobile/                 Reservado: app movil (README)
├── packages/
│   └── shared/                 Contratos compartidos (tipos, sin runtime)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API-CONTRACTS.md
│   ├── DEVELOPMENT.md
│   └── adr/                    Registros de decisiones arquitectonicas
├── .github/workflows/ci.yml
├── .editorconfig
├── .env.example
├── .gitignore
├── AGENTS.md
├── eslint.config.mjs
└── package.json
```

## Comandos disponibles

| Comando | Descripcion |
| --- | --- |
| `npm run dev` | API en modo desarrollo con recarga |
| `npm run build` | Compila todos los workspaces |
| `npm test` | Ejecuta las pruebas de todos los workspaces |
| `npm run test:watch` | Pruebas de la API en modo watch |
| `npm run lint` | ESLint sobre el repositorio |
| `npm run typecheck` | Verificacion de tipos de todos los workspaces |
| `npm run prisma:generate` | Genera el cliente Prisma |
| `npm run prisma:migrate` | Migraciones de desarrollo (requiere base de datos aprobada) |
| `npm run prisma:studio` | Prisma Studio (requiere base de datos) |

## Estado actual del desarrollo

Mision 01 (inicializacion) completada:

- Monorepo con npm workspaces.
- API Express + TypeScript con validacion de entorno, middleware de errores,
  rutas `/api/v1`, endpoint de salud y pruebas.
- Prisma configurado (sin modelos ni migraciones ejecutadas).
- Documentacion inicial y ADRs.
- CI basico para lint, typecheck, test y build.

**No implementado todavia:** CRUD, autenticacion, dashboard, app movil,
firmware del ESP32-S3 y sincronizacion real de dispositivos.

## Documentacion

- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos](docs/DATABASE.md)
- [Contratos de API](docs/API-CONTRACTS.md)
- [Desarrollo](docs/DEVELOPMENT.md)
- [Decisiones arquitectonicas](docs/adr/README.md)
- [Instrucciones para agentes](AGENTS.md)
