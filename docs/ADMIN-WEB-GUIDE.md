# Guía de la Web Administrativa (`apps/admin`)

Documento de referencia para el equipo sobre la consola web del Sistema de
Control de Acceso (SCAccess): arquitectura, diseño del dashboard, módulos,
permisos por rol, ejecución local, despliegue y evidencia de la validación E2E
ejecutada contra el backend real en Render y Supabase Auth.

- **Estado:** aplicación implementada en `apps/admin` y contratos verificados en
  vivo el **2026-11-11 04:34 UTC** (2026-11-10 20:34, `America/Tijuana`).
- **Alcance:** esta guía documenta la consola administrativa. La app móvil y el
  controlador ESP32-S3 se documentan por separado.
- **Principio rector:** la web requiere Internet. Solo el controlador físico es
  offline-first.

---

## 1. Arquitectura

### 1.1 Stack

| Capa | Tecnología |
| --- | --- |
| UI | React 19 + TypeScript 5.9 (estricto) |
| Bundler / dev server | Vite 6 |
| Rutas | React Router 7 (`BrowserRouter`) |
| Autenticación | Supabase Auth (`@supabase/supabase-js` 2.49.4) |
| Contratos | Tipos y constantes de `@scaccess/shared` |
| Iconografía | `lucide-react` |
| Pruebas | Vitest 5 + Testing Library + jsdom |

La consola consume la API REST/JSON versionada en `/api/v1`; no accede a
PostgreSQL ni a Prisma. La única capa con acceso a la base de datos es
`apps/api`.

### 1.2 Composición de la aplicación

```text
index.html
└── src/main.tsx
    └── StrictMode
        └── BrowserRouter
            └── AuthProvider          (sesión Supabase + perfil /auth/me)
                └── App               (mapa de rutas)
                    ├── /login        LoginPage (pública)
                    └── ProtectedRoutes
                        └── AppShell  (sidebar + topbar + salud de API)
                            ├── /                  DashboardPage
                            ├── /access-events     AccessEventsPage
                            ├── /employees         EmployeesPage
                            ├── /credentials       CredentialsPage
                            ├── /permissions       PermissionsPage
                            ├── /areas             AreasPage
                            ├── /devices           DevicesPage
                            └── /users             UsersPage
```

- `src/components/layout/AppShell.tsx` concentra la navegación, el perfil
  activo, el cierre de sesión y el indicador de salud de la API.
- `src/components/ui/` contiene primitivas reutilizables: `Modal`,
  `Pagination`, `NoticeBanner`, `StatusBadge` y `TableMessage`.
- `src/pages/` mantiene un módulo por página, con estado local y llamadas
  directas al cliente HTTP. No hay store global ni caché de datos compartida.
  Cada vista protegida se carga con `React.lazy` y `Suspense`, de modo que el
  bundle inicial solo incluye login, el shell y las primitivas compartidas.
- `src/lib/` agrupa el cliente HTTP (`api.ts`), el cliente perezoso de Supabase
  (`supabase.ts`), las variables de entorno (`env.ts`), los formatos en español
  (`formatters.ts`) y las validaciones de formularios (`validation.ts`).

### 1.3 Flujo de autenticación y autorización

1. El usuario entra en `/login` y envía correo y contraseña.
2. `AuthContext.signIn()` llama a `supabase.auth.signInWithPassword()`.
3. Supabase devuelve y persiste la sesión; el cliente HTTP obtiene el
   `access_token` de la sesión en cada solicitud (`getSession()`), sin
   manipular tokens manualmente.
4. `AuthContext` confirma el perfil contra `GET /api/v1/auth/me`.
5. Solo se admiten cuentas con al menos un rol `admin`, `operator` o `auditor`.
   Una cuenta `employee` se cierra automáticamente y se invita a usar la app
   móvil.
6. Cada petición envía `Authorization: Bearer <access_token>`.
7. El backend vuelve a validar el token contra Supabase y el rol en cada
   endpoint. Ocultar un botón o una ruta en la UI es solo experiencia de
   usuario; **la autorización real vive en el servidor**.

