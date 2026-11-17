# Guía de Desarrollo — Aplicación Móvil (`apps/mobile`)

Esta guía define la arquitectura, contratos, flujo de autenticación, pantallas y convenciones que debe seguir el equipo encargado de desarrollar la aplicación móvil del **Sistema de Control de Acceso** en `apps/mobile`.

---

## 1. Alcance y Reglas de Negocio

La aplicación móvil está dirigida **exclusivamente a empleados** para consultar su propio historial de accesos.

| Regla | Detalle |
| :--- | :--- |
| **Usuarios objetivo** | Empleados con cuenta activa y vinculada a un registro de empleado (`employeeId !== null`). |
| **Funcionalidades incluidas** | 1. Inicio y cierre de sesión.<br>2. Perfil básico de sesión (`/api/v1/auth/me`).<br>3. Historial personal paginado (`/api/v1/me/access-events`).<br>4. Detalle de cada evento propio (`/api/v1/me/access-events/:id`). |
| **Restricciones de seguridad** | Un empleado **nunca** puede ver eventos de otro empleado ni acceder a funciones administrativas. Si inicia sesión una cuenta sin `employeeId` (por ejemplo, un administrador puro), la app debe mostrar una pantalla informativa e impedir el acceso. |
| **Conectividad** | **Requiere Internet.** Solo el controlador físico ESP32-S3 es *offline-first*; la app móvil no implementa base de datos offline. |
| **Convención de idioma** | **Interfaz de usuario (UI) y mensajes al usuario en español.** Identificadores de código (variables, componentes, hooks, tipos, archivos) en **inglés**. |

> **Nota sobre Cold Start en Render Free:** La API en `https://scaccess-api.onrender.com` entra en suspensión tras 15 minutos sin actividad. La primera petición puede tardar entre **12 y 30 segundos**. Configura un `timeout` de al menos `35000 ms` en el cliente HTTP y muestra un indicador en pantalla (*"Conectando con el servidor..."*) cuando una petición supere los 3 segundos.

---

## 2. Stack Tecnológico Confirmado

- **Framework:** React Native + **Expo** (managed workflow con TypeScript estricto).
- **Navegación:** Expo Router (basado en archivos) o React Navigation Native Stack.
- **Autenticación:** `@supabase/supabase-js` + `expo-secure-store` (almacenamiento cifrado de sesión) + `react-native-url-polyfill`.
- **Contratos compartidos:** `@scaccess/shared` (consumido directamente desde el monorepo).
- **Validación:** `zod` (para variables de entorno o respuestas si se requiere).

> **Importante:** Respeta las reglas de `AGENTS.md`: no agregues librerías pesadas de estado global (como Redux) ni clientes de caché complejos si `useState`/`useCallback` o un contexto ligero resuelven el alcance de las pantallas. Justifica cualquier dependencia nueva.

---

## 3. Entorno, Variables y Credenciales de Prueba (QA)

### 3.1 Archivo `apps/mobile/.env` (no versionar en Git)

Expo carga automáticamente variables con el prefijo `EXPO_PUBLIC_`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://scaccess-api.onrender.com/api/v1
EXPO_PUBLIC_SUPABASE_URL=https://vomjmyqxbqgndndvpaqb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_wtHSrYnWHPT5T2yBvcXuxA_yQkTD4Ln
```

> **Precaución:** **Nunca** incluyas `SUPABASE_SERVICE_ROLE_KEY` ni `DATABASE_URL` en la app móvil. Todo el código de `apps/mobile` se empaqueta en el binario del teléfono y solo debe usar la clave pública (`EXPO_PUBLIC_SUPABASE_ANON_KEY`).

### 3.2 Usuarios de Prueba Listos en Render / Supabase

Consulta el catálogo completo en `docs/QA-TEST-DATA.md`.

| Caso de prueba | Email | Contraseña | `employeeId` | Resultado esperado en la App Móvil |
| :--- | :--- | :--- | :--- | :--- |
| **Flujo normal (Empleado)** | `employee.qa@scaccess.local` | `QaAccess!2026#Employee` | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` (`EMP-QA-001`) | Login exitoso, acceso a su historial personal (`200 OK`). |
| **Cuenta sin empleado vinculado (Admin)** | `admin.qa@scaccess.local` | `QaAccess!2026#Admin` | `null` | Login en Supabase válido, pero `/auth/me` devuelve `employeeId: null` y `/me/access-events` responde `403 FORBIDDEN`. Mostrar pantalla de *"Esta cuenta no tiene un perfil de empleado vinculado"* con botón de cerrar sesión. |

---

## 4. Flujo de Autenticación y Arquitectura de Comunicación

