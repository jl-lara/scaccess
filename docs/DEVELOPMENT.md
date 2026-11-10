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
| `DATABASE_URL` | Solo para BD | Cadena de conexion PostgreSQL/Supabase (solo `postgres://` o `postgresql://`) |
| `DIRECT_URL` | No | Conexion directa (sin pooler) para migraciones; misma base que `DATABASE_URL` |
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
2. Copiar la cadena de conexion a `DATABASE_URL` en `.env`. Para migraciones
   puedes definir tambien `DIRECT_URL` (conexion directa sin pooler).
3. El modelo de datos ya esta aprobado y definido en
   `apps/api/prisma/schema.prisma`.
4. No ejecutar migraciones contra una base real hasta conectar la instancia de
   desarrollo. Ver [DATABASE.md](DATABASE.md).

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

## Contenedores Docker

El backend se empaqueta en una imagen Docker multi-etapa (`Dockerfile`) basada
en `node:22-alpine`, junto con el workspace `@scaccess/shared`. La imagen se
ejecuta con el usuario no-root `node`, expone el puerto `3000` y define un
`HEALTHCHECK` contra `/api/v1/health` (ver
[ADR-0013](adr/0013-docker-containerization.md)).

### Requisitos

- Docker Desktop (Windows/macOS) o Docker Engine + Docker Compose v2 (Linux).
- Verificar la instalacion:

  ```bash
  docker --version
  docker compose version
  ```

### Construccion de la imagen

```bash
npm run docker:build
```

Equivale a ejecutar desde la raiz del monorepo:

```bash
docker build -t scaccess-api:latest .
```

El build instala dependencias (incluidas las de desarrollo), genera el cliente
Prisma, compila `@scaccess/shared` y `@scaccess/api`, y descarta las
dependencias de desarrollo en la etapa final.

### Ejecucion con Docker Compose

```bash
npm run docker:up      # construye la imagen y levanta el servicio
npm run docker:logs    # sigue los logs del servicio api
npm run docker:down    # detiene y elimina el contenedor
```

El servicio queda disponible en `http://localhost:3000`. `docker-compose.yml`
toma las variables desde `.env` en la raiz si el archivo existe (no se
versiona); la API puede arrancar sin `DATABASE_URL` y responder el health
check.

### Ejecucion directa con docker run

```bash
docker run --rm -p 3000:3000 --env-file .env scaccess-api:latest
```

Si `.env` no existe, crealo a partir de `.env.example`. Verifica el servicio:

```bash
curl http://localhost:3000/api/v1/health
```

En PowerShell: `Invoke-RestMethod http://localhost:3000/api/v1/health`.

## Flujo Git

- `main`: rama estable. Solo recibe la base inicial y merges aprobados.
- `feat/backend-foundation`: rama de trabajo del backend.
- No desarrollar directamente sobre `main`.
- No hacer merge automatico ni `force push`.
- No publicar cambios sin verificar lint, typecheck, test y build.

## Remoto GitHub

Al inicializar la mision 01 no habia ningun remoto configurado. Cuando el
lider tecnico proporcione la URL del repositorio:

```bash
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin main
git push -u origin feat/backend-foundation
```

Reglas: no reemplazar un remoto existente sin autorizacion, no usar
`--force` y no sobrescribir ramas remotas.

## Despliegue en Render (Plan Gratuito)

El backend se despliega como un servicio web de Render en un **contenedor
Docker** (`runtime: docker`, `plan: free`). Render construye la imagen con el
`Dockerfile` multi-etapa de la raiz (`node:22-alpine`) y arranca el proceso con
el `CMD` definido en la imagen. El repositorio incluye `render.yaml` en la raiz
para crear el servicio con Blueprint.

Con `runtime: docker` no se configuran `buildCommand`, `startCommand` ni
`NODE_VERSION`: el `Dockerfile` controla la version de Node, el build
multi-etapa y el comando de arranque.

### Opcion A: Blueprint (`render.yaml`)

1. En Render, elige **New > Blueprint** y conecta el repositorio de GitHub.
2. Render detecta `render.yaml` y muestra el servicio `scaccess-api` con
   `runtime: docker`, `dockerfilePath: ./Dockerfile`, `dockerContext: .` y el
   health check ya definidos.
3. Completa las variables marcadas con `sync: false` (ver la tabla siguiente) y
   aplica el Blueprint.
4. Espera el primer build de la imagen y verifica
   `https://<servicio>.onrender.com/api/v1/health`.

Cada push a la rama configurada vuelve a construir y desplegar la imagen
automaticamente.

