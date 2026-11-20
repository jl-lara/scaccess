# Catálogo de Datos de Prueba (QA) — Sistema de Control de Acceso

Documento temporal de referencia para los equipos de **Web Administrativa**, **App Móvil** y **Controlador Físico (ESP32-S3)**. Todos los registros listados aquí ya existen en la base de datos de **Supabase PostgreSQL** y están disponibles a través de la API en **Render**.

> **Última carga:** 10 de noviembre de 2026, ~21:15 (America/Tijuana) / 11 de noviembre de 2026, 05:15 UTC.
> **Alcance de esta carga:** 3 áreas nuevas, 6 empleados nuevos, 8 tarjetas RFID nuevas, 16 permisos activos, 2 controladores ESP32-S3 nuevos y 24 eventos de acceso nuevos (entradas, salidas y denegaciones). Las fechas de los eventos se muestran en UTC; en America/Tijuana (UTC-8) corresponden a la tarde/noche del 10 de noviembre.

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

### Resumen de la carga

| Entidad | Total | Detalle |
| :--- | :---: | :--- |
| Áreas | **6** | 3 preexistentes (`MAIN_ENTRANCE`, `LAB_ELECTRONICS`, `QA_TEST_AREA`) + 3 nuevas (`SERVER_ROOM`, `ADMIN_OFFICES`, `WAREHOUSE_RFID`) |
| Empleados | **8** | 7 `active` + 1 `suspended` (`EMP-UTT-008`) |
| Tarjetas RFID | **9** | 8 `active` + 1 `blocked` (`04B1C2D3E4F508`) |
| Permisos activos | **16** | Todos sin vigencia límite ni restricción horaria |
| Dispositivos | **3** | 2 sincronizados + 1 pendiente de sincronizar (`ESP32-PLANTA-03`) |
| Eventos de acceso | **26** | 24 nuevos + 2 preexistentes; 20 `granted` y 6 `denied` |

---

## 2. Cuentas de Usuario para Login (Supabase Auth + `user_accounts`)

Para iniciar sesión desde la **Web Administrativa** o la **App Móvil**, autentica contra Supabase Auth (`supabase.auth.signInWithPassword({ email, password })` o `POST ${SUPABASE_URL}/auth/v1/token?grant_type=password`) y envía el `access_token` obtenido en el header `Authorization: Bearer <access_token>` a la API.

