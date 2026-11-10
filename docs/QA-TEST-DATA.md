# Catálogo de Datos de Prueba (QA) — Sistema de Control de Acceso

Documento temporal de referencia para los equipos de **Web Administrativa**, **App Móvil** y **Controlador Físico (ESP32-S3)**. Todos los registros listados aquí ya existen en la base de datos de **Supabase PostgreSQL** y están disponibles a través de la API en **Render**.

---

## 1. Entorno y URLs Base

| Recurso | Valor |
| :--- | :--- |
| **API Base URL (Render)** | `https://scaccess-api.onrender.com/api/v1` |
| **Health Check** | `https://scaccess-api.onrender.com/api/v1/health` |
| **Swagger UI (Interactivo)** | `https://scaccess-api.onrender.com/api/v1/docs` |
| **Especificación OpenAPI 3.1** | `https://scaccess-api.onrender.com/api/v1/openapi.json` |
| **Supabase Project URL (`SUPABASE_URL`)** | `https://vomjmyqxbqgndndvpaqb.supabase.co` |
| **Zona Horaria Base** | `America/Tijuana` |

> **Nota sobre Render Free:** El servicio se suspende tras 15 minutos de inactividad. La primera petición después de estar inactivo (*cold start*) toma ~12–30 segundos; las siguientes responden en ~150–400 ms.

---

## 2. Cuentas de Usuario para Login (Supabase Auth + `user_accounts`)

Para iniciar sesión desde la **Web Administrativa** o la **App Móvil**, autentica contra Supabase Auth (`supabase.auth.signInWithPassword({ email, password })` o `POST ${SUPABASE_URL}/auth/v1/token?grant_type=password`) y envía el `access_token` obtenido en el header `Authorization: Bearer <access_token>` a la API.

| Perfil | Email | Contraseña | Rol (`roles.code`) | Estado | `user_accounts.id` | `auth_user_id` (Supabase) | `employeeId` vinculado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Administrador (Web)** | `admin.qa@scaccess.local` | `QaAccess!2026#Admin` | `admin` | `active` | `1c80be2b-f012-436a-ba48-14d82cfbb555` | `53f47b59-d04c-4c31-830b-e9433a669e8f` | `null` |
| **Empleado (App Móvil)** | `employee.qa@scaccess.local` | `QaAccess!2026#Employee` | `employee` | `active` | `aefe89ff-37e9-424f-a89d-ebc21c561052` | `1dc29dbc-daea-4845-b9b9-0352e9d42aa6` | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` |

- La cuenta **Administrador** tiene acceso completo a los endpoints administrativos (`/employees`, `/credentials`, `/areas`, `/access-permissions`, `/access-devices`, `/access-events`, `/users`, `/roles`, `/dashboard/summary`).
- La cuenta **Empleado** está vinculada al empleado `EMP-QA-001` y sirve para probar la **App Móvil**: puede consultar `/api/v1/auth/me` y `/api/v1/me/access-events`, y recibe `403 FORBIDDEN` si intenta consultar rutas administrativas como `/api/v1/employees`.

---

## 3. Catálogo de Roles (`roles`)

| Código (`code`) | Nombre (`name`) | Rol de Sistema (`isSystem`) | Uso |
| :--- | :--- | :---: | :--- |
| `admin` | Administrador | `true` | Acceso total a la administración del sistema |
| `operator` | Operador | `true` | Gestión de empleados, tarjetas, permisos y dispositivos |
| `auditor` | Auditor | `true` | Consulta de historial de accesos y reportes |
| `employee` | Empleado | `false` | Rol no administrativo para cuentas móviles de empleados |

---

## 4. Áreas Registradas (`areas`)

| ID (`id`) | Código (`code`) | Nombre (`name`) | Descripción | Activa (`isActive`) | Zona Horaria (`timezone`) |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `8a983ee5-b312-454b-b51b-f53a79ea62ae` | `MAIN_ENTRANCE` | Acceso Principal | Entrada principal de la instalacion | `true` | `America/Tijuana` |
| `b56485d7-1826-435a-b242-701750f87da5` | `LAB_ELECTRONICS` | Laboratorio de Electronica | Laboratorio de electronica | `true` | `America/Tijuana` |
| `24abc3d9-6558-4c79-878a-8a662622d17c` | `QA_TEST_AREA` | Area de Pruebas QA | Area creada por el E2E de Render | `true` | `America/Tijuana` |

---

## 5. Empleados Registrados (`employees`)

| ID (`id`) | Código (`employeeCode`) | Nombre (`firstName`) | Apellido (`lastName`) | Email (`email`) | Departamento | Puesto | Estado (`status`) | Cuenta Móvil |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` | `EMP-QA-001` | Empleado | QA Movil | `employee.qa@scaccess.local` | Calidad | QA Engineer | `active` | Sí (`employee.qa@scaccess.local`) |
| `d106f1db-c260-4726-8ecb-eef199934336` | `EMP-QA-002` | Empleado | QA Dos | `employee.qa2@scaccess.local` | Calidad | QA Analyst | `active` | Sin cuenta móvil vinculada |