La sesión se restaura al recargar con `supabase.auth.getSession()`. Si el token
expira o el backend responde `401`, la UI muestra el error y el usuario debe
volver a iniciar sesión. `signOut()` limpia la sesión local y regresa a
`/login`.

### 1.4 Cliente HTTP (`src/lib/api.ts`)

- Compone la URL como `VITE_API_BASE_URL` + `/api/v1` + ruta + query string.
- Usa `fetch` con `AbortController` y un timeout de **60 s**, suficiente para
  tolerar el *cold start* de Render Free (hasta ~60 s).
- Serializa body JSON y agrega `Content-Type` cuando corresponde.
- Trata `204 No Content` como respuesta vacía.
- Normaliza errores en `ApiClientError` con `statusCode`, `code`, `message` y
  `details` opcionales. Los errores de red se reportan como
  `NETWORK_ERROR`; los timeouts como `TIMEOUT`.
- Obtiene el token de Supabase en cada llamada (o de un getter inyectable en
  pruebas con `setAccessTokenGetter`).
- `getHealth()` es la única llamada sin autenticación (`skipAuth: true`).

Contratos de lista observados en vivo:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

`GET /roles` devuelve un arreglo directo de roles, no una respuesta paginada.
Los errores usan el formato uniforme:

```json
{ "error": { "code": "FORBIDDEN", "message": "Insufficient permissions" } }
```

### 1.5 Configuración de entorno

`src/lib/env.ts` resuelve las variables de Vite y aplica valores por defecto
para el entorno académico. Esto permite arrancar la app sin `.env.local`, pero
en un despliegue real se deben definir explícitamente las tres variables.

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No (tiene default) | URL base de la API **sin** barra final ni `/api/v1`. El cliente agrega el prefijo versionado. |
| `VITE_SUPABASE_URL` | No (tiene default) | URL del proyecto de Supabase. |
| `VITE_SUPABASE_ANON_KEY` | No (tiene default) | Clave pública (`publishable`/`anon`) de Supabase. |

> **Seguridad:** Vite incrusta las variables `VITE_*` en el bundle público.
> Nunca coloques `service_role`, secretos de servidor ni contraseñas en ellas.
> La clave pública de Supabase está diseñada para el navegador; la protección
> real de los datos depende de RLS y de la autorización del backend.

---

## 2. Diseño del Dashboard: "Tactile Security Command Center"

El panel `/` está concebido como un centro de mando operativo: fondo oscuro,
alto contraste, números monoespaciados y colores semánticos para distinguir
accesos concedidos, denegados y advertencias. La intención es que un operador
pueda evaluar el estado del sistema en segundos, sin leer tablas densas.

### 2.1 Lenguaje visual

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg-canvas` | `#0b0f17` | Fondo general de la consola |
| `--bg-surface` | `#111827` | Tarjetas y sidebar |
| `--bg-surface-elevated` | `#172033` | Filas, inputs y subpaneles |
| `--accent-primary` | `#0ea5e9` | Marca, enlaces y foco |
| `--status-granted` | `#10b981` | Accesos concedidos y estado saludable |
| `--status-denied` | `#f43f5e` | Accesos denegados y errores |
| `--status-warning` | `#f59e0b` | Sincronización pendiente y advertencias |
| `--font-sans` | `Plus Jakarta Sans` | Texto general |
| `--font-mono` | `IBM Plex Mono` | KPIs, códigos, UIDs y fechas |

Las tarjetas KPI incluyen una barra superior de 3 px con el color semántico de
su categoría. Los estados usan badges con fondo suave, borde y texto de alto
contraste; no se depende solo del color para comunicar el estado.

### 2.2 Estructura de pantalla

```text
┌───────────────────────┬──────────────────────────────────────────────┐
│ Sidebar 260 px        │ Topbar 60 px: salud API + versión             │
│ - Marca SCAccess      ├──────────────────────────────────────────────┤
│ - Navegación          │ Encabezado: título, descripción, Actualizar   │
│ - Perfil + roles      │ Banner de controladores desactualizados       │
│ - Cerrar sesión       │ Grid de 6 tarjetas KPI                        │
│                       │ ┌───────────────────────────┬──────────────┐ │
│                       │ │ Últimos eventos + ratio   │ Salud de     │ │
│                       │ │ de concedidos/denegados   │ controladores│ │
│                       │ └───────────────────────────┴──────────────┘ │
└───────────────────────┴──────────────────────────────────────────────┘
```

