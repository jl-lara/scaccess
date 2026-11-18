# apps/admin - Aplicacion web administrativa

Consola web administrativa de **Accesa** (Sistema de Control de Acceso). Permite
operar el catalogo de empleados, tarjetas RFID, areas, permisos, controladores
ESP32-S3, bitacora de accesos y cuentas administrativas.

La interfaz esta en espanol, adopta una estetica minimalista y requiere conexion
a Internet. Solo el controlador fisico es offline-first.

## Identidad visual y navegacion

- **Marca:** Accesa. Los activos graficos provienen de `logo/isotipo.png`,
  `logo/logo_accesa_fondo_blanco.png`, `logo/isotipo_oscuro_transparente.png` y
  `logo/logo_accesa_fondo_blanco_oscuro_transparente.png`, copiados a
  `apps/admin/public/brand/` para adaptarse dinamicamente a modo claro y oscuro.
- **Paleta y tema:** lenguaje visual minimalista derivado del logotipo, con
  **tema claro predeterminado** (`#FFFFFF` y `#1E1427`) y **variante oscura**
  (`#120C18` y `#1E1427`).
- **Barra lateral:** el boton para ocultar/mostrar la barra lateral vive dentro
  de la propia barra lateral, manteniendo despejada la barra superior, e incluye
  el submenu desplegable `Catálogos y equipos` (`Empleados`, `Tarjetas RFID`,
  `Controladores ESP32`).
- **Vistas concisas e interactivas:** el panel de control revela detalles
  operativos al pasar el cursor (hover/foco) sobre tarjetas KPI, areas, pulso de
  eventos, motivos y controladores; la bitacora permite exportar reportes PDF
  (`src/lib/pdfReport.ts`).

## Stack

- React 19 + Vite 6 + TypeScript 5.9 (modo estricto).
- React Router 7 para las rutas de la consola.
- Supabase Auth (`@supabase/supabase-js`) para la sesion administrativa.
- `lucide-react` para iconografia.
- Vitest 5 + Testing Library + jsdom para pruebas.
- Contratos HTTP compartidos desde `@scaccess/shared`.

## Estructura

```text
apps/admin/
├── public/
│   └── brand/                      Activos de marca Accesa (versiones claro y oscuro)
├── src/
│   ├── App.tsx                     Mapa de rutas de la consola
│   ├── main.tsx                    Punto de entrada (Router + ThemeProvider + AuthProvider)
│   ├── components/
│   │   ├── layout/AppShell.tsx     Barra lateral (toggle integrado y submenu), topbar y salud de API
│   │   └── ui/                     Primitivas compartidas de interfaz
│   ├── context/
│   │   ├── AuthContext.tsx         Sesion de Supabase y roles efectivos
│   │   └── ThemeContext.tsx        Tema claro predeterminado y variante oscura
│   ├── lib/
│   │   ├── api.ts                  Cliente HTTP tipado de /api/v1
│   │   ├── env.ts                  Variables de entorno de Vite
│   │   ├── supabase.ts             Cliente perezoso de Supabase
│   │   ├── formatters.ts           Etiquetas y formatos en espanol
│   │   ├── pdfReport.ts            Generador nativo de reportes PDF (PDF 1.4)
│   │   └── validation.ts           Validaciones de formularios
│   ├── pages/                      Modulos funcionales de la consola
│   └── styles/theme.css            Variables de color Accesa y utilidades visuales
└── tests/                          Pruebas de paginas y enrutamiento
```

### Primitivas de interfaz

- `Modal`: dialogo accesible con foco inicial, cierre con `Escape`, bloqueo de
  scroll, retorno de foco y trampa de tabulacion.
- `Pagination`: paginacion reutilizable con conteo y estado deshabilitado.
- `NoticeBanner`: avisos de error, advertencia y exito con accion opcional.
- `StatusBadge`: variantes explicitas de estado (`success`, `danger`,
  `warning`, `neutral`, `info`).
- `TableMessage`: estados de carga, vacio y error dentro de tablas.

## Variables de entorno

Copia `apps/admin/.env.example` a `apps/admin/.env.local` (ignorado por Git).

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | URL base de la API, sin barra final ni `/api/v1`. El cliente agrega el prefijo versionado. |
| `VITE_SUPABASE_URL` | No | URL del proyecto de Supabase. |
| `VITE_SUPABASE_ANON_KEY` | No | Clave publica (publishable/anon) de Supabase. |

`src/lib/env.ts` incluye valores por defecto para el entorno academico. En
produccion define las tres variables en el proveedor de hosting.

**Nunca** coloques la clave `service_role` ni secretos de servidor en variables
`VITE_*`: Vite las incrusta en el bundle publico.

## Scripts

Desde la raiz del monorepo:

```bash
npm run dev:admin                  # Servidor Vite en http://localhost:5173
npm run build                      # Compila todos los workspaces
npm run typecheck                  # tsc --noEmit por workspace
npm run lint                       # ESLint
npm test                           # Vitest + Supertest / Testing Library
```

Tambien se puede trabajar dentro del workspace:

