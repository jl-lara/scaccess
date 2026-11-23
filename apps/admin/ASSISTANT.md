# Asistente Operativo y Traductor de Metadatos (`@scaccess/admin`)

El asistente integrado de **Accesa** ayuda a operadores, auditores, administradores y monitores a entender reglas operativas de la consola y a traducir a español claro los metadatos técnicos JSON generados por los controladores RFID **ESP32-S3**.

## Arquitectura modular

- `src/lib/assistant/types.ts`: contratos de dominio (`AssistantMessage`, `AssistantMetadataItem`, `AssistantEventContext`, `AssistantPageContext`, `AssistantReply`, `AssistantProvider`).
- `src/lib/assistant/metadataInterpreter.ts`:
  - `interpretMetadataObject(metadata)`: traduce claves técnicas conocidas y humaniza claves adicionales en `camelCase` o `snake_case`.
  - `extractJsonFromText(input)`: extrae el primer objeto JSON válido pegado en el chat (con o sin texto alrededor).
  - `explainAccessEvent(ctx)`: genera un resumen operativo completo con decisión, motivo (`REASON_LABELS`), desfase entre `occurredAt` (lector) y `receivedAt` (servidor), trazabilidad (`clientEventId`, `deviceEpoch`, `deviceSequence`) y tarjetas de metadatos.
- `src/lib/assistant/knowledgeBase.ts`:
  - `getContextualSuggestions(pathname, permissions)`: genera sugerencias rápidas según la ruta activa y el perfil RBAC.
  - `LocalKnowledgeAssistantProvider`: proveedor local determinista sin dependencias externas ni llamadas a red.
- `src/context/AssistantContext.tsx`:
  - Administra el estado del panel (`isOpen`, `messages`, `isResponding`, `activeEventContext`).
  - Exporta `useAssistant()` y `useOptionalAssistant()` (devuelve `null` fuera del proveedor para no romper pruebas unitarias aisladas de páginas).
- `src/components/assistant/AssistantWidget.tsx`:
  - Botón flotante accesible (`aria-label="Abrir asistente de Accesa"`, `aria-expanded`, `aria-controls="accesa-assistant-panel"`) y diálogo (`role="dialog"`, cierre con `Escape`, región `aria-live="polite"`).
- Integraciones:
  - `src/components/layout/AppShell.tsx`: envuelve la sesión autenticada con `<AssistantProvider>` y renderiza `<AssistantWidget />`.
  - `src/pages/AccessEventsPage.tsx`: agrega en `EventDetailModal` el botón secundario `"Explicar metadatos con el asistente"` mediante `useOptionalAssistant()`.

## Diccionario de metadatos soportados

| Clave | Interpretación | Notas |
| --- | --- | --- |
| `reader` | Lector RFID | Identifica hardware como `PN532`, `RC522`/`MFRC522` o interfaz `Wiegand`. |
| `rssi` | Señal Wi-Fi (RSSI) | Bandas: `Excelente` (`>= -55`), `Buena` (`>= -70`), `Regular` (`>= -85`), `Débil` (`< -85`). |
| `offline` | Modo sin conexión | Indica validación local con caché offline en ESP32-S3 (`true`) o conectividad activa (`false`). |
| `direction` / `action` / `movement` | Sentido del movimiento | Traduce valores de entrada (`in`, `entry`, `entrada`, etc.) y salida (`out`, `exit`, `salida`, etc.). |
| `firmware` / `firmwareVersion` | Versión de firmware | Versión ejecutándose en el controlador ESP32-S3. |
| `battery` | Nivel de batería | Porcentaje o respaldo energético (alerta si `<= 20%`). |
| `voltage` | Voltaje de alimentación | Voltaje medido en la etapa eléctrica (alerta si `< 3.0 V`). |
| `temperature` | Temperatura del equipo | Sensor interno en `°C` (alerta si `>= 65 °C`). |
| `latencyMs` | Latencia | Tiempo de respuesta/transferencia en milisegundos. |
| `synced` | Estado de sincronización | Indica confirmación o estado pendiente del evento. |
| `error` / `errorCode` | Código de error técnico | Reporte diagnóstico del controlador o lector. |
| `reasonCode` | Motivo en metadatos | Traducido con `REASON_LABELS` del dominio. |
| `configVersion` | Versión de configuración | Instantánea de catálogo/permisos aplicada en el controlador. |
| `protocol` | Protocolo | Estándar RFID o protocolo de transporte. |
| `antenna` | Antena / canal | Antena física del lector que capturó la lectura. |
| `simulated` | Origen simulado | Marca eventos generados desde el simulador del croquis. |
| Cualquier otra clave | Humanización automática | Convierte `camelCase`, `snake_case` o `kebab-case` en etiqueta legible. |

## Adaptación RBAC

El asistente consulta `usePermissions()` (`src/lib/permissions.ts`) para adaptar sugerencias y respuestas:

- **Monitor (`viewer`)**: nunca recibe sugerencias de administración de catálogos (empleados, tarjetas, permisos, controladores) ni de cuentas/roles, ni instrucciones del simulador.
- **Auditor (`auditor`)**: recibe sugerencias de lectura de bitácora, metadatos, dispositivos y exportación PDF; sin sugerencias de edición ni gestión de cuentas.
- **Operador (`operator`)**: recibe guía operativa de catálogos, simulador del croquis y exportación PDF; nunca ve sugerencias de gestión de cuentas y roles.
- **Administrador (`admin`)**: acceso completo a todas las guías operativas, incluyendo `Cuentas y roles`.

## Conexión futura con API o proveedor LLM

Para conectar un backend o modelo de lenguaje manteniendo compatibilidad total con la UI:

1. Implementa la interfaz `AssistantProvider` definida en `src/lib/assistant/types.ts`:

```ts
import type { AssistantProvider, AssistantReply, AssistantRequest } from './lib/assistant/types'

export class RemoteApiAssistantProvider implements AssistantProvider {
  readonly id = 'remote-api'
  readonly name = 'Asistente remoto Accesa'

  async reply(request: AssistantRequest): Promise<AssistantReply> {
    // Enviar request.message, request.pageContext, request.eventContext y request.history
    // al endpoint autenticado correspondiente y retornar { content, metadataItems?, suggestions? }.
    throw new Error('Pendiente de conectar')
  }
}
```

2. Pasa la instancia al proveedor en `AppShell.tsx` (o mediante configuración de entorno):

```tsx
<AssistantProvider provider={new RemoteApiAssistantProvider()}>
  ...
</AssistantProvider>
```