- **Sidebar fija** de 260 px con la marca, la navegación principal y el perfil
  del usuario (correo y roles traducidos al español).
- **Topbar sticky** con un punto de estado de la API:
  - `waking` (ámbar): "Despertando la API en Render… puede tardar hasta 60 segundos."
  - `online` (verde): "API conectada (Ns activa)"
  - `offline` (rojo): "API sin respuesta. Verifica la conexión y vuelve a intentarlo."
  La comprobación se repite cada **30 s** con `GET /api/v1/health`.
- **Contenido** centrado con ancho máximo de 1440 px y padding fluido.

### 2.3 KPIs del panel

| KPI | Fuente | Comportamiento |
| --- | --- | --- |
| Empleados activos | `summary.employees.active` | Muestra también el total registrado y enlace a Empleados. |
| Tarjetas RFID activas | `summary.credentials.active` | Muestra bloqueadas/extravíadas y enlace a Tarjetas. |
| Áreas protegidas | `summary.areas.active` | Muestra el total configurado y enlace a Áreas. |
| Controladores ESP32 | `summary.devices.active / total` | Cambia a variante ámbar si `outOfSync > 0`; enlace a Controladores. |
| Accesos concedidos (24 h) | `summary.recentEvents24h.granted` | Muestra el porcentaje sobre el total de intentos y enlace a la bitácora. |
| Accesos denegados (24 h) | `summary.recentEvents24h.denied` | Muestra el porcentaje de rechazos y enlace a la bitácora. |

Las cifras se cargan en paralelo con `Promise.all` junto con los últimos 8
eventos, los controladores, las áreas y los empleados necesarios para resolver
nombres. Así se evita una cascada de peticiones.

### 2.4 Alertas y monitoreo

- Si `summary.devices.outOfSync > 0`, aparece un banner ámbar con el número de
  controladores activos con cambios pendientes y un enlace directo a
  `/devices`.
- La tarjeta de controladores cambia a `variant-warning` en ese mismo caso.
- La tabla de **últimos eventos** muestra resultado, empleado/tarjeta, área,
  motivo y hora del lector con segundos. Una tarjeta desconocida aparece como
  "Tarjeta no vinculada" y conserva su UID, sin inventar un empleado.
- La barra de proporción concedidos/denegados resume visualmente las últimas
  24 h.
- El panel de **salud de controladores** lista nombre, código, estado, ubicación,
  versión de configuración y última conexión relativa.

### 2.5 Estados y accesibilidad

- Cada sección tiene `aria-label`; los errores usan `role="alert"` y las
  advertencias `role="status"`.
- Los botones y enlaces muestran un anillo de foco visible (`:focus-visible`).
- Las tablas se envuelven en contenedores con scroll horizontal para no romper
  el layout en pantallas pequeñas.
- En `prefers-reduced-motion: reduce` se desactivan animaciones y transiciones.
- La navegación se colapsa a una columna por debajo de 960 px y los controles
  pasan a ancho completo por debajo de 720 px.
- Los estados de carga, vacío y error se muestran dentro de las tablas o
  tarjetas, sin dejar la pantalla en blanco.

---

## 3. Módulos y permisos por rol

### 3.1 Matriz de acceso

**R** = lectura; **RW** = lectura y escritura; **—** = sin acceso.

| Módulo | Ruta | `admin` | `operator` | `auditor` |
| --- | --- | :---: | :---: | :---: |
| Panel de control | `/` | R | R | R |
| Bitácora de accesos | `/access-events` | R | R | R |
| Empleados | `/employees` | RW | RW | R |
| Tarjetas RFID | `/credentials` | RW | RW | R |
| Permisos de acceso | `/permissions` | RW | RW | R |
| Áreas físicas | `/areas` | RW | R | R |
| Controladores ESP32-S3 | `/devices` | RW | R | R |
| Cuentas y roles | `/users` | RW | — | — |

