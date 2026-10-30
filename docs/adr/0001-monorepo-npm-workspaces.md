# ADR-0001: Monorepo con npm workspaces

- **Estado:** Aprobado
- **Fecha:** 2026-10-29

## Contexto

El proyecto tiene tres entregables (API, web administrativa y app movil) y un
paquete de contratos compartidos. Se requiere una unica base de codigo,
versionado y flujo de integracion continua.

## Decision

Usar un monorepo con **npm workspaces** como primera opcion.

- Workspaces actuales: `apps/api`, `packages/shared`.
- `apps/admin` y `apps/mobile` se incorporaran como workspaces al inicializar
  cada aplicacion.
- Un unico `package-lock.json` en la raiz.
- CI en la raiz ejecuta lint, typecheck, test y build de todos los workspaces.

## Motivos

- Evita duplicar configuracion y dependencias de desarrollo.
- npm ya esta disponible con Node.js; no agrega herramientas externas.
- Facilita compartir contratos y utilidades.

## Alternativas consideradas

- Repositorios separados: mas friccion para cambios coordinados.
- pnpm/turborepo: no se justifican para el alcance del prototipo.

## Consecuencias

- Las rutas de paquetes se resuelven con el nombre `@scaccess/*`.
- La instalacion debe hacerse desde la raiz.
- Si aparece una incompatibilidad tecnica demostrable, se evaluara otra
  herramienta con aprobacion del lider tecnico.
