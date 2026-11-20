# Instrucciones para agentes

Este archivo contiene reglas permanentes para cualquier agente que trabaje en
este repositorio. Leelo antes de modificar codigo.

## Contexto

Sistema de Control de Acceso (proyecto academico, Universidad Tecnologica de
Tijuana). Controla el acceso de empleados a areas mediante tarjetas RFID, con
historial de eventos y un controlador ESP32-S3 que opera offline.

## Consulta previa en NotebookLM (MCP)

- Antes de hacer busquedas extensas en el codigo o pedir contexto de
  arquitectura, consulta primero el servidor MCP `notebooklm` para obtener
  unicamente los requisitos y contratos tecnicos necesarios.

## Stack confirmado (no cambiar sin aprobacion)

- Monorepo con npm workspaces.
- Backend: Node.js + Express 5 + TypeScript.
- Base de datos: PostgreSQL en Supabase.
- ORM: Prisma 7 (`prisma-client` + `@prisma/adapter-pg`).
- Autenticacion: Supabase Auth (pendiente de integrar).
- Web administrativa: React + Vite + TypeScript (pendiente).
- App movil: React Native + Expo (pendiente).
- API REST/JSON + OpenAPI/Swagger (documentacion pendiente).
- Validacion: Zod.
- Pruebas backend: Vitest + Supertest.

Version de Node: >= 22.12 (ver `.nvmrc`). TypeScript 5.9 y Prisma 7.10 estan
fijados por compatibilidad (ver `docs/adr/0007-tooling-version-selection.md`).

## Estructura

- `apps/api`: backend. Es la unica capa con acceso a la base de datos.
- `apps/admin`: reservado para la web administrativa (solo README por ahora).
- `apps/mobile`: reservado para la app movil (solo README por ahora).
- `packages/shared`: tipos/constantes compartidos, sin logica de negocio.
- `docs/`: arquitectura, base de datos, contratos y ADRs.
- `.agents/skills`: skills instalados (Prisma, Supabase, Postgres). Consultarlos
  antes de cambios de base de datos o sincronizacion.

## Comandos

```bash
npm install                  # desde la raiz
npm run prisma:generate      # genera el cliente Prisma
npm run dev                  # API en desarrollo
npm run build                # compila todos los workspaces
npm run typecheck            # tsc --noEmit por workspace
npm run lint                 # ESLint
npm test                     # Vitest + Supertest
```

Antes de dar una tarea por terminada, ejecutar `lint`, `typecheck`, `test` y
`build`, y reportar resultados reales. No inventar resultados.

## Convenciones

- Identificadores (variables, tablas, endpoints, archivos) en **ingles**.
- Interfaz de usuario y documentacion para el equipo en **espanol**.
- TypeScript estricto; evitar `any` sin justificacion.
- Modulos pequenos con responsabilidades claras.
- No agregar dependencias sin justificar su utilidad.
- No crear carpetas o archivos vacios sin proposito.
- No versionar secretos ni archivos `.env`.

## Arquitectura

- Monolito modular. No microservicios, Kubernetes, colas distribuidas ni
  infraestructura innecesaria.
- Rutas versionadas bajo `/api/v1`.
- Respuestas de error uniformes: `{ error: { code, message, details? } }`.
- El cliente Prisma se crea de forma perezosa (`src/config/prisma.ts`); la API
  debe poder arrancar y responder salud sin credenciales.
- Solo el controlador fisico es offline-first. La web y la movil requieren
  Internet.

## Base de datos

- El modelo definitivo **no esta aprobado**. No ejecutar migraciones contra una
  base real ni inventar tablas/campos definitivos.
- Mantener `docs/DATABASE.md` actualizado cuando se apruebe el modelo.
- Los eventos deben distinguir `occurred_at` de `received_at` y ser idempotentes
  (`client_event_id`).
- Los eventos de tarjetas desconocidas se conservan sin empleado asociado.
- Nunca eliminar historial de accesos.

## Git

- `main`: rama estable; solo base inicial y merges aprobados.
- **Regla obligatoria para cualquier cambio a futuro:** antes de modificar
  codigo o documentacion, cambiar a la rama correspondiente conectada a `main`:
  - `feat/api`: cambios del backend (`apps/api`, Prisma, contratos/OpenAPI).
  - `feat/web`: cambios de la web administrativa (`apps/admin`).
  - `feat/mobile`: cambios de la app movil (`apps/mobile`).
- Si un cambio afecta `packages/shared` o configuracion transversal de la raiz,
  trabajarlo en la rama del componente que lo impulsa y sincronizar el resto
  tras su integracion aprobada en `main`.
- No desarrollar directamente en `main`.
- No hacer merge automatico, ni `force push`, ni reescribir historia remota.
- No hacer commit, push ni crear ramas adicionales sin que la tarea lo pida.
- No configurar remotos con URLs inventadas.

## Requisitos funcionales clave

- Web: dashboard, empleados, tarjetas RFID, areas, permisos, usuarios/roles,
  dispositivos, historial general y estado de sincronizacion.
- Movil: login, historial personal y detalle de eventos propios. Un empleado
  nunca ve datos de otro ni accede a funciones administrativas.
- Dispositivo: descarga datos, valida offline, guarda eventos localmente y
  sincroniza al recuperar conexion.

## Pendientes de aprobacion

- Modelo de datos definitivo (entidades, campos, indices, RLS).
- Autenticacion de dispositivos fisicos.
- Estrategia de versionado de sincronizacion.
- Modelo de roles/permisos administrativos.
- Adopcion de TypeScript 7 / Prisma 8 cuando sean estables y compatibles.

Si una instruccion contradice los requisitos o el stack confirmado, detenerse y
reportarlo antes de implementar.

## Al terminar una mision

Reportar: resumen, arbol de directorios, versiones, dependencias y justificacion,
archivos creados, comandos, resultados reales de lint/test/build, estado de Git,
commits, ramas, remoto/pushes, problemas, decisiones pendientes y proxima tarea.
