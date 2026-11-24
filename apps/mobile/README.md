# `apps/mobile` — Accesa Móvil

Aplicación móvil para empleados del **Sistema de Control de Acceso (Accesa)**, implementada con React Native y Expo en TypeScript estricto.

## Propósito y reglas de negocio

- **Uso exclusivo para empleados:** Solo pueden ingresar cuentas activas vinculadas a un empleado (`employeeId !== null` en `GET /api/v1/auth/me`).
- **Aislamiento estricto:** Cada empleado consulta únicamente su propio historial personal (`GET /api/v1/me/access-events`) y el detalle de cada evento propio (`GET /api/v1/me/access-events/:id`). No existen vistas administrativas ni consulta de eventos de terceros.
- **Cuentas administrativas bloqueadas:** Si inicia sesión una cuenta válida en Supabase Auth pero sin registro de empleado vinculado (`employeeId === null`), `AuthContext` cambia el estado a `'unsupported'` y `AppNavigator` muestra `UnsupportedAccountScreen` con el botón para cerrar sesión.
- **Requiere conexión a Internet:** No implementa base de datos local *offline-first* (esa capacidad corresponde únicamente al controlador físico ESP32-S3).
- **Idioma y zona horaria:** Interfaz de usuario y mensajes en español; identificadores de código en inglés. Fechas y horas formateadas en `America/Tijuana` (`src/utils/formatters.ts`) y 6 áreas registradas mapeadas en `src/utils/areaLabels.ts`.
- **Resiliencia HTTP y validación:** `apiFetch` (`src/api/httpClient.ts`) adjunta `Authorization: Bearer <token>`, aplica un timeout de `35 000 ms` (`REQUEST_TIMEOUT_MS`) y traduce errores de timeout (`TIMEOUT`) o red (`NETWORK_ERROR`) a `MobileApiError`; `validateLoginForm` (`src/utils/validation.ts`) y `errorMessages.ts` presentan mensajes claros en pantalla.
- **Experiencia de consulta:** El historial agrupa eventos por día en `America/Tijuana` (*Hoy*, *Ayer* o fecha completa), muestra una tarjeta de resumen de actividad, destaca eventos con sincronización diferida del ESP32-S3 (desfase `>= 60 s` entre `occurredAt` y `receivedAt`), incluye un skeleton en la carga inicial, permite compartir un comprobante desde el detalle del evento y solicita confirmación antes de cerrar sesión.

## Identidad visual y modo oscuro

Definida en `app.json`, `src/theme/colors.ts`, `src/theme/brandAssets.ts` y `src/context/ThemeContext.tsx`, alineada con la web administrativa de **Accesa**:

- **Tema adaptable (claro y oscuro):** `"userInterfaceStyle": "automatic"` en `app.json`; respeta el esquema del dispositivo y permite alternar manualmente con `ThemeToggleButton` persistiendo la preferencia en `appStorage` (`expo-secure-store` en móvil o `localStorage` protegido en web).
- **Modo claro (`lightColors`):** fondo `#F7F6FA`, tarjetas `#FFFFFF`, tinta principal `#1E1427`, estados semánticos `#0D9488` / `#BE123C` / `#B45309`.
- **Modo oscuro (`darkColors`):** fondo `#120C18`, tarjetas `#1E1427`, superficies elevadas `#271B33`, texto `#F7F5FA`, tinta principal `#EDE8F5`, estados `#10B981` / `#F43F5E` / `#F59E0B`.
- **Activos PNG (`assets/`):**
  - `app-icon.png` (`1024 × 1024 px`) — ícono cuadrado de aplicación en `app.json`.
  - `adaptive-icon.png` (`1024 × 1024 px`) — ícono adaptativo de Android (`android.adaptiveIcon.foregroundImage` en `app.json`).
  - `isotipo.png` — cabecera de historial, pantalla de carga y cuenta no soportada en modo claro.
  - `isotipo_oscuro_transparente.png` — splash screen sobre `#1E1427` (`app.json`) y cabeceras en modo oscuro.
  - `logo_accesa_fondo_blanco.png` — wordmark de `LoginScreen` en modo claro.
  - `logo_accesa_fondo_blanco_oscuro_transparente.png` — wordmark de `LoginScreen` en modo oscuro.

## Stack tecnológico confirmado

Versiones declaradas en `apps/mobile/package.json`:

- **Framework y UI:** `expo` (`~58.0.26`), `react-native` (`0.88.1`), `react` (`19.3.0`), `expo-status-bar` (`~58.0.5`), Nueva Arquitectura habilitada (`"newArchEnabled": true` en `app.json`).
- **Navegación:** `@react-navigation/native` (`^7.1.0`), `@react-navigation/native-stack` (`^7.3.0`), `react-native-safe-area-context` (`~5.11.1`), `react-native-screens` (`~4.30.1`).
- **Autenticación y sesión cifrada:** `@supabase/supabase-js` (`2.49.4`), `expo-secure-store` (`~58.0.3` para persistir la sesión y preferencia de tema en Keychain/Keystore) y `react-native-url-polyfill` (`^2.0.0`).
- **Validación y contratos:** `zod` (`^4.6.7`) y `@scaccess/shared` (`*`).
- **Tipado y pruebas:** `typescript` (`^5.9.3`) y `vitest` (`^5.0.5`, entorno `node`).

## Estructura del workspace