Notas:

- La navegación oculta `/users` a quien no es `admin`. Si se entra por URL
  directa, `UsersPage` muestra una tarjeta de "Permisos insuficientes".
- En Áreas y Controladores, los roles `operator` y `auditor` ven el catálogo en
  modo lectura.
- La bitácora de accesos es **inmutable**: no hay acciones para eliminar
  eventos ni permisos. Revocar un permiso conserva el registro histórico.
- El backend aplica `requireAuth` y `requireRoles`; una petición directa con un
  rol insuficiente responde `403 FORBIDDEN` aunque la UI no haya mostrado el
  botón.

### 3.2 Capacidades por módulo

| Módulo | Capacidades principales |
| --- | --- |
| Panel de control | KPIs, últimos eventos, proporción concedidos/denegados, salud de controladores, alerta de configuración desactualizada, actualización manual. |
| Bitácora de accesos | Filtros por decisión, motivo, área, controlador, empleado, UID y rango de fechas; distinción entre `occurredAt` (lector) y `receivedAt` (servidor); detalle con metadatos JSON. |
| Empleados | Listado paginado, filtros por estado, departamento y búsqueda; alta y edición de datos y estado operativo. |
| Tarjetas RFID | Inventario paginado; filtros por estado, titular y UID; alta con validación hexadecimal; edición de etiqueta, estado y motivo de desactivación. |
| Permisos de acceso | Cruce de permisos con empleados y áreas; filtros; otorgamiento con vigencia opcional; revocación con confirmación. |
| Áreas físicas | Catálogo paginado; alta y edición de código, nombre, descripción, zona horaria y estado (solo Administrador). |
| Controladores ESP32-S3 | Inventario; áreas asignadas; estado de sincronización (versión reportada vs. actual, marcas de tiempo y pendientes); alta/edición con selección múltiple de áreas; emisión de credencial con token mostrado una sola vez. |
| Cuentas y roles | Exclusivo de Administrador: cuentas de Supabase Auth, vínculo opcional con empleado, estado y roles. |

---

## 4. Ejecución local

### 4.1 Requisitos

- Node.js >= 22.12 (ver `.nvmrc`).
- npm >= 10.
- Acceso a Internet para Supabase Auth y la API en Render.

### 4.2 Instalación y arranque

Desde la raíz del monorepo:

```bash
npm install
Copy-Item apps/admin/.env.example apps/admin/.env.local   # PowerShell
# En Bash/macOS/Linux: cp apps/admin/.env.example apps/admin/.env.local
npm run dev:admin
```

La consola queda disponible en **http://localhost:5173** (puerto fijo,
`strictPort: true`). Vite sirve la SPA con recarga en caliente.

Para iniciar sesión usa una cuenta administrativa de
`docs/QA-TEST-DATA.md`. La cuenta de QA administrativa
(`admin.qa@scaccess.local`) tiene rol `admin`; su contraseña está en ese mismo
documento. No se debe reutilizar esa cuenta para producción.

### 4.3 Scripts útiles

```bash
npm run dev:admin                                  # Vite en 5173
npm run build --workspace @scaccess/admin          # Build de producción
npm run typecheck --workspace @scaccess/admin      # tsc --noEmit
npm run test --workspace @scaccess/admin           # Vitest + Testing Library
npm run test:watch --workspace @scaccess/admin     # Pruebas en watch
npm run preview --workspace @scaccess/admin        # Sirve el build local
```

El build genera `apps/admin/dist`. Las pruebas de `apps/admin` usan mocks del
cliente `api`; no requieren Supabase ni la API reales.

### 4.4 Variables y reinicio

Vite lee las variables `VITE_*` al arrancar y las incrusta en el bundle. Si
cambias `apps/admin/.env.local`, reinicia `npm run dev:admin`; si cambias una
variable de producción, vuelve a construir y redepliega. Los valores por
defecto de `src/lib/env.ts` apuntan al proyecto académico, pero un despliegue
propio debe definir sus propias variables.