| Perfil | Email | Contraseña | Rol (`roles.code`) | Estado | `user_accounts.id` | `auth_user_id` (Supabase) | `employeeId` vinculado | Alcance esperado en consola web / app |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Administrador (Web)** | `admin.qa@scaccess.local` | `QaAccess!2026#Admin` | `admin` | `active` | `1c80be2b-f012-436a-ba48-14d82cfbb555` | `53f47b59-d04c-4c31-830b-e9433a669e8f` | `null` | Acceso completo: dashboard, empleados, tarjetas RFID, áreas, permisos, dispositivos/credenciales, historial, usuarios y roles. |
| **Operador (Web)** | `operator.qa@scaccess.local` | `QaAccess!2026#Operator` | `operator` | `active` | `fad14303-bbc1-40e8-9152-255b516986f0` | `2c210164-e093-47fe-8c52-78166ca2cc92` | `null` | Gestión de empleados, tarjetas RFID y permisos; lectura de dashboard, áreas, dispositivos e historial. Sin usuarios/roles ni administración de áreas o credenciales de dispositivo. |
| **Auditor (Web)** | `auditor.qa@scaccess.local` | `QaAccess!2026#Auditor` | `auditor` | `active` | `4a2ed354-8500-4551-8831-295be0ba55cb` | `318fcf18-a8f1-435a-b3c1-0f0eeaed93d5` | `null` | Solo lectura y reportes: dashboard, croquis de áreas, catálogos operativos (empleados, tarjetas, áreas, permisos, dispositivos) e historial de accesos con exportación. Sin escritura ni usuarios/roles. |
| **Monitor (Web)** | `monitor.qa@scaccess.local` | `QaAccess!2026#Monitor` | `viewer` | `active` | `a8a58da6-0226-48b0-9736-4418f9e2cb46` | `1ab00060-b013-4179-957b-e94d03339f06` | `null` | Monitoreo en vivo de solo lectura: panel (dashboard), bitácora y croquis de áreas, sin exportación ni acceso a catálogos o usuarios/roles. |
| **Empleado (App Móvil)** | `employee.qa@scaccess.local` | `QaAccess!2026#Employee` | `employee` | `active` | `aefe89ff-37e9-424f-a89d-ebc21c561052` | `1dc29dbc-daea-4845-b9b9-0352e9d42aa6` | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` | Cuenta móvil vinculada a `EMP-QA-001` (`/api/v1/auth/me` y `/api/v1/me/access-events`); sin acceso a consola web (`403 FORBIDDEN` en rutas administrativas). |

- Las 4 cuentas web QA (`admin`, `operator`, `auditor`, `viewer`) no están vinculadas a un empleado (`employeeId: null`).
- La cuenta **Administrador** tiene acceso completo a todos los endpoints administrativos (`/employees`, `/credentials`, `/areas`, `/access-permissions`, `/access-devices`, `/access-events`, `/users`, `/roles`, `/dashboard/summary`).
- La cuenta **Empleado** está vinculada al empleado `EMP-QA-001` y sirve para probar la **App Móvil**: puede consultar `/api/v1/auth/me` y `/api/v1/me/access-events`, y recibe `403 FORBIDDEN` si intenta consultar rutas administrativas como `/api/v1/employees`.
- Los nuevos empleados `EMP-UTT-*` **no tienen cuenta móvil**; solo existen como registros de empleado para pruebas administrativas y de dispositivos.

---

## 3. Catálogo de Roles (`roles`)

| Código (`code`) | Nombre (`name`) | Rol de Sistema (`isSystem`) | Uso |
| :--- | :--- | :---: | :--- |
| `admin` | Administrador | `true` | Acceso total a la administración del sistema |
| `operator` | Operador | `true` | Gestión de empleados, tarjetas, permisos y dispositivos |
| `auditor` | Auditor | `true` | Consulta de historial de accesos y reportes |
| `viewer` | Monitor | `true` | Monitoreo en vivo de panel, bitácora y croquis de áreas sin exportación ni catálogos |
| `employee` | Empleado | `false` | Rol no administrativo para cuentas móviles de empleados |

---

## 4. Áreas Registradas (`areas`)

| ID (`id`) | Código (`code`) | Nombre (`name`) | Descripción | Activa (`isActive`) | Zona Horaria (`timezone`) |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `c89c95b3-0394-459f-b620-6d1b7281e76f` | `ADMIN_OFFICES` | Oficinas Administrativas | Oficinas administrativas, direccion y recursos humanos | `true` | `America/Tijuana` |
| `b56485d7-1826-435a-b242-701750f87da5` | `LAB_ELECTRONICS` | Laboratorio de Electronica | Laboratorio de electronica | `true` | `America/Tijuana` |
| `8a983ee5-b312-454b-b51b-f53a79ea62ae` | `MAIN_ENTRANCE` | Acceso Principal | Entrada principal de la instalacion | `true` | `America/Tijuana` |
| `24abc3d9-6558-4c79-878a-8a662622d17c` | `QA_TEST_AREA` | Area de Pruebas QA | Area creada por el E2E de Render | `true` | `America/Tijuana` |
| `3c4a92ce-a31e-42cb-88f4-bbf468d5067b` | `SERVER_ROOM` | Centro de Datos y Servidores | Centro de datos, rack de servidores y telecomunicaciones | `true` | `America/Tijuana` |
| `5d4b72a4-acaa-42e3-93b7-9dfcad985f5b` | `WAREHOUSE_RFID` | Almacen General y Logistica | Almacen general, logistica, anden de carga y recepcion de suministros | `true` | `America/Tijuana` |

Las 6 áreas están activas y disponibles para asignar permisos y dispositivos. El Croquis de Áreas usa `MAIN_ENTRANCE`, `LAB_ELECTRONICS`, `SERVER_ROOM`, `ADMIN_OFFICES` y `WAREHOUSE_RFID`; `QA_TEST_AREA` se conserva para pruebas del módulo QA.

---

## 5. Empleados Registrados (`employees`)

| ID (`id`) | Código (`employeeCode`) | Nombre (`firstName`) | Apellido (`lastName`) | Email (`email`) | Departamento | Puesto | Estado (`status`) | Cuenta Móvil |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` | `EMP-QA-001` | Empleado | QA Movil | `employee.qa@scaccess.local` | Calidad | QA Engineer | `active` | Sí (`employee.qa@scaccess.local`) |
| `d106f1db-c260-4726-8ecb-eef199934336` | `EMP-QA-002` | Empleado | QA Dos | `employee.qa2@scaccess.local` | Calidad | QA Analyst | `active` | Sin cuenta móvil vinculada |
| `0eb93c83-0281-45a9-918d-aa550e3e529a` | `EMP-UTT-003` | Valeria | Hernandez | `valeria.hernandez@scaccess.local` | Ingenieria | Arquitecta de Redes | `active` | Sin cuenta móvil vinculada |
| `83e38728-4dc9-40ac-8a36-05287ee85bd7` | `EMP-UTT-004` | Carlos | Montoya | `carlos.montoya@scaccess.local` | Seguridad Fisica | Supervisor de Planta | `active` | Sin cuenta móvil vinculada |
| `0a28527f-5f3c-4d1b-965d-580865d95f70` | `EMP-UTT-005` | Sofia | Navarro | `sofia.navarro@scaccess.local` | Sistemas | Administradora de Servidores | `active` | Sin cuenta móvil vinculada |
| `c629e39c-10c6-47ef-92cf-a24390b751c7` | `EMP-UTT-006` | Diego | Morales | `diego.morales@scaccess.local` | Logistica | Coordinador de Almacen | `active` | Sin cuenta móvil vinculada |
| `97807162-5933-48e5-a396-d5c74cae4129` | `EMP-UTT-007` | Fernanda | Castillo | `fernanda.castillo@scaccess.local` | Administracion | Analista de Operaciones | `active` | Sin cuenta móvil vinculada |
| `be056620-01c2-4325-9b7e-408829cef3cd` | `EMP-UTT-008` | Roberto | Ibarra | `roberto.ibarra@scaccess.local` | Mantenimiento | Tecnico Electromecanico | `suspended` | Sin cuenta móvil vinculada |