1. El usuario ingresa su correo y contraseña en `LoginScreen`.
2. La app llama a `supabase.auth.signInWithPassword({ email, password })`.
3. `expo-secure-store` persiste la sesión (`access_token` y `refresh_token`) de forma cifrada en el dispositivo.
4. La app consulta `GET /api/v1/auth/me` enviando `Authorization: Bearer <access_token>`.
5. Si `userAccount.employeeId === null`, se muestra `UnsupportedAccountScreen` explicando que la cuenta es administrativa y no tiene historial de empleado asociado.
6. Si `userAccount.employeeId !== null`, se navega a `AccessHistoryScreen` (`GET /api/v1/me/access-events?page=1&pageSize=20`).
7. Al seleccionar un evento de la lista, se navega a `AccessEventDetailScreen` (`GET /api/v1/me/access-events/:id`).

---

## 5. Contratos de API para la App Móvil

Todos los tipos ya están declarados en `packages/shared/src/index.ts`:

```ts
import type {
  AccessDecision,
  AccessEventDto,
  AccessReason,
  ApiErrorBody,
  PaginatedResponse,
  UserAccountDto,
} from '@scaccess/shared'
```

### 5.1 `GET /api/v1/auth/me`
Valida el token contra el backend, actualiza `lastLoginAt` y devuelve la cuenta del usuario.

- **Headers:** `Authorization: Bearer <supabase_access_token>`
- **Respuesta `200 OK` (`UserAccountDto`):**
  ```json
  {
    "id": "aefe89ff-37e9-424f-a89d-ebc21c561052",
    "authUserId": "1dc29dbc-daea-4845-b9b9-0352e9d42aa6",
    "employeeId": "a2bd1126-20b0-455b-83a2-4f3b9f4813ef",
    "email": "employee.qa@scaccess.local",
    "status": "active",
    "roles": ["employee"],
    "lastLoginAt": "2026-11-10T02:43:14.000Z",
    "createdAt": "2026-11-10T02:42:58.000Z",
    "updatedAt": "2026-11-10T02:43:14.000Z"
  }
  ```
- **Errores posibles:**
  - `401 UNAUTHORIZED`: token ausente, inválido o expirado.
  - `403 FORBIDDEN`: cuenta con `status !== 'active'`.
  - `404 NOT_FOUND`: el usuario existe en Supabase Auth pero no tiene registro en `user_accounts`.

### 5.2 `GET /api/v1/me/access-events`
Devuelve el historial de accesos del empleado autenticado ordenado por `occurredAt` descendente (más reciente primero).

- **Query params opcionales:**
  - `page`: entero >= 1 (por defecto `1`)
  - `pageSize`: entero entre `1` y `100` (por defecto `20`)
- **Respuesta `200 OK` (`PaginatedResponse<AccessEventDto>`):**
  ```json
  {
    "data": [
      {
        "id": "53a91762-8765-4006-b304-ea2b2cdbf43e",
        "deviceId": "282b937e-2b0a-4d4c-a61c-fe00116a8441",
        "clientEventId": "qa-20261110024258-allowed-1",
        "deviceEpoch": "epoch-qa-1",
        "cardUid": "04A1B2C3D4E5F6",
        "employeeId": "a2bd1126-20b0-455b-83a2-4f3b9f4813ef",
        "credentialId": "cbc7fefd-bd56-4e24-8509-811198a2fe13",
        "areaId": "8a983ee5-b312-454b-b51b-f53a79ea62ae",
        "decision": "granted",
        "reasonCode": "allowed",
        "occurredAt": "2026-11-10T02:41:08.016Z",
        "receivedAt": "2026-11-10T02:43:11.611Z",
        "deviceSequence": "1",
        "metadata": { "source": "opencode-e2e-qa" },
        "createdAt": "2026-11-10T02:43:11.611Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
  ```
- **Errores posibles:**
  - `401 UNAUTHORIZED`: sin sesión válida.
  - `403 FORBIDDEN`: `"Employee account required"` si `employeeId === null`.

### 5.3 `GET /api/v1/me/access-events/:id`
Devuelve el detalle de un evento específico perteneciente al empleado autenticado.

- **Parámetros de ruta:** `id` (UUID del evento).
- **Respuesta `200 OK`:** `AccessEventDto`.
- **Errores posibles:**
  - `404 NOT_FOUND`: el evento no existe o pertenece a otro empleado (el backend devuelve `404` en ambos casos para evitar enumeración).