```bash
npm run dev --workspace @scaccess/admin
npm run build --workspace @scaccess/admin
npm run typecheck --workspace @scaccess/admin
npm run test --workspace @scaccess/admin
npm run test:watch --workspace @scaccess/admin
```

## Modulos implementados

| Ruta | Modulo | Capacidades |
| --- | --- | --- |
| `/` | Panel de control | Vista simplificada e interactiva: KPIs esenciales con desglose en hover, actividad reciente con inspector de pulso, estado de controladores y alerta de configuracion desactualizada. |
| `/access-events` | Bitacora de accesos | Filtros por decision, motivo, area, controlador, empleado, UID y rango de fechas; distincion entre `occurredAt` y `receivedAt`; detalle con metadatos JSON; exportacion a reporte PDF. |
| `/employees` | Empleados | Listado paginado, filtros por estado, departamento y busqueda; alta y edicion para Administrador u Operador. |
| `/credentials` | Tarjetas RFID | Filtros por estado, titular y UID; registro con validacion hexadecimal; actualizacion de etiqueta, estado y motivo de desactivacion. |
| `/permissions` | Permisos de acceso | Cruce de permisos con empleados y areas; filtros; otorgamiento con vigencia opcional y revocacion confirmada. |
| `/areas` | Areas fisicas | Seccionado en 3 pestañas (`Catalogo de areas`, `Croquis en vivo`, `Simulador de accesos`); alta y edicion (codigo, nombre, descripcion, zona horaria y estado) solo para Administrador. |
| `/devices` | Controladores ESP32-S3 | Inventario; areas asignadas; estado de sincronizacion (version reportada vs actual, marcas de tiempo y pendientes); alta/edicion con seleccion multiple de areas; emision de credencial con token mostrado una sola vez. |
| `/users` | Cuentas y roles | Exclusivo para Administrador; cuentas de Supabase Auth, vinculo opcional con empleado, estado y roles. |

La bitacora de accesos es inmutable: la interfaz no ofrece eliminar eventos ni
permisos; revocar un permiso conserva el registro historico.

## Roles de la consola

- **Administrador**: acceso completo, incluida la gestion de areas, dispositivos
  y cuentas/roles.
- **Operador**: consulta general y escritura sobre empleados, tarjetas RFID y
  permisos.
- **Auditor**: consulta de todos los modulos, sin acciones de escritura.

La interfaz oculta acciones no permitidas, pero la autorizacion real vive en el
backend. Cada solicitud se valida contra el perfil del usuario y sus roles; las
restricciones visuales no sustituyen esa validacion.

## Sesion y seguridad con Supabase

- `AuthContext` restaura la sesion con `supabase.auth.getSession()` y confirma
  el perfil contra `GET /api/v1/auth/me`.
- Solo se admiten cuentas con rol `admin`, `operator` o `auditor`. Una cuenta de
  empleado sin privilegios se cierra y se le invita a usar la app movil.
- El cliente HTTP obtiene el access token de Supabase en cada solicitud y lo
  envia como `Authorization: Bearer <token>`; no se manipulan tokens a mano.
- Supabase persiste y refresca la sesion. `signOut` limpia la sesion local y
  regresa a la pantalla de acceso.
- La clave publica de Supabase puede estar en el navegador; la clave
  `service_role` nunca. Las politicas RLS y la autorizacion del backend son la
  ultima linea de defensa.
- Las acciones destructivas se confirman en la interfaz y los errores del
  servidor se muestran sin ocultar el fallo.
- El token de un dispositivo (`<tokenId>.<secret>`) solo se muestra en el modal
  posterior a la emision. No se guarda en el estado global ni en el
  almacenamiento del navegador; se copia al portapapeles a solicitud del usuario.

## Manejo de red

`src/lib/api.ts` usa un timeout de 60 segundos para tolerar el arranque en frio
de Render Free. Las vistas de carga explican esa espera, y los errores de red,
timeout y validacion se presentan con mensajes accionables y boton de reintento
donde aplica.

## Pruebas

La suite de `apps/admin` cubre renderizado, filtros, formularios, estados de
carga/vacio/error, acceso por roles, foco de modales y contratos HTTP de las
ocho vistas administrativas:

```bash
npm run test --workspace @scaccess/admin
```

Las pruebas de paginas usan mocks del cliente `api` para no depender de Supabase
ni de la API durante CI. `tests/api.test.ts` verifica los metodos, rutas,
cabeceras y filtros enviados a `/api/v1`; `tests/accessibility.test.tsx` cubre el
skip link, los landmarks y la trampa de foco de los modales. El helper
`tests/renderWithAuth.tsx` inyecta un contexto de autenticacion con los roles
necesarios. La verificacion de integracion real contra Render y Supabase Auth se
realiza con las credenciales QA de `docs/QA-TEST-DATA.md`.

Antes de cerrar un cambio ejecuta, desde la raiz:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Pendientes

- Pruebas end-to-end contra la API real y Supabase Auth.
- Documentacion OpenAPI/Swagger publicada para los clientes.
- App movil de empleados (`apps/mobile`).
- Confirmacion del modelo definitivo de datos, RLS y autenticacion de
  dispositivos fisicos.
