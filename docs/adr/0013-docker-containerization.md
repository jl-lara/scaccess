# ADR-0013: Empaquetado y despliegue con Docker

- **Estado:** Aprobado
- **Fecha:** 2026-11-09

## Contexto

El backend se ejecutaba directamente sobre el runtime Node de Render y, en
local, con `npm run dev`. Aunque el monorepo fija la version de Node en
`.nvmrc`, el entorno real dependia de las herramientas instaladas en cada
maquina y de los comandos de build configurados en el proveedor. Eso deja
abierta la posibilidad de diferencias entre desarrollo y produccion
(dependencias del sistema, version de Node, pasos de build) y complica
reproducir un fallo.

El backend es un monolito modular (`apps/api`) que depende del workspace
`@scaccess/shared`; cualquier artefacto desplegable debe incluir ambos. Se
busca un unico artefacto inmutable que se ejecute igual en local y en Render,
sin introducir microservicios, Kubernetes ni infraestructura adicional.

## Decision

Se aprueba empaquetar `apps/api` y su dependencia de workspace
`@scaccess/shared` en una **imagen Docker multi-etapa** basada en
`node:22-alpine`:

- **Etapa de build:** instala las dependencias del monorepo (incluidas las de
  desarrollo), genera el cliente Prisma y compila TypeScript.
- **Etapa de runtime:** parte de `node:22-alpine`, copia solo los artefactos
  necesarios (codigo compilado, dependencias de produccion y cliente Prisma
  generado) y ejecuta el proceso con el usuario no-root `node`.
- La imagen expone el puerto `3000` y define un `HEALTHCHECK` contra
  `GET /api/v1/health`, endpoint que no requiere base de datos.
- Los secretos no se incluyen en la imagen: se inyectan como variables de
  entorno (`DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGIN`, `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- La orquestacion local usa `docker-compose.yml`, que construye la imagen
  `scaccess-api:latest` y publica el puerto `3000`.
- El despliegue en Render usa `runtime: docker` con
  `dockerfilePath: ./Dockerfile`, `dockerContext: .` y
  `healthCheckPath: /api/v1/health` (ver `render.yaml`). La version de Node, el
  build multi-etapa y el comando de arranque los controla el `Dockerfile`; no
  se usan `buildCommand`, `startCommand` ni `NODE_VERSION` del proveedor.

## Motivos

- Un unico artefacto reproducible elimina las diferencias entre el entorno de
  desarrollo y el de produccion: la misma imagen que se prueba en local es la
  que Render construye y ejecuta.
- `node:22-alpine` fija la version de Node desde el repositorio y alinea la
  imagen con `.nvmrc` y los `engines` del monorepo, sin depender de la
  configuracion del proveedor.
- Ejecutar como usuario no-root `node` y declarar un `HEALTHCHECK` son practicas
  basicas de seguridad y operacion que Render y Docker Compose pueden
  aprovechar.
- Docker Compose simplifica las pruebas locales del artefacto completo
  (incluido el health check) sin instalar Node en la maquina.
- Render soporta `runtime: docker`, por lo que no hace falta cambiar de
  proveedor ni agregar piezas de orquestacion.

## Consecuencias

- `render.yaml` deja de definir `buildCommand`, `startCommand` y
  `NODE_VERSION`: el `Dockerfile` es la unica fuente de verdad del build y del
  arranque.
- Docker Desktop (Windows/macOS) o Docker Engine + Docker Compose v2
  (Linux) pasan a ser requisitos para probar el contenedor en local. Se
  documenta en `docs/DEVELOPMENT.md`.
- Cambios en dependencias, en `apps/api` o en `packages/shared` requieren
  reconstruir la imagen (`npm run docker:build` o `docker build`).
- Las migraciones de Prisma no se ejecutan al arrancar el contenedor; se
  siguen aplicando manualmente porque el plan gratuito no ofrece pre-deploy
  commands. La CLI de Prisma no forma parte de la imagen de runtime.
- `docker-compose.yml` es solo para desarrollo local; en produccion Render
  ejecuta un unico servicio a partir de la imagen.
- Se mantiene un solo servicio de backend desplegable: sin microservicios, sin
  Kubernetes y sin colas distribuidas.

## Alternativas consideradas

- **Mantener `runtime: node` en Render:** funciona, pero el build y el arranque
  dependen de comandos del proveedor y de la version de Node configurada alli;
  no garantiza que local y produccion usen el mismo artefacto.
- **Buildpacks automaticos:** reducen configuracion, pero ocultan los pasos de
  build y el contenido de la imagen; el `Dockerfile` multi-etapa es explicito y
  auditable.
- **Kubernetes u orquestadores equivalentes:** sobredimensionados para un
  unico servicio academico; se descartan por alcance.