`EMP-UTT-008` está suspendido y no recibe permisos de acceso. Su tarjeta principal está bloqueada; su tarjeta secundaria sigue `active` a propósito para poder probar la denegación por `employee_inactive` en la bitácora.

---

## 6. Tarjetas RFID (`credentials`)

| ID (`id`) | UID de Tarjeta (`cardUid`) | Etiqueta (`label`) | Empleado Asignado (`employeeId`) | Código Empleado | Estado (`status`) | Fecha de Emisión (`issuedAt`) |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `e7688cae-07a8-4730-acb8-e75c02341819` | `04B1C2D3E4F509` | Tarjeta secundaria - empleado suspendido | `be056620-01c2-4325-9b7e-408829cef3cd` | `EMP-UTT-008` | `active` | `2026-11-11T05:14:31.543Z` |
| `1070dae8-d114-45c6-9157-99ef4d5d84c0` | `04B1C2D3E4F508` | Tarjeta bloqueada - empleado suspendido | `be056620-01c2-4325-9b7e-408829cef3cd` | `EMP-UTT-008` | `blocked` | `2026-11-11T05:14:31.314Z` |
| `82548f7d-4341-4f25-9952-3513a22b02f0` | `04B1C2D3E4F507` | Tarjeta RFID Fernanda Castillo | `97807162-5933-48e5-a396-d5c74cae4129` | `EMP-UTT-007` | `active` | `2026-11-11T05:14:31.142Z` |
| `7d565cd8-cf41-461d-ac2a-4f1cd9e2039b` | `04B1C2D3E4F506` | Tarjeta RFID Diego Morales | `c629e39c-10c6-47ef-92cf-a24390b751c7` | `EMP-UTT-006` | `active` | `2026-11-11T05:14:30.978Z` |
| `2f3ab9d8-b7b8-42b0-b934-34dff9ce70a6` | `04B1C2D3E4F505` | Tarjeta RFID Sofia Navarro | `0a28527f-5f3c-4d1b-965d-580865d95f70` | `EMP-UTT-005` | `active` | `2026-11-11T05:14:30.807Z` |
| `43ed23a3-da4f-4281-851b-9f851b4e9aed` | `04B1C2D3E4F504` | Tarjeta RFID Carlos Montoya | `83e38728-4dc9-40ac-8a36-05287ee85bd7` | `EMP-UTT-004` | `active` | `2026-11-11T05:14:30.615Z` |
| `6449eed4-b571-4f10-aa65-8ffec6dbb54e` | `04B1C2D3E4F503` | Tarjeta RFID Valeria Hernandez | `0eb93c83-0281-45a9-918d-aa550e3e529a` | `EMP-UTT-003` | `active` | `2026-11-11T05:14:30.437Z` |
| `b4249d12-d709-4df3-997f-6181a31abde4` | `04B1C2D3E4F502` | Tarjeta RFID QA Dos | `d106f1db-c260-4726-8ecb-eef199934336` | `EMP-QA-002` | `active` | `2026-11-11T05:14:30.270Z` |
| `cbc7fefd-bd56-4e24-8509-811198a2fe13` | `04A1B2C3D4E5F6` | Tarjeta RFID QA | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` | `EMP-QA-001` | `active` | `2026-11-10T02:43:04.792Z` |

> `04B1C2D3E4F508` está `blocked` (motivo: empleado suspendido). `04B1C2D3E4F509` se mantiene `active` para el escenario de denegación `employee_inactive`. Las tarjetas `04DEADBEEF01` y `04DEADBEEF02` **no existen** en la base y se usan para eventos `card_unknown`.

---

## 7. Permisos de Acceso Activos (`access_permissions`)

Los 16 permisos fueron otorgados por el administrador `1c80be2b-f012-436a-ba48-14d82cfbb555` (`admin.qa@scaccess.local`). Todos tienen vigencia permanente (`validFrom`/`validTo` en `null`), horario sin restricción (`schedule` en `null`) y `revokedAt` en `null`.

| ID (`id`) | Empleado (`employeeId`) | Área (`areaId`) |
| :--- | :--- | :--- |
| `c272f98e-7fd7-4e36-a526-16fddc93637a` | `97807162-5933-48e5-a396-d5c74cae4129` (`EMP-UTT-007`) | `c89c95b3-0394-459f-b620-6d1b7281e76f` (`ADMIN_OFFICES`) |
| `7a4d1485-81de-4209-a0c4-d1a21d019eb6` | `97807162-5933-48e5-a396-d5c74cae4129` (`EMP-UTT-007`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) |
| `cd9a47e8-4e10-4d6a-aeb0-d9efab9ad529` | `c629e39c-10c6-47ef-92cf-a24390b751c7` (`EMP-UTT-006`) | `5d4b72a4-acaa-42e3-93b7-9dfcad985f5b` (`WAREHOUSE_RFID`) |
| `96833f70-8b90-4e8b-a8fb-214be6c76bfa` | `c629e39c-10c6-47ef-92cf-a24390b751c7` (`EMP-UTT-006`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) |
| `63858113-c7f8-4982-b248-0d417bd30d40` | `0a28527f-5f3c-4d1b-965d-580865d95f70` (`EMP-UTT-005`) | `3c4a92ce-a31e-42cb-88f4-bbf468d5067b` (`SERVER_ROOM`) |
| `db3b835d-01ff-4bcc-bff4-d1daf801892d` | `0a28527f-5f3c-4d1b-965d-580865d95f70` (`EMP-UTT-005`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) |
| `20ef2b0e-0826-4dd7-925e-d76851d390c8` | `83e38728-4dc9-40ac-8a36-05287ee85bd7` (`EMP-UTT-004`) | `5d4b72a4-acaa-42e3-93b7-9dfcad985f5b` (`WAREHOUSE_RFID`) |
| `cc005d71-9d8e-4479-96c5-6f09ecca015e` | `83e38728-4dc9-40ac-8a36-05287ee85bd7` (`EMP-UTT-004`) | `c89c95b3-0394-459f-b620-6d1b7281e76f` (`ADMIN_OFFICES`) |
| `c53f2b62-e28b-4f5f-8d88-dd71db734904` | `83e38728-4dc9-40ac-8a36-05287ee85bd7` (`EMP-UTT-004`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) |
| `e83c3be2-28ad-4b51-9857-e3f0d323c423` | `0eb93c83-0281-45a9-918d-aa550e3e529a` (`EMP-UTT-003`) | `3c4a92ce-a31e-42cb-88f4-bbf468d5067b` (`SERVER_ROOM`) |
| `f651a795-3206-4f16-8fb9-c7d4ead443e3` | `0eb93c83-0281-45a9-918d-aa550e3e529a` (`EMP-UTT-003`) | `b56485d7-1826-435a-b242-701750f87da5` (`LAB_ELECTRONICS`) |
| `1996cbe1-1e1f-4264-a0db-beb433969c33` | `0eb93c83-0281-45a9-918d-aa550e3e529a` (`EMP-UTT-003`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) |
| `00963fb9-fb1a-48cf-b0dd-a8ad321c3085` | `d106f1db-c260-4726-8ecb-eef199934336` (`EMP-QA-002`) | `24abc3d9-6558-4c79-878a-8a662622d17c` (`QA_TEST_AREA`) |
| `444c190c-67de-4acb-8272-95f658342cb9` | `d106f1db-c260-4726-8ecb-eef199934336` (`EMP-QA-002`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) |
| `a8213c6d-da1b-4692-a005-c16de41f9109` | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` (`EMP-QA-001`) | `b56485d7-1826-435a-b242-701750f87da5` (`LAB_ELECTRONICS`) |
| `1ebf0561-06c2-4e74-abe8-0d6d3aed0cb3` | `a2bd1126-20b0-455b-83a2-4f3b9f4813ef` (`EMP-QA-001`) | `8a983ee5-b312-454b-b51b-f53a79ea62ae` (`MAIN_ENTRANCE`) |