```text
apps/mobile/
├── .env.example                       # Plantilla de variables públicas EXPO_PUBLIC_*
├── App.tsx                            # Proveedores raíz (SafeAreaProvider, ThemeProvider, AuthProvider)
├── README.md                          # Documentación de la app móvil
├── app.json                           # Configuración de Expo (Accesa Móvil, automatic, icon y splash)
├── babel.config.js                    # Preset babel-preset-expo
├── index.ts                           # Registro del componente raíz con Expo
├── metro.config.js                    # Resolución del monorepo para @scaccess/shared
├── package.json                       # Dependencias y scripts de @scaccess/mobile
├── tsconfig.json                      # Configuración estricta de TypeScript
├── vitest.config.ts                   # Configuración de Vitest (entorno node)
├── assets/                            # Recursos PNG de marca Accesa (íconos 1024x1024 y variantes claro/oscuro)
│   ├── adaptive-icon.png
│   ├── app-icon.png
│   ├── isotipo.png
│   ├── isotipo_oscuro_transparente.png
│   ├── logo_accesa_fondo_blanco.png
│   └── logo_accesa_fondo_blanco_oscuro_transparente.png
├── src/
│   ├── api/
│   │   ├── MobileApiError.ts          # Clase de error HTTP/red normalizada
│   │   ├── accessEventsApi.ts         # listMyAccessEvents() y getMyAccessEventById()
│   │   ├── authApi.ts                 # getMe() -> UserAccountDto
│   │   └── httpClient.ts              # apiFetch() con Bearer token, timeout 35s y MobileApiError
│   ├── components/
│   │   ├── DecisionBadge.tsx          # Insignia "Acceso permitido" / "Acceso denegado"
│   │   ├── EmptyState.tsx             # Estado vacío o error con botón de reintentar
│   │   ├── EventListItem.tsx          # Tarjeta resumen de un evento en el historial
│   │   ├── HistorySkeleton.tsx        # Esqueleto de carga inicial para el historial
│   │   ├── HistorySummaryCard.tsx     # Tarjeta con resumen de actividad del historial
│   │   └── ThemeToggleButton.tsx      # Selector manual entre modo claro y oscuro
│   ├── config/
│   │   ├── env.ts                     # Validación Zod de variables EXPO_PUBLIC_* y valores por defecto
│   │   ├── storage.ts                 # Adaptador multiplataforma SecureStore (móvil) / localStorage (web)
│   │   └── supabase.ts                # Cliente Supabase Auth con adaptador appStorage
│   ├── context/
│   │   ├── AuthContext.tsx            # Estado global de sesión (loading, signedOut, unsupported, signedIn)
│   │   └── ThemeContext.tsx           # Tema claro/oscuro sincronizado con el sistema y persistente
│   ├── navigation/
│   │   ├── AppNavigator.tsx           # Pila nativa adaptada al tema activo y pantalla de carga
│   │   └── types.ts                   # Contrato de rutas RootStackParamList
│   ├── screens/
│   │   ├── AccessEventDetailScreen.tsx  # Detalle con RefreshControl y banner de error en revalidación
│   │   ├── AccessHistoryScreen.tsx      # Historial paginado con tarjetas separadas y errores visibles
│   │   ├── LoginScreen.tsx              # Login con wordmark claro/oscuro, validación y mostrar contraseña
│   │   └── UnsupportedAccountScreen.tsx # Bloqueo informativo para cuentas sin employeeId
│   ├── theme/
│   │   ├── brandAssets.ts             # Selector de los 4 PNG claro/oscuro de Accesa
│   │   └── colors.ts                  # Tokens claro/oscuro, espaciado, radios y resolveThemeMode()
│   ├── types/
│   │   └── assets.d.ts                # Declaración TypeScript para imports *.png
│   └── utils/
│       ├── accessHistory.ts           # Agrupación diaria, resumen y cálculo de desfase offline
│       ├── areaLabels.ts              # Etiquetas de decisión, motivos y las 6 áreas registradas
│       ├── confirmAction.ts           # Diálogo de confirmación multiplataforma (Alert / confirm)
│       ├── errorMessages.ts           # Traducción uniforme de errores Auth, historial y detalle
│       ├── eventReceipt.ts            # Formato de comprobante compartible del evento
│       ├── formatters.ts              # Formato de UID RFID y fechas/horas en America/Tijuana
│       └── validation.ts              # Validación de correo y contraseña en LoginScreen
└── tests/
    ├── accessEventsApi.test.ts        # Pruebas de listMyAccessEvents y getMyAccessEventById
    ├── accessHistory.test.ts          # Pruebas de agrupación diaria, resumen y desfase offline
    ├── areaLabels.test.ts             # Pruebas de etiquetas y las 6 áreas
    ├── authApi.test.ts                # Pruebas de getMe (/auth/me)
    ├── brandAssets.test.ts            # Pruebas de selección de logos claro/oscuro
    ├── env.test.ts                    # Pruebas de variables de entorno
    ├── errorMessages.test.ts          # Pruebas de toSignInMessage, toHistoryError y toDetailError
    ├── eventReceipt.test.ts           # Pruebas de buildEventReceiptMessage
    ├── formatters.test.ts             # Pruebas de UID y formato horario
    ├── httpClient.test.ts             # Pruebas de apiFetch (sesión, 200, error HTTP, timeout y red)
    ├── storage.test.ts                # Pruebas de createKeyValueStorage (iOS/Android/web)
    ├── theme.test.ts                  # Pruebas de resolveThemeMode y paletas claro/oscuro
    └── validation.test.ts             # Pruebas de validateLoginForm
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