---

## 6. Tarjetas RFID (`credentials`)

| ID (`id`) | UID de Tarjeta (`cardUid`) | Etiqueta (`label`) | Empleado Asignado (`employeeId`) | Código Empleado | Estado (`status`) | Fecha de Emisión (`issuedAt`) |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `cbc7fefd-bd56-4e24-8509-811198a2fe13` | `04A1B2C3D4E5F6` | Tarjeta RFID QA | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` | `EMP-QA-001` | `active` | `2026-11-10T02:43:04.792Z` |

---

## 7. Permisos de Acceso (`access_permissions`)

| ID (`id`) | Empleado (`employeeId`) | Área (`areaId`) | Vigencia (`validFrom` / `validTo`) | Horario (`schedule`) | Revocado (`revokedAt`) | Otorgado por (`grantedById`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `1ebf0561-06c2-4e74-abe8-0d6d3aed0cb3` | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` (`EMP-QA-001`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) | Permanente (`null` / `null`) | Sin restricción (`null`) | Activo (`null`) | `1c80be2b-f012-436a-ba48-14d82cfbb555` (`admin.qa`) |

---

## 8. Dispositivos Físicos (`access_devices` y `device_credentials`)

| Campo | Valor |
| :--- | :--- |
| **ID del Dispositivo (`id`)** | `282b937e-2b0a-4d4c-a61c-fe00116a8441` |
| **Código (`deviceCode`)** | `ESP32-QA-01` |
| **Nombre (`name`)** | `ESP32-S3 QA Device` |
| **Ubicación (`location`)** | `Laboratorio QA` |
| **Modelo / Firmware** | `ESP32-S3` / `qa-1.0.0` |
| **Estado (`status`)** | `active` |
| **Área Asociada (`areaIds`)** | `["8a983ee5-b312-454b-b51b-f53a79ea62ae"]` (`MAIN_ENTRANCE`) |
| **Versión de Configuración (`configVersion`)** | `"1"` |
| **Credencial Activa (`device_credentials.id`)** | `5d8debc1-c4ad-472d-aa0f-5bc34f7c748b` (`tokenId: "devtok_1ef0a0efe1085f1c"`) |

> **Nota:** El secreto completo (`<tokenId>.<secret>`) solo se devuelve una vez al emitir la credencial por seguridad. Para probar sincronización de dispositivos desde cero, un Admin puede emitir un nuevo token con:
> `POST /api/v1/access-devices/282b937e-2b0a-4d4c-a61c-fe00116a8441/credentials`

---

## 9. Eventos de Acceso Registrados (`access_events`)

Ya existen **2 eventos de prueba** cargados en el historial para probar tanto el listado general en la **Web Administrativa** (`/api/v1/access-events` y `/api/v1/dashboard/summary`) como el historial personal en la **App Móvil** (`/api/v1/me/access-events`):

| ID (`id`) | `clientEventId` | Tarjeta (`cardUid`) | Empleado (`employeeId`) | Área (`areaId`) | Decisión (`decision`) | Motivo (`reasonCode`) | Ocurrido (`occurredAt`) | Visible para `EMP-QA-001` en Móvil |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| `53a91762-8765-4006-b304-ea2b2cdbf43e` | `qa-20261110024258-allowed-1` | `04A1B2C3D4E5F6` | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` (`EMP-QA-001`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) | `granted` | `allowed` | `2026-11-10T02:41:08.016Z` | **Sí** |
| `1a6807e4-676d-4d59-9f9a-30dc75960be5` | `qa-20261110024258-denied-1` | `99999999` *(desconocida)* | `null` | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) | `denied` | `card_unknown` | `2026-11-10T02:42:08.016Z` | **No** *(solo visible en Web Admin)* |