### 5.4 Formato Uniforme de Error (`ApiErrorBody`)
Cualquier error HTTP del backend sigue esta estructura:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Employee account required",
    "details": []
  }
}
```

> **Nota sobre `areaId` y `deviceId` en `AccessEventDto`:** Los endpoints `/api/v1/areas` y `/api/v1/access-devices` requieren rol administrativo (`admin`, `operator` o `auditor`). Por lo tanto, la app móvil recibe `areaId` y `deviceId` dentro de `AccessEventDto`. Para mostrar nombres amigables en el prototipo, incluye un mapa de áreas conocidas (`KNOWN_AREA_NAMES`) con fallback al identificador abreviado (ver sección 7.3).

---

## 6. Estructura Recomendada para `apps/mobile`

```text
apps/mobile/
├── app.json
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── config/
    │   ├── env.ts                  # Lectura y validación de EXPO_PUBLIC_*
    │   └── supabase.ts             # Instancia de Supabase Auth con SecureStore
    ├── api/
    │   ├── httpClient.ts           # Wrapper de fetch con Bearer token y manejo de errores
    │   ├── authApi.ts              # getMe() -> UserAccountDto
    │   └── accessEventsApi.ts      # listMyAccessEvents(), getMyAccessEventById()
    ├── context/
    │   └── AuthContext.tsx         # Estado de sesión, perfil UserAccountDto, login/logout
    ├── screens/
    │   ├── LoginScreen.tsx         # Formulario de correo y contraseña
    │   ├── UnsupportedAccountScreen.tsx # Aviso si employeeId === null
    │   ├── AccessHistoryScreen.tsx # Lista paginada con pull-to-refresh y carga infinita
    │   └── AccessEventDetailScreen.tsx # Detalle completo de un evento
    ├── components/
    │   ├── EventListItem.tsx       # Tarjeta resumen de evento (área, fecha, badge)
    │   ├── DecisionBadge.tsx       # Badge verde "Permitido" / rojo "Denegado"
    │   └── EmptyState.tsx          # Estado vacío o error con botón de reintentar
    └── utils/
        ├── formatters.ts           # Formateo de fechas (America/Tijuana) y etiquetas en español
        └── areaLabels.ts           # Mapeo de áreas y motivos (AccessReason) al español
```

---

## 7. Piezas Clave de Implementación (Código de Referencia)

### 7.1 Cliente de Supabase con `expo-secure-store` (`src/config/supabase.ts`)

```ts
import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'
import { env } from './env'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.removeItemAsync(key),
}

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

### 7.2 Cliente HTTP con Token de Supabase y Timeout (`src/api/httpClient.ts`)

```ts
import type { ApiErrorBody } from '@scaccess/shared'
import { env } from '../config/env'
import { supabase } from '../config/supabase'

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'MobileApiError'
  }
}

const REQUEST_TIMEOUT_MS = 35_000 // Contempla cold start de Render Free

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new MobileApiError(401, 'UNAUTHORIZED', 'Sesión expirada. Inicia sesión nuevamente.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${env.API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...init?.headers,
      },
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null
      throw new MobileApiError(
        response.status,
        errorBody?.error.code ?? 'UNKNOWN_ERROR',
        errorBody?.error.message ?? `Error HTTP ${response.status}`,
      )
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}
```

### 7.3 Traducciones de Dominio al Español (`src/utils/areaLabels.ts`)

```ts
import type { AccessDecision, AccessReason } from '@scaccess/shared'

export const DECISION_LABELS: Record<AccessDecision, string> = {
  granted: 'Acceso permitido',
  denied: 'Acceso denegado',
}

export const REASON_LABELS: Record<AccessReason, string> = {
  allowed: 'Autorizado',
  card_unknown: 'Tarjeta no reconocida',
  card_blocked: 'Tarjeta bloqueada',
  card_lost: 'Tarjeta reportada como extraviada',
  card_retired: 'Tarjeta retirada',
  employee_inactive: 'Empleado inactivo',
  permission_missing: 'Sin permiso para el área',
  permission_expired: 'Permiso vencido',
  permission_outside_schedule: 'Fuera de horario permitido',
  area_not_allowed: 'Área no autorizada en dispositivo',
  area_inactive: 'Área inactiva',
  device_error: 'Error del lector físico',
}

export const KNOWN_AREA_NAMES: Record<string, string> = {
  '8a983ee5-b312-454b-b51b-f53a79ea62ae': 'Acceso Principal (MAIN_ENTRANCE)',
  'b56485d7-1826-435a-b242-701750f87da5': 'Laboratorio de Electrónica (LAB_ELECTRONICS)',
  '24abc3d9-6558-4c79-878a-8a662622d17c': 'Área de Pruebas QA (QA_TEST_AREA)',
}

export function getAreaDisplayName(areaId: string): string {
  return KNOWN_AREA_NAMES[areaId] ?? `Área ${areaId.slice(0, 8)}`
}
```

