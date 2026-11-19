# `apps/mobile` — Accesa Móvil

Aplicación móvil para empleados del **Sistema de Control de Acceso (Accesa)**, implementada con React Native y Expo en TypeScript estricto.

## Propósito y reglas de negocio

- **Uso exclusivo para empleados:** Solo pueden ingresar cuentas activas vinculadas a un empleado (`employeeId !== null` en `GET /api/v1/auth/me`).
- **Aislamiento estricto:** Cada empleado consulta únicamente su propio historial personal (`GET /api/v1/me/access-events`) y el detalle de cada evento propio (`GET /api/v1/me/access-events/:id`). No existen vistas administrativas ni consulta de eventos de terceros.
- **Cuentas administrativas bloqueadas:** Si inicia sesión una cuenta válida en Supabase Auth pero sin registro de empleado vinculado (`employeeId === null`), `AuthContext` cambia el estado a `'unsupported'` y `AppNavigator` muestra `UnsupportedAccountScreen` con el botón para cerrar sesión.
- **Requiere conexión a Internet:** No implementa base de datos local *offline-first* (esa capacidad corresponde únicamente al controlador físico ESP32-S3).
- **Idioma y zona horaria:** Interfaz de usuario y mensajes en español; identificadores de código en inglés. Fechas y horas formateadas en `America/Tijuana` (`src/utils/formatters.ts`).
- **Resiliencia HTTP:** `apiFetch` (`src/api/httpClient.ts`) adjunta `Authorization: Bearer <token>`, aplica un timeout de `35 000 ms` (`REQUEST_TIMEOUT_MS`) y traduce errores de timeout (`TIMEOUT`) o red (`NETWORK_ERROR`) a `MobileApiError`.

## Identidad visual

Definida en `app.json` y `src/theme/colors.ts`, alineada con la marca **Accesa**:

- **Modo claro:** `"userInterfaceStyle": "light"` en `app.json`, fondo general `#F7F6FA` y tarjetas `#FFFFFF`.
- **Color principal de marca (`colors.brand`):** `#1E1427` (tinta morado-negro de Accesa, usada también en `splash.backgroundColor` en `app.json`).
- **Estados semánticos:**
  - Acceso permitido (`granted`): `#0D9488` / texto `#0F766E`.
  - Acceso denegado (`denied`): `#BE123C` / texto `#9F1239`.
  - Advertencia (`warning`): `#B45309` / texto `#92400E`.

## Stack tecnológico confirmado

Versiones declaradas en `apps/mobile/package.json`:

- **Framework y UI:** `expo` (`~58.0.26`), `react-native` (`0.88.1`), `react` (`19.3.0`), `expo-status-bar` (`~58.0.5`), Nueva Arquitectura habilitada (`"newArchEnabled": true` en `app.json`).
- **Navegación:** `@react-navigation/native` (`^7.1.0`), `@react-navigation/native-stack` (`^7.3.0`), `react-native-safe-area-context` (`~5.11.1`), `react-native-screens` (`~4.30.1`).
- **Autenticación y sesión cifrada:** `@supabase/supabase-js` (`2.49.4`), `expo-secure-store` (`~58.0.3` para persistir la sesión en Keychain/Keystore) y `react-native-url-polyfill` (`^2.0.0`).
- **Validación y contratos:** `zod` (`^4.6.7`) y `@scaccess/shared` (`*`).
- **Tipado y pruebas:** `typescript` (`^5.9.3`) y `vitest` (`^5.0.5`, entorno `node`).

## Estructura del workspace

