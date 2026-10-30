# Guia de desarrollo

## Requisitos

- Node.js >= 22.12 (probado con 22.18.0; ver `.nvmrc`).
- npm >= 10 (probado con 10.9.3).
- Git.
- PostgreSQL/Supabase solo si vas a trabajar con la base de datos.

## Primeros pasos

```bash
npm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
npm run prisma:generate
```

`.env` vive en la raiz del monorepo y esta ignorado por Git. La API lo carga
explicitamente (Prisma 7 no lo hace por si solo).

## Variables de entorno

| Variable | Obligatoria | Descripcion |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test` o `production` (default `development`) |
| `PORT` | No | Puerto HTTP (default `3000`) |
| `CORS_ORIGIN` | No | Origenes permitidos separados por coma, o `*` |
| `DATABASE_URL` | Solo para BD | Cadena de conexion PostgreSQL/Supabase |
| `SUPABASE_URL` | No (aun) | URL del proyecto Supabase (auth futuro) |
| `SUPABASE_ANON_KEY` | No (aun) | Clave publica de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | No (aun) | Clave de servicio; solo servidor, nunca en clientes |

La configuracion se valida con Zod al arrancar. Si un valor es invalido, el
proceso falla con un mensaje que indica la variable.

## Comandos

```bash
npm run dev                 # API con recarga (tsx watch)
npm run build               # compila todos los workspaces
npm run typecheck           # tsc --noEmit por workspace
npm run lint                # ESLint (flat config en la raiz)
npm test                    # Vitest + Supertest
npm run test:watch          # Vitest en watch
npm run prisma:generate     # genera el cliente Prisma
npm run prisma:migrate      # migraciones (solo con modelo aprobado)
npm run prisma:studio       # interfaz de Prisma (requiere BD)
```

Desde un workspace:

```bash
npm run dev --workspace @scaccess/api
npm test --workspace @scaccess/api
```

## Base de datos

1. Crear un proyecto en Supabase (o usar un PostgreSQL local).
2. Copiar la cadena de conexion a `DATABASE_URL` en `.env`.
3. El esquema actual no tiene modelos: el modelo esta pendiente de aprobacion.
4. No ejecutar migraciones contra una base real hasta que el modelo sea
   aprobado. Ver [DATABASE.md](DATABASE.md).

## Pruebas

- Framework: Vitest + Supertest.
- Las pruebas de salud no requieren base de datos ni credenciales.
- Ubicacion: `apps/api/tests/*.test.ts`.
- Una prueba debe poder ejecutarse con `npm test` desde la raiz.

## Calidad

- TypeScript estricto (`strict`, `noUncheckedIndexedAccess`,
  `noUnusedLocals`, `noUnusedParameters`).
- ESLint 10 con `typescript-eslint` 8.
- Codigo tipado; evitar `any` sin justificacion.
- Identificadores en ingles; textos de interfaz en espanol.

## Flujo Git

- `main`: rama estable. Solo recibe la base inicial y merges aprobados.
- `feat/backend-foundation`: rama de trabajo del backend.
- No desarrollar directamente sobre `main`.
- No hacer merge automatico ni `force push`.
- No publicar cambios sin verificar lint, typecheck, test y build.

## Solucion de problemas

- **`DATABASE_URL is not configured` al usar Prisma:** configura `.env` en la
  raiz. El endpoint de salud no requiere esta variable.
- **El cliente Prisma no existe:** ejecuta `npm run prisma:generate`.
- **CORS bloquea la web:** agrega el origen de Vite a `CORS_ORIGIN`
  (por defecto `http://localhost:5173`).
- **Puerto ocupado:** cambia `PORT` en `.env`.