---

## 8. Diseño de Pantallas y Estados de UI

### 8.1 Pantalla de Inicio de Sesión (`LoginScreen`)
- **Campos:** Correo electrónico (`keyboardType="email-address"`, `autoCapitalize="none"`) y Contraseña (`secureTextEntry`).
- **Acción:** Llama a `supabase.auth.signInWithPassword({ email, password })` y enseguida consulta `GET /api/v1/auth/me`.
- **Estados:**
  - Botón deshabilitado con `ActivityIndicator` mientras autentica.
  - Si tarda más de 3 segundos en `/api/v1/auth/me`, mostrar texto secundario: *"Despertando servidor de pruebas, esto puede tomar unos segundos..."*.
  - Mensajes de error claros en español (credenciales inválidas, cuenta deshabilitada o sin conexión a Internet).

### 8.2 Pantalla de Historial Personal (`AccessHistoryScreen`)
- **Cabecera:** Correo del empleado autenticado y botón de **Cerrar sesión**.
- **Lista (`FlatList`):**
  - Soporta **Pull-to-Refresh** (`onRefresh` recarga `page = 1`).
  - Soporta **Paginación incremental** (`onEndReached` carga `page + 1` si `page < totalPages`).
- **Cada elemento (`EventListItem`) muestra:**
  - Nombre del área (`getAreaDisplayName(item.areaId)`).
  - Fecha y hora del evento físico (`occurredAt` formateado en zona horaria `America/Tijuana`).
  - Badge visual de resultado (`Acceso permitido` en verde / `Acceso denegado` en rojo).
  - Motivo en español (`REASON_LABELS[item.reasonCode]`).
- **Al tocar un elemento:** Navega a `AccessEventDetailScreen` pasando el `id` (o el objeto inicial mientras revalida `GET /api/v1/me/access-events/:id`).

### 8.3 Pantalla de Detalle de Evento (`AccessEventDetailScreen`)
Muestra todos los datos relevantes de `AccessEventDto`:
- **Resultado:** Decisión (`granted`/`denied`) y motivo (`reasonCode`) en español.
- **Área:** Nombre del área e identificador.
- **Fecha y hora de lectura física (`occurredAt`):** Momento exacto en que se pasó la tarjeta en el lector RC522.
- **Fecha y hora de sincronización (`receivedAt`):** Momento en que el ESP32-S3 reportó el evento al servidor (útil para evidenciar la operación *offline-first* del dispositivo).
- **Tarjeta RFID utilizada (`cardUid`):** Ejemplo `04A1B2C3D4E5F6`.
- **Identificador de evento (`clientEventId`):** Para trazabilidad técnica.

---

## 9. Integración con el Monorepo (`npm workspaces`)

El archivo raíz `package.json` ya declara `"workspaces": ["apps/*", "packages/*"]`. Cuando el equipo inicialice `apps/mobile/package.json`, debe usar el nombre `@scaccess/mobile` e incluir los scripts requeridos por el monorepo para no romper el pipeline:

```json
{
  "name": "@scaccess/mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@scaccess/shared": "*"
  }
}
```

> **Tip sobre Metro en Monorepo:** En Expo SDK 52+, `expo/metro-config` detecta automáticamente la raíz del monorepo (`packages/shared`). Asegúrate de ejecutar `npm run build` en la raíz al menos una vez para que `@scaccess/shared` tenga su carpeta `dist/` generada.

---

## 10. Checklist de Verificación Antes de Abrir Pull Request

1. **Rama de trabajo:** Crear una rama dedicada (por ejemplo `feat/mobile-app`) desde la base acordada; **nunca** trabajar directamente sobre `main`.
2. **Validación funcional con datos QA:**
   - Iniciar sesión con `employee.qa@scaccess.local` / `QaAccess!2026#Employee`.
   - Comprobar que aparece el evento permitido `53a91762-8765-4006-b304-ea2b2cdbf43e` en `Acceso Principal` con tarjeta `04A1B2C3D4E5F6`.
   - Comprobar que **no** aparece el evento denegado de tarjeta desconocida (`1a6807e4-676d-4d59-9f9a-30dc75960be5`).
   - Abrir el detalle del evento y verificar `occurredAt` vs `receivedAt`.
   - Cerrar sesión e iniciar con `admin.qa@scaccess.local` para verificar que la app bloquea el acceso por no tener `employeeId` vinculado.
3. **Verificación de calidad desde la raíz del monorepo:**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```