Resumen por empleado: `EMP-QA-001` → 2 áreas; `EMP-QA-002` → 2; `EMP-UTT-003` → 3; `EMP-UTT-004` → 3; `EMP-UTT-005` → 2; `EMP-UTT-006` → 2; `EMP-UTT-007` → 2. `EMP-UTT-008` no tiene permisos por estar suspendido.

---

## 8. Dispositivos Físicos (`access_devices` y `device_credentials`)

| Campo | `ESP32-QA-01` | `ESP32-DATACENTER-02` | `ESP32-PLANTA-03` |
| :--- | :--- | :--- | :--- |
| **ID del Dispositivo (`id`)** | `282b937e-2b0a-4d4c-a61c-fe00116a8441` | `b5d788d6-81a7-4a83-a13a-e217b36b8cba` | `40922d1a-2dc2-477a-8e7c-129f2a279855` |
| **Nombre (`name`)** | `ESP32-S3 QA Device` | `Controlador Centro de Datos` | `Controlador Planta y Almacen` |
| **Ubicación (`location`)** | `Acceso Principal - Torniquete 1` | `Centro de Datos - Rack A` | `Almacen General - Anden 1` |
| **Modelo / Firmware** | `ESP32-S3` / `qa-1.0.0` | `ESP32-S3` / `1.2.0` | `ESP32-S3` / `1.2.0` |
| **Estado (`status`)** | `active` | `active` | `active` |
| **Áreas Asociadas (`areaIds`)** | `MAIN_ENTRANCE`, `LAB_ELECTRONICS`, `QA_TEST_AREA` | `SERVER_ROOM`, `LAB_ELECTRONICS` | `ADMIN_OFFICES`, `WAREHOUSE_RFID` |
| **Versión de Configuración (`configVersion`)** | `22` | `0` | `2` |
| **Última conexión (`lastSeenAt`)** | `2026-11-11T05:15:23.766Z` | `2026-11-11T05:15:24.048Z` | `2026-11-11T05:15:23.909Z` |
| **Credencial emitida (`device_credentials.id`)** | `b6805bb5-8d42-4ea3-8c0e-9d57686e53ec` | `6efca25a-d275-44ca-8588-0f578e63328e` | `d69bb215-d4b7-48f8-94e8-b784f559d2bb` |
| **Credencial Activa (`device_credentials.tokenId`)** | `devtok_e8c318d65cd10d7b` | `devtok_30351c3fbe7b47e6` | `devtok_6f17cd8a3d02fac3` |
| **Emitida el (`device_credentials.createdAt`)** | `2026-11-11T05:14:36.811Z` | `2026-11-11T05:14:36.961Z` | `2026-11-11T05:14:37.125Z` |

