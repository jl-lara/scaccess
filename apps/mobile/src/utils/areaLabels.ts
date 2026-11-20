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
  'b56485d7-1826-435a-b242-701750f87da5':
    'Laboratorio de Electrónica (LAB_ELECTRONICS)',
  '24abc3d9-6558-4c79-878a-8a662622d17c': 'Área de Pruebas QA (QA_TEST_AREA)',
  'c89c95b3-0394-459f-b620-6d1b7281e76f':
    'Oficinas Administrativas (ADMIN_OFFICES)',
  '3c4a92ce-a31e-42cb-88f4-bbf468d5067b':
    'Centro de Datos y Servidores (SERVER_ROOM)',
  '5d4b72a4-acaa-42e3-93b7-9dfcad985f5b':
    'Almacén General y Logística (WAREHOUSE_RFID)',
}

export function getAreaDisplayName(areaId: string): string {
  return KNOWN_AREA_NAMES[areaId] ?? `Área ${areaId.slice(0, 8)}`
}