```text
apps/mobile/
├── .env.example                       # Plantilla de variables públicas EXPO_PUBLIC_*
├── App.tsx                            # Proveedores raíz (SafeAreaProvider, AuthProvider) y AppNavigator
├── README.md                          # Documentación de la app móvil
├── app.json                           # Configuración de Expo (Accesa Móvil, modo claro, splash #1E1427)
├── babel.config.js                    # Preset babel-preset-expo
├── index.ts                           # Registro del componente raíz con Expo
├── metro.config.js                    # Resolución del monorepo para @scaccess/shared
├── package.json                       # Dependencias y scripts de @scaccess/mobile
├── tsconfig.json                      # Configuración estricta de TypeScript
├── vitest.config.ts                   # Configuración de Vitest (entorno node)
├── assets/                            # Recursos PNG de identidad Accesa (reservados para icono, splash y pantallas)
│   ├── isotipo.png
│   ├── isotipo_oscuro_transparente.png
│   ├── logo_accesa_fondo_blanco.png
│   └── logo_accesa_fondo_blanco_oscuro_transparente.png
├── src/
│   ├── api/
│   │   ├── accessEventsApi.ts         # listMyAccessEvents() y getMyAccessEventById()
│   │   ├── authApi.ts                 # getMe() -> UserAccountDto
│   │   └── httpClient.ts              # apiFetch() con Bearer token, timeout 35s y MobileApiError
│   ├── components/
│   │   ├── DecisionBadge.tsx          # Insignia "Acceso permitido" / "Acceso denegado"
│   │   ├── EmptyState.tsx             # Estado vacío o error con botón de reintentar
│   │   └── EventListItem.tsx          # Tarjeta resumen de un evento en el historial
│   ├── config/
│   │   ├── env.ts                     # Validación Zod de variables EXPO_PUBLIC_* y valores por defecto
│   │   └── supabase.ts                # Cliente Supabase Auth con adaptador expo-secure-store
│   ├── context/
│   │   └── AuthContext.tsx            # Estado global de sesión (loading, signedOut, unsupported, signedIn)
│   ├── navigation/
│   │   ├── AppNavigator.tsx           # Pila nativa (AccessHistory y AccessEventDetail) según estado auth
│   │   └── types.ts                   # Contrato de rutas RootStackParamList
│   ├── screens/
│   │   ├── AccessEventDetailScreen.tsx  # Detalle completo del evento (occurredAt, receivedAt, cardUid, etc.)
│   │   ├── AccessHistoryScreen.tsx      # Historial paginado (pageSize=20) con pull-to-refresh
│   │   ├── LoginScreen.tsx              # Inicio de sesión con correo y contraseña
│   │   └── UnsupportedAccountScreen.tsx # Bloqueo informativo para cuentas sin employeeId
│   ├── theme/
│   │   └── colors.ts                  # Tokens de color, espaciado y radios Accesa
│   └── utils/
│       ├── areaLabels.ts              # Etiquetas de decisión, motivos y áreas conocidas en español
│       └── formatters.ts              # Formato de UID RFID y fechas/horas en America/Tijuana
└── tests/
    ├── areaLabels.test.ts             # Pruebas de etiquetas y áreas
    ├── env.test.ts                    # Pruebas de variables de entorno
    ├── formatters.test.ts             # Pruebas de UID y formato horario
    └── httpClient.test.ts             # Pruebas de apiFetch (sesión, 200, error HTTP, timeout y red)
```

## Configuración de entorno

La configuración pública se valida con Zod en `src/config/env.ts` y toma como referencia `apps/mobile/.env.example`. Si necesitas sobrescribir los valores por defecto en desarrollo, copia `apps/mobile/.env.example` a `apps/mobile/.env` (archivo ignorado por Git):

- `EXPO_PUBLIC_API_BASE_URL`: URL base de la API incluyendo el prefijo `/api/v1` (sin barra final).
- `EXPO_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase Auth (`https://...`).
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: clave pública (`publishable` / `anon`) de Supabase Auth.

> **Seguridad:** Todo el código y las variables `EXPO_PUBLIC_*` se empaquetan dentro de la aplicación cliente. **Nunca** incluyas `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, contraseñas ni credenciales privadas en `.env` ni en la configuración móvil.

## Comandos y monorepo

Ejecuta desde la raíz del repositorio (o dentro de `apps/mobile` omitiendo `--workspace @scaccess/mobile`):

```bash
npm run start --workspace @scaccess/mobile      # Inicia Metro / Expo (también `dev`)
npm run android --workspace @scaccess/mobile    # Abre la app en Android
npm run ios --workspace @scaccess/mobile        # Abre la app en iOS
npm run web --workspace @scaccess/mobile        # Abre la app en navegador web
npm run lint --workspace @scaccess/mobile       # Ejecuta ESLint en apps/mobile
npm run typecheck --workspace @scaccess/mobile  # Verifica tipos con tsc --noEmit
npm run test --workspace @scaccess/mobile       # Ejecuta las pruebas con Vitest
npm run build --workspace @scaccess/mobile      # Valida compilación TypeScript (tsc --noEmit)
```

### Resolución de `@scaccess/shared` en Metro

`apps/mobile/metro.config.js` configura `config.watchFolders` apuntando a la raíz del monorepo y `config.resolver.nodeModulesPaths` apuntando tanto a `apps/mobile/node_modules` como al `node_modules` de la raíz para que Metro pueda seguir el symlink de `@scaccess/shared` creado por `npm workspaces`.

Antes de iniciar Expo o correr pruebas aisladas en `apps/mobile`, asegúrate de haber compilado `@scaccess/shared` al menos una vez desde la raíz:

```bash
npm run build --workspace @scaccess/shared
```