> **Nota de seguridad:** El secreto completo (`<tokenId>.<secret>`) solo se devuelve una vez al emitir la credencial. En este documento se registra únicamente el `tokenId`. Para sincronizar un dispositivo desde cero, un Admin puede emitir un nuevo token con:
> `POST /api/v1/access-devices/{deviceId}/credentials`
>
> El `configVersion` de `ESP32-QA-01` es alto porque cada alta de empleado/tarjeta/permiso incrementa la versión de configuración de todos los dispositivos activos.

---

## 9. Estado de Sincronización (`device_sync_state`)

| Dispositivo | `configVersion` | Última solicitud (`lastSyncRequestedAt`) | Última sincronización (`lastSyncCompletedAt`) | Último evento recibido (`lastEventReceivedAt`) | Último evento ocurrido (`lastEventOccurredAt`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `ESP32-QA-01` | `22` | `2026-11-11T05:15:23.467Z` | `2026-11-11T05:15:23.467Z` | `2026-11-11T05:15:23.766Z` | `2026-11-11T04:59:37.500Z` |
| `ESP32-DATACENTER-02` | `0` | `2026-11-11T05:15:23.623Z` | `2026-11-11T05:15:23.623Z` | `2026-11-11T05:15:24.048Z` | `2026-11-11T04:49:37.500Z` |
| `ESP32-PLANTA-03` | `1` | `null` | `null` | `2026-11-11T05:15:23.909Z` | `2026-11-11T04:54:37.500Z` |

- **`ESP32-QA-01`** y **`ESP32-DATACENTER-02`** respondieron `200 OK` a `GET /api/v1/devices/:deviceId/sync` y quedaron 100 % sincronizados.
- **`ESP32-PLANTA-03`** tiene credencial emitida y ya envió eventos reales, pero **nunca ha completado un `GET .../sync`**: su `configVersion` es `2` y su `device_sync_state.configVersion` es `1`. El Dashboard lo reporta como `outOfSync: 1`, ideal para probar la pantalla de sincronización y el flujo de puesta al día.
- Checksums de la última configuración entregada: `ESP32-QA-01` → `29d9ef07658c6f007b2528f0f8b74276d8ccb8e0fcc64c8ac01eb036d4859c15`; `ESP32-DATACENTER-02` → `a56b313b056cadadea8a4d4b0934df5b8b5d20a1feb70061d2acff81c1f67b4c`.

---

## 10. Eventos de Acceso Registrados (`access_events`)

Hay **26 eventos** en total: **24 nuevos** cargados en esta sesión (`clientEventId` con prefijo `qa-seed-20261110-`) y los **2 preexistentes** del E2E (`qa-20261110024258-*`). Los eventos son inmutables y la sincronización es idempotente por `clientEventId`: al reenviar los mismos lotes, la API devolvió los 24 como `duplicated` y **0 rechazados**.

### 10.1 Resumen por decisión y motivo

| Métrica | Total |
| :--- | :---: |
| `granted` / `allowed` | 20 |
| `denied` / `card_unknown` | 3 |
| `denied` / `card_blocked` | 1 |
| `denied` / `permission_missing` | 1 |
| `denied` / `employee_inactive` | 1 |
| **Total** | **26** |

### 10.2 Distribución por área (incluye los 2 eventos preexistentes)

| Área | Total | `granted` | `denied` | Entradas (`entry`) | Salidas (`exit`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `MAIN_ENTRANCE` | 11 | 8 | 3 | 9 | 0 |
| `LAB_ELECTRONICS` | 4 | 3 | 1 | 3 | 1 |
| `SERVER_ROOM` | 3 | 2 | 1 | 3 | 0 |
| `ADMIN_OFFICES` | 2 | 2 | 0 | 2 | 0 |
| `WAREHOUSE_RFID` | 4 | 3 | 1 | 3 | 1 |
| `QA_TEST_AREA` | 2 | 2 | 0 | 1 | 1 |
| **Total** | **26** | **20** | **6** | **21** | **3** |

> Los 2 eventos preexistentes no incluyen `metadata.direction`, por eso las columnas de entradas/salidas suman 24 (los 24 eventos nuevos).

### 10.3 Ocupación actual para el Croquis de Áreas

Calculada con la **última entrada concedida** de cada empleado activo:

| Área | Empleados dentro |
| :--- | :--- |
| `MAIN_ENTRANCE` | `EMP-QA-002` (Empleado QA Dos) |
| `LAB_ELECTRONICS` | `EMP-QA-001` (Empleado QA Movil) |
| `SERVER_ROOM` | `EMP-UTT-003` (Valeria Hernandez), `EMP-UTT-005` (Sofia Navarro) |
| `ADMIN_OFFICES` | `EMP-UTT-004` (Carlos Montoya), `EMP-UTT-007` (Fernanda Castillo) |
| `WAREHOUSE_RFID` | `EMP-UTT-006` (Diego Morales) |
| `QA_TEST_AREA` | Sin ocupantes (EMP-QA-002 registró salida) |

`EMP-UTT-008` (suspendido) solo aparece en eventos denegados.

### 10.4 Detalle de eventos (orden descendente por `occurredAt`)

| ID (`id`) | `clientEventId` | Ocurrido (`occurredAt`, UTC) | Tarjeta (`cardUid`) | Empleado | Área | Decisión | Motivo (`reasonCode`) | Dirección | Puerta (`gate`) | Dispositivo |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| `3a9607fa-19a1-4148-9b6f-45124a48cb33` | `qa-seed-20261110-019` | `2026-11-11T04:59:37.500Z` | `04B1C2D3E4F502` | `EMP-QA-002` | `MAIN_ENTRANCE` | `granted` | `allowed` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `787893ad-a42c-4580-a1ff-87cdcfcfe792` | `qa-seed-20261110-018` | `2026-11-11T04:54:37.500Z` | `04B1C2D3E4F507` | `EMP-UTT-007` | `ADMIN_OFFICES` | `granted` | `allowed` | `entry` | `door-offices-1` | `ESP32-PLANTA-03` |
| `5c1eacb7-0997-4dd8-b105-0ab65dc59e41` | `qa-seed-20261110-015` | `2026-11-11T04:49:37.500Z` | `04B1C2D3E4F505` | `EMP-UTT-005` | `SERVER_ROOM` | `granted` | `allowed` | `entry` | `door-datacenter-1` | `ESP32-DATACENTER-02` |
| `34de71bc-7e10-4500-804d-4ba618484292` | `qa-seed-20261110-013` | `2026-11-11T04:44:37.500Z` | `04A1B2C3D4E5F6` | `EMP-QA-001` | `LAB_ELECTRONICS` | `granted` | `allowed` | `entry` | `door-lab-1` | `ESP32-QA-01` |
| `238f93cf-d4dd-49be-a228-cfb948a4ad33` | `qa-seed-20261110-014` | `2026-11-11T04:39:37.500Z` | `04B1C2D3E4F503` | `EMP-UTT-003` | `SERVER_ROOM` | `granted` | `allowed` | `entry` | `door-datacenter-1` | `ESP32-DATACENTER-02` |
| `874b8b7e-60ef-439e-93de-038891b85cdf` | `qa-seed-20261110-017` | `2026-11-11T04:34:37.500Z` | `04B1C2D3E4F506` | `EMP-UTT-006` | `WAREHOUSE_RFID` | `granted` | `allowed` | `entry` | `loading-dock-1` | `ESP32-PLANTA-03` |
| `544b8e71-e819-45ad-bc52-76663b6dc90f` | `qa-seed-20261110-016` | `2026-11-11T04:29:37.500Z` | `04B1C2D3E4F504` | `EMP-UTT-004` | `ADMIN_OFFICES` | `granted` | `allowed` | `entry` | `door-offices-1` | `ESP32-PLANTA-03` |
| `901bd03f-82b0-4123-900d-9e28f74be9e3` | `qa-seed-20261110-020` | `2026-11-11T04:24:37.500Z` | `04DEADBEEF01` | — (tarjeta desconocida) | `MAIN_ENTRANCE` | `denied` | `card_unknown` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `0555996f-008f-49bc-9c7c-875bf62ba0e9` | `qa-seed-20261110-022` | `2026-11-11T04:19:37.500Z` | `04B1C2D3E4F502` | `EMP-QA-002` | `SERVER_ROOM` | `denied` | `permission_missing` | `entry` | `door-datacenter-1` | `ESP32-DATACENTER-02` |
| `d2efd674-7ac4-4b96-b18e-c43204bc0280` | `qa-seed-20261110-021` | `2026-11-11T04:14:37.500Z` | `04B1C2D3E4F508` | `EMP-UTT-008` | `WAREHOUSE_RFID` | `denied` | `card_blocked` | `entry` | `loading-dock-1` | `ESP32-PLANTA-03` |
| `c12aff35-4473-4897-bc6d-4be23d2870b6` | `qa-seed-20261110-023` | `2026-11-11T04:09:37.500Z` | `04B1C2D3E4F509` | `EMP-UTT-008` | `MAIN_ENTRANCE` | `denied` | `employee_inactive` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `3e8420a3-d8bf-4647-ac71-6a7d9ab934a2` | `qa-seed-20261110-024` | `2026-11-11T04:04:37.500Z` | `04DEADBEEF02` | — (tarjeta desconocida) | `LAB_ELECTRONICS` | `denied` | `card_unknown` | `entry` | `door-lab-2` | `ESP32-DATACENTER-02` |
| `f92184ab-19ae-447d-83a3-337f76d5940e` | `qa-seed-20261110-012` | `2026-11-11T01:34:37.500Z` | `04B1C2D3E4F504` | `EMP-UTT-004` | `WAREHOUSE_RFID` | `granted` | `allowed` | `exit` | `loading-dock-1` | `ESP32-PLANTA-03` |
| `a59c591d-98be-4524-8a9c-345fd1575724` | `qa-seed-20261110-011` | `2026-11-11T01:14:37.500Z` | `04B1C2D3E4F502` | `EMP-QA-002` | `QA_TEST_AREA` | `granted` | `allowed` | `exit` | `turnstile-qa` | `ESP32-QA-01` |
| `38a7d566-aa49-44af-9010-edbf505c7a36` | `qa-seed-20261110-010` | `2026-11-11T00:54:37.500Z` | `04B1C2D3E4F503` | `EMP-UTT-003` | `LAB_ELECTRONICS` | `granted` | `allowed` | `exit` | `door-lab-1` | `ESP32-QA-01` |
| `408dde33-f284-4acc-94b1-43955a116810` | `qa-seed-20261110-009` | `2026-11-11T00:34:37.500Z` | `04A1B2C3D4E5F6` | `EMP-QA-001` | `MAIN_ENTRANCE` | `granted` | `allowed` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `c4e4c5ed-2e4d-48f5-8fee-55ae82cb1940` | `qa-seed-20261110-008` | `2026-11-11T00:14:37.500Z` | `04B1C2D3E4F502` | `EMP-QA-002` | `QA_TEST_AREA` | `granted` | `allowed` | `entry` | `turnstile-qa` | `ESP32-QA-01` |
| `57e8ca1b-1968-4d27-be33-bc50f696931b` | `qa-seed-20261110-007` | `2026-11-11T00:04:37.500Z` | `04B1C2D3E4F504` | `EMP-UTT-004` | `WAREHOUSE_RFID` | `granted` | `allowed` | `entry` | `loading-dock-1` | `ESP32-PLANTA-03` |
| `72c1c6d4-76db-42b6-ba62-323fe90df71a` | `qa-seed-20261110-006` | `2026-11-10T23:54:37.500Z` | `04B1C2D3E4F503` | `EMP-UTT-003` | `LAB_ELECTRONICS` | `granted` | `allowed` | `entry` | `door-lab-1` | `ESP32-QA-01` |
| `76ac4499-c69b-4e51-a58c-bbb85621fb19` | `qa-seed-20261110-005` | `2026-11-10T23:44:37.500Z` | `04B1C2D3E4F507` | `EMP-UTT-007` | `MAIN_ENTRANCE` | `granted` | `allowed` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `8e0f18a2-b291-4715-8dac-39e7d023439f` | `qa-seed-20261110-004` | `2026-11-10T23:34:37.500Z` | `04B1C2D3E4F506` | `EMP-UTT-006` | `MAIN_ENTRANCE` | `granted` | `allowed` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `fc1cbb14-18c5-4a60-a214-e59f4a1086a1` | `qa-seed-20261110-003` | `2026-11-10T23:24:37.500Z` | `04B1C2D3E4F504` | `EMP-UTT-004` | `MAIN_ENTRANCE` | `granted` | `allowed` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `30b56dc6-6f6c-40f9-91eb-f18f42b94170` | `qa-seed-20261110-002` | `2026-11-10T23:14:37.500Z` | `04B1C2D3E4F505` | `EMP-UTT-005` | `MAIN_ENTRANCE` | `granted` | `allowed` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `7458edb2-10cb-4d52-b6de-eea80a806833` | `qa-seed-20261110-001` | `2026-11-10T23:04:37.500Z` | `04B1C2D3E4F503` | `EMP-UTT-003` | `MAIN_ENTRANCE` | `granted` | `allowed` | `entry` | `turnstile-1` | `ESP32-QA-01` |
| `1a6807e4-676d-4d59-9f9a-30dc75960be5` | `qa-20261110024258-denied-1` | `2026-11-10T02:42:08.016Z` | `99999999` | — (tarjeta desconocida) | `MAIN_ENTRANCE` | `denied` | `card_unknown` | — | — | `ESP32-QA-01` |
| `53a91762-8765-4006-b304-ea2b2cdbf43e` | `qa-20261110024258-allowed-1` | `2026-11-10T02:41:08.016Z` | `04A1B2C3D4E5F6` | `EMP-QA-001` | `MAIN_ENTRANCE` | `granted` | `allowed` | — | — | `ESP32-QA-01` |

Cada evento nuevo incluye `deviceEpoch` y `deviceSequence` para simular el buffer offline del ESP32-S3. La API calculó `receivedAt` al momento de la sincronización y conservó `occurredAt` tal como lo reportó el dispositivo.

---

## 11. Escenarios de Prueba Sugeridos

| Escenario | Datos / Endpoint | Resultado esperado |
| :--- | :--- | :--- |
| **Dashboard** | `GET /api/v1/dashboard/summary` | 8 empleados (7 activos), 9 tarjetas (8 activas, 1 bloqueada), 6 áreas activas, 3 dispositivos (1 fuera de sincronización) y eventos recientes `granted`/`denied`. |
| **Croquis de Áreas** | `GET /api/v1/areas` + `GET /api/v1/access-events` | 5 zonas con personal dentro: `MAIN_ENTRANCE`, `LAB_ELECTRONICS`, `SERVER_ROOM`, `ADMIN_OFFICES`, `WAREHOUSE_RFID`. |
| **Bitácora / Historial** | `GET /api/v1/access-events?decision=denied` | 6 denegaciones: 3 `card_unknown`, 1 `card_blocked`, 1 `permission_missing`, 1 `employee_inactive`. |
| **Filtro por área** | `GET /api/v1/access-events?areaId=<id>` | Conteos de la tabla 10.2. |
| **Filtro por dispositivo** | `GET /api/v1/access-events?deviceId=<id>` | `ESP32-QA-01`: 14 eventos nuevos + 2 legacy; `ESP32-PLANTA-03`: 6; `ESP32-DATACENTER-02`: 4. |
| **App Móvil (empleado)** | Login `employee.qa@scaccess.local` → `GET /api/v1/me/access-events` | Solo eventos de `EMP-QA-001` (3: 1 legacy + entrada a `MAIN_ENTRANCE` + entrada a `LAB_ELECTRONICS`). |
| **Dispositivo sincronizado** | `GET /api/v1/devices/ESP32-QA-01/sync` con token de dispositivo | `200 OK` con payload/ETag; repetir con `If-None-Match` devuelve `304`. |
| **Dispositivo pendiente** | `GET /api/v1/access-devices/40922d1a-2dc2-477a-8e7c-129f2a279855/sync-state` | `lastSyncCompletedAt: null`, `configVersion: 1`; el dispositivo sigue `outOfSync` hasta completar el `GET .../sync`. |
| **Idempotencia de eventos** | Reenviar un lote ya sincronizado a `POST /api/v1/devices/:deviceId/events/sync` | Todos los `clientEventId` vuelven en `duplicated`, sin crear filas nuevas ni rechazos. |
| **Empleado suspendido** | Tarjeta `04B1C2D3E4F508` o `04B1C2D3E4F509` | Eventos `denied` con `card_blocked` y `employee_inactive`; no aparece en el Croquis. |

---

## 12. Notas Operativas

- Los scripts de carga se ejecutaron fuera del repositorio (carpeta temporal) y **no se versionaron**; los secretos de dispositivo no se guardan en este documento.
- La carga fue idempotente: una segunda ejecución no duplicó áreas, empleados, tarjetas ni permisos; los 24 eventos se devolvieron como duplicados por `clientEventId`.
- Los eventos de acceso nunca se eliminan. Si se necesitan escenarios adicionales, crear nuevos `clientEventId` y enviarlos por `POST /api/v1/devices/:deviceId/events/sync`.
- Para emitir un token de dispositivo nuevo: `POST /api/v1/access-devices/:id/credentials` (rol `admin`). El token completo solo se muestra en esa respuesta.