---

## 5. Despliegue web

### 5.1 Estado actual

El repositorio incluye `render.yaml`, pero **solo define el servicio de la API**
(`scaccess-api`). No hay un servicio de web administrativa declarado ni una URL
de producción de la web versionada en este repositorio. El despliegue web debe
crearse en el proveedor de hosting que use el equipo.

La web es una **SPA estática**: no necesita servidor Node en producción. El
build de Vite genera HTML, CSS y JavaScript que se sirven desde un CDN o un
servicio de sitios estáticos.

### 5.2 Requisitos de build

| Parámetro | Valor |
| --- | --- |
| Directorio raíz | Raíz del monorepo (por los npm workspaces) |
| Versión de Node | 22 (o >= 22.12) |
| Comando de instalación | `npm ci` |
| Comando de build | `npm run build --workspace @scaccess/admin` |
| Directorio de publicación | `apps/admin/dist` |
| Rewrite SPA | Todas las rutas (`/*`) → `/index.html` |

El rewrite es obligatorio porque `BrowserRouter` maneja rutas como
`/employees` o `/devices` en el navegador. Sin él, recargar una ruta profunda
devuelve 404 en el hosting.

### 5.3 Variables de build

Definir en el proveedor de hosting antes del build:

```text
VITE_API_BASE_URL=https://scaccess-api.onrender.com
VITE_SUPABASE_URL=https://vomjmyqxbqgndndvpaqb.supabase.co
VITE_SUPABASE_ANON_KEY=<clave publishable/anon del proyecto>
```

`VITE_API_BASE_URL` no debe incluir `/api/v1` ni barra final. La clave
`VITE_SUPABASE_ANON_KEY` es pública por diseño; **nunca** uses
`SUPABASE_SERVICE_ROLE_KEY` en el frontend.

### 5.4 Ejemplo: Render Static Site

1. En Render, crea **New > Static Site** y conecta el repositorio.
2. Configura:
   - **Root Directory:** vacío (raíz del monorepo).
   - **Build Command:** `npm ci && npm run build --workspace @scaccess/admin`.
   - **Publish Directory:** `apps/admin/dist`.
   - **Node Version:** 22.
3. Agrega las tres variables `VITE_*` de la sección anterior.
4. Agrega la regla de rewrite `/*` → `/index.html` (Render la ofrece como
   *Redirects/Rewrites*).
5. Despliega y abre la URL del sitio. En el servicio de la API, agrega esa URL
   a `CORS_ORIGIN` (separada por comas si hay varios orígenes).

### 5.5 Ejemplo: Vercel o Netlify

- **Vercel:** importa el repositorio, selecciona la raíz del monorepo, usa
  `npm ci && npm run build --workspace @scaccess/admin` como Build Command y
  `apps/admin/dist` como Output Directory. Añade las variables `VITE_*` en
  *Environment Variables*. Vercel aplica el fallback de SPA automáticamente;
  si se usa configuración manual, agrega el rewrite a `index.html`.
- **Netlify:** Build Command `npm ci && npm run build --workspace
  @scaccess/admin`, Publish Directory `apps/admin/dist`, variables `VITE_*` y
  un archivo `_redirects` con `/* /index.html 200`.

### 5.6 CORS y Supabase Auth

- La API debe permitir el origen exacto de la web desplegada. El valor actual
  del servicio en Render permite `http://localhost:5173`; un origen nuevo
  (por ejemplo, `https://<tu-sitio>.onrender.com`) debe agregarse a
  `CORS_ORIGIN`. Sin ese cambio, el navegador bloqueará las peticiones aunque
  `curl` funcione, porque `curl` no aplica CORS.
- En Supabase Auth, configura la **Site URL** del proyecto con la URL de la
  web. El flujo actual es correo + contraseña (`signInWithPassword`), por lo que
  no hay callback OAuth ni correo mágico; aun así, una Site URL correcta evita
  comportamientos inesperados en enlaces de recuperación futuros.
- Si más adelante se agregan Google/OAuth o recuperación de contraseña, añade
  las **Redirect URLs** exactas del dominio desplegado.