### Opcion B: configuracion manual

En Render elige **New > Web Service**, conecta el repositorio y configura la
alternativa Docker (recomendada):

| Campo | Valor |
| --- | --- |
| Name | `scaccess-api` |
| Language / Runtime | Docker |
| Region | la mas cercana (por ejemplo, Oregon) |
| Branch | la rama que se despliega |
| Root Directory | vacio (la raiz del monorepo) |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory | `.` |
| Health Check Path | `/api/v1/health` |
| Instance Type | Free |

`Root Directory` debe quedar vacio porque el `Dockerfile` y el contexto de
build viven en la raiz del monorepo (npm workspaces). La imagen incluye
`apps/api` y `@scaccess/shared`; no hace falta configurar comandos de build ni
de start.

Si prefieres no usar Docker, la alternativa Node sigue disponible: elige
**Language / Runtime: Node** y configura:

| Campo | Valor |
| --- | --- |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/v1/health` |
| Instance Type | Free |

En ese caso define `NODE_VERSION` como `22.18.0`. `npm start` delega en
`@scaccess/api`, que ejecuta `node dist/server.js`; el build genera el cliente
de Prisma (`prebuild`) y compila TypeScript con `tsc`. Esta alternativa no usa
el mismo artefacto que Docker, por lo que la opcion recomendada es el
contenedor.

### Variables de entorno

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` (definido en `render.yaml`; la API lee `process.env.PORT`) |
| `CORS_ORIGIN` | Origen de la web administrativa separado por comas; usar `*` solo en pruebas |
| `DATABASE_URL` | Supavisor Pooler, modo transaccion, puerto `6543` (ver abajo) |
| `DIRECT_URL` | Supavisor Pooler, modo sesion, puerto `5432` (ver abajo) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave publica (`anon`) de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio; solo servidor, nunca en clientes |

La version de Node la fija la imagen base `node:22-alpine`; con
`runtime: docker` no se usa `NODE_VERSION`.

### Conexion a Supabase desde Render (Supavisor / IPv4)

En Supabase abre **Connect > Connection Pooling (Supavisor)** y usa el host
`aws-0-<region>.pooler.supabase.com`. En Render Free se debe usar el **pooler**
para ambas variables porque los contenedores salen por IPv4 y el host directo
`db.<ref>.supabase.co` solo resuelve a IPv6 en el plan gratuito de Supabase: una
conexion directa desde Render falla.

- `DATABASE_URL` (runtime, modo transaccion, puerto `6543`):

  ```text
  postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```

- `DIRECT_URL` (migraciones, modo sesion, puerto `5432`):

  ```text
  postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
  ```

El puerto `5432` del pooler corresponde al modo sesion, no al host directo; sigue
siendo IPv4. `DIRECT_URL` se usa solo para `prisma migrate` (ver
`apps/api/prisma.config.ts`). Si la contrasena contiene caracteres especiales,
codificalos con URL encoding.

Las migraciones no se ejecutan solas en el plan gratuito (los pre-deploy
commands no estan disponibles) y la imagen de runtime no incluye la CLI de
Prisma. Aplicarlas manualmente en local con `DIRECT_URL` apuntando a Supabase:

```bash
npm run prisma:migrate:deploy
```

### Mitigacion de cold starts

Render Free suspende el servicio tras 15 minutos sin trafico; la primera
peticion despues de la suspension tarda en responder (cold start). Para demos
academicas:

- Despertar el servicio con `GET /api/v1/health` unos minutos antes de la demo.
- Usar un monitor externo (UptimeRobot, cron-job.org, etc.) que haga ping al
  health check cada 10-14 minutos. El endpoint no consulta la base de datos, asi
  que mantiene el proceso caliente sin gastar consultas.

El controlador fisico ESP32-S3 opera offline-first: antes de sincronizar debe
hacer un `GET /api/v1/health` con timeout corto y reintentos con backoff; si no
responde, conserva los eventos en la cola local y reintenta despues. El
controlador no debe perder eventos por un cold start ni bloquear la validacion
offline.

## Solucion de problemas

- **`DATABASE_URL is not configured` al usar Prisma:** configura `.env` en la
  raiz. El endpoint de salud no requiere esta variable.
- **El cliente Prisma no existe:** ejecuta `npm run prisma:generate`.
- **CORS bloquea la web:** agrega el origen de Vite a `CORS_ORIGIN`
  (por defecto `http://localhost:5173`).
- **Puerto ocupado:** cambia `PORT` en `.env`.