- La cuenta debe existir en `auth.users` de Supabase y estar vinculada a un
  registro de `user_accounts` con rol administrativo. Crear solo el usuario de
  Supabase no basta: el backend responde `401` si no encuentra la cuenta o
  `403` si el rol no alcanza.

### 5.7 Lista de verificación post-despliegue

1. Abrir `/login` y confirmar que carga sin errores de consola.
2. Iniciar sesión con una cuenta administrativa de QA.
3. Verificar el indicador de la topbar: debe pasar a "API conectada".
4. Revisar que el dashboard muestre KPIs y no un banner de error.
5. Recorrer los módulos permitidos por el rol y confirmar que las acciones de
   escritura solo aparecen cuando corresponden.
6. Recargar directamente una ruta profunda (por ejemplo `/employees`) y
   confirmar que el rewrite de SPA funciona.
7. Probar un cierre de sesión y volver a entrar.
8. Confirmar que el origen de la web está en `CORS_ORIGIN` y que la API
   responde en el navegador (no solo con `curl`).

### 5.8 Seguridad y caché

- Publica solo la clave `publishable`/`anon` de Supabase. No incluyas la
  `service_role` ni secretos de la base de datos.
- Sirve `index.html` sin caché agresiva y los assets con hash de Vite con caché
  larga; así los despliegues nuevos no quedan atrapados en versiones viejas.
- Mantén HTTPS en el hosting y en la API.
- Recuerda que las políticas RLS de Supabase y la autorización del backend son
  la última línea de defensa; la UI no sustituye esas validaciones.

---

## 6. Validación E2E en vivo contra Render y Supabase Auth

### 6.1 Entorno y método

| Elemento | Valor |
| --- | --- |
| Fecha/hora de ejecución | 2026-11-11 04:34 UTC (2026-11-10 20:34 `America/Tijuana`) |
| API | `https://scaccess-api.onrender.com/api/v1` |
| Supabase Auth | `https://vomjmyqxbqgndndvpaqb.supabase.co` |
| Cuenta usada | `admin.qa@scaccess.local` (rol `admin`, `user_accounts.id = 1c80be2b-f012-436a-ba48-14d82cfbb555`) |
| Cliente | `curl` desde PowerShell, con token Bearer de Supabase |
| Alcance | Contratos HTTP consumidos por `apps/admin/src/lib/api.ts`; sin automatización de navegador |

Procedimiento:

1. `GET /api/v1/health` sin autenticación para comprobar el servicio.
2. `POST /auth/v1/token?grant_type=password` contra Supabase con la cuenta QA
   administrativa, enviando `apikey` con la clave publishable.
3. Cada endpoint de la API se llamó con
   `Authorization: Bearer <access_token>` y se registraron código HTTP, tiempo
   total y cuerpo de respuesta.
4. Se hicieron pruebas negativas de autenticación y autorización.

Todas las llamadas se ejecutaron en la misma sesión, con el servicio ya
despierto. La primera comprobación de salud de la sesión fue a las 04:34:33 UTC
y el servicio reportó `uptimeSeconds: 14`, por lo que **no se observó un cold
start** en esta ejecución. La guía de Render Free sigue aplicando: la primera
petición tras 15 minutos de inactividad puede tardar hasta ~60 s.

### 6.2 Autenticación

| Paso | Resultado | Tiempo |
| --- | --- | --- |
| `POST /auth/v1/token?grant_type=password` | `200`, `token_type: bearer`, `expires_in: 3600` | 0.286 s |
| `GET /api/v1/auth/me` | `200`, `email: admin.qa@scaccess.local`, `roles: ["admin"]`, `status: active` | 0.281 s |

El `auth_user_id` de Supabase (`53f47b59-d04c-4c31-830b-e9433a669e8f`) quedó
vinculado correctamente con la cuenta administrativa del backend.

### 6.3 Contratos verificados

Todos los endpoints que consume `apps/admin/src/lib/api.ts` respondieron
`200 OK`:

| Endpoint | HTTP | Tiempo | Bytes | Resultado observado |
| --- | :---: | ---: | ---: | --- |
| `GET /health` | 200 | 0.212 s | 104 | `status: ok`, `service: access-control-api` |
| `GET /auth/me` | 200 | 0.281 s | 304 | Cuenta admin activa con rol `admin` |
| `GET /dashboard/summary` | 200 | 0.477 s | 212 | 2 empleados (2 activos), 1 tarjeta activa, 3 áreas activas, 1 controlador activo, 0 desactualizados |
| `GET /employees?page=1&pageSize=20` | 200 | 0.290 s | 765 | `pagination: 1/1`, total 2 |
| `GET /credentials?page=1&pageSize=20` | 200 | 0.200 s | 405 | `pagination: 1/1`, total 1 |
| `GET /areas?page=1&pageSize=20` | 200 | 0.278 s | 884 | `pagination: 1/1`, total 3 |
| `GET /access-permissions?page=1&pageSize=20` | 200 | 0.393 s | 415 | `pagination: 1/1`, total 1 |
| `GET /access-devices?page=1&pageSize=20` | 200 | 0.286 s | 508 | `pagination: 1/1`, total 1 |
| `GET /access-devices/{id}/sync-state` | 200 | 0.250 s | 379 | `configVersion: "1"`, sin errores ni eventos pendientes reportados |
| `GET /access-events?page=1&pageSize=20` | 200 | 0.405 s | 1 176 | `pagination: 1/1`, total 2 |
| `GET /roles` | 200 | 0.417 s | 661 | 4 roles: `admin`, `operator`, `auditor`, `employee` |
| `GET /users?page=1&pageSize=20` | 200 | 0.187 s | 723 | `pagination: 1/1`, total 2 |

El endpoint de sincronización se probó con el controlador
`282b937e-2b0a-4d4c-a61c-fe00116a8441` (`ESP32-QA-01`). La respuesta incluyó
`lastSyncRequestedAt`, `lastSyncCompletedAt`, `lastEventReceivedAt`,
`lastEventOccurredAt`, `pendingEventCountReported: null`, `lastErrorCode: null`
y `configVersion: "1"`, consistente con el catálogo de QA.

### 6.4 Verificaciones de contrato y datos

- **Paginación:** las siete listas administrativas devolvieron la estructura
  `{ data, pagination }` con `page`, `pageSize`, `total` y `totalPages`, tal
  como espera el cliente. `GET /roles` devolvió un arreglo directo.
- **Totales vs. dashboard:** el dashboard reportó 2 empleados, 1 tarjeta, 3
  áreas, 1 controlador y 0 controladores desactualizados; esos valores
  coinciden con los totales de las listas correspondientes.
- **Eventos:** se devolvieron los 2 eventos de QA, incluido el evento de tarjeta
  desconocida (`employeeId: null`, `cardUid: "99999999"`,
  `reasonCode: "card_unknown"`). La respuesta conserva `occurredAt` y
  `receivedAt` como campos distintos, como requiere la auditoría offline.
- **Ventana de 24 h:** `recentEvents24h.granted` y `denied` reportaron 0 porque
  los eventos de QA son del 2026-11-10 02:41–02:42 UTC y la consulta se hizo
  más de 24 h después. No es un fallo de contrato; es el comportamiento
  esperado de la ventana móvil.
- **Roles:** el catálogo devolvió los cuatro roles del sistema, incluido
  `employee`, que no tiene acceso a la consola.
- **Usuarios:** se devolvieron las dos cuentas de QA, con sus roles y vínculos
  correspondientes.

### 6.5 Pruebas negativas de autenticación y autorización

| Caso | Resultado | Tiempo |
| --- | --- | --- |
| `GET /auth/me` sin `Authorization` | `401 UNAUTHORIZED` — `{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}` | 0.146 s |
| Login de `employee.qa@scaccess.local` | `200`, sesión válida en Supabase | — |
| `GET /auth/me` con cuenta `employee` | `200`, perfil con rol `employee` | 0.357 s |
| `GET /employees` con cuenta `employee` | `403 FORBIDDEN` — `{"error":{"code":"FORBIDDEN","message":"Insufficient permissions"}}` | 0.255 s |

Esto confirma que la restricción no es solo visual: el backend rechaza a una
cuenta sin rol administrativo aunque tenga un token válido de Supabase.

### 6.6 Comprobación de CORS

Se enviaron peticiones a `/health` con cabecera `Origin`:

| Origen | Cabecera `Access-Control-Allow-Origin` |
| --- | --- |
| `http://localhost:5173` | Presente, con el mismo origen |
| `https://scaccess-admin.onrender.com` (origen de ejemplo) | Ausente |

El primer caso habilita el desarrollo local. El segundo demuestra que un
dominio nuevo debe registrarse explícitamente en `CORS_ORIGIN` antes de probar
la web desplegada. `curl` no aplica CORS; una prueba con navegador sí lo hará.

### 6.7 Limitaciones de esta validación

- No se ejecutó automatización de navegador (Playwright/Cypress); la evidencia
  es de contrato HTTP, autenticación y autorización, no de interacción visual.
- No se ejecutaron operaciones de escritura para no alterar los datos QA
  compartidos. Los flujos de alta/edición están cubiertos por las pruebas de
  componentes de `apps/admin/tests`.
- No se probaron los roles `operator` y `auditor` en vivo porque el catálogo QA
  solo incluye una cuenta `admin` y una `employee`. La matriz de permisos de la
  sección 3 se deriva del código de la UI y de los middlewares del backend.
- No se forzó un cold start de Render; la sesión encontró el servicio caliente.

### 6.8 Conclusión

Los contratos consumidos por `apps/admin` responden correctamente contra la API
real en Render, con autenticación de Supabase y autorización por roles. No se
detectaron errores de contrato, códigos inesperados ni discrepancias entre los
totales del dashboard y las listas. La guía deja documentados los pasos de
ejecución local y despliegue, así como las comprobaciones que deben repetirse
después de publicar la web.

---

## 7. Solución de problemas

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| La consola muestra "API sin respuesta" | Render dormido, sin red o `CORS_ORIGIN` incorrecto | Abrir `/api/v1/health` en el navegador; esperar el cold start; revisar la consola de red y CORS. |
| `401 UNAUTHORIZED` al llamar la API | Token ausente/expirado o cuenta no vinculada en `user_accounts` | Volver a iniciar sesión; verificar el vínculo `auth_user_id` en la base. |
| `403 FORBIDDEN` en un módulo | El rol no alcanza para esa operación | Usar una cuenta con rol `admin`/`operator` según la matriz; la UI no puede saltarse la regla. |
| El login falla con "Credenciales inválidas" | Correo/contraseña incorrectos o usuario no confirmado en Supabase | Revisar la cuenta en Supabase Auth y `docs/QA-TEST-DATA.md`. |
| La app carga pero todas las peticiones fallan en el navegador | Origen no permitido por CORS | Agregar el origen exacto a `CORS_ORIGIN` del servicio de Render y redeployar la API. |
| Cambié `.env.local` y no se refleja | Vite incrusta variables al arrancar/compilar | Reiniciar `npm run dev:admin` o reconstruir el bundle. |
| Recargar `/employees` da 404 en producción | Falta el rewrite de SPA | Configurar `/*` → `/index.html` en el hosting. |
| El dashboard muestra 0 accesos en 24 h | Los eventos existentes son más antiguos que la ventana | Es esperado; consultar la bitácora sin filtro de fecha para ver el historial. |

---

## 8. Referencias

- `apps/admin/README.md` — resumen del workspace y scripts.
- `docs/ARCHITECTURE.md` — arquitectura general del sistema.
- `docs/API-CONTRACTS.md` — contratos REST/JSON.
- `docs/QA-TEST-DATA.md` — cuentas, áreas, empleados, tarjetas, dispositivos y
  eventos de prueba.
- `docs/DEVELOPMENT.md` — configuración del monorepo y despliegue de la API.
- `apps/admin/src/lib/api.ts` — cliente HTTP y endpoints consumidos.
- `apps/admin/src/styles/theme.css` — tokens visuales del dashboard.
