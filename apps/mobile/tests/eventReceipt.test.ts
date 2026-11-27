import { describe, it, expect } from 'vitest'

import type { AccessEventDto } from '@scaccess/shared'

import { buildEventReceiptMessage } from '../src/utils/eventReceipt'

function makeEvent(overrides: Partial<AccessEventDto> = {}): AccessEventDto {
  return {
    id: 'evt-1',
    deviceId: 'dev-1',
    clientEventId: 'client-evt-001',
    deviceEpoch: null,
    cardUid: '04a1b2c3d4e5f6',
    employeeId: 'emp-1',
    credentialId: 'cred-1',
    areaId: '8a983ee5-b312-454b-b51b-f53a79ea62ae',
    decision: 'granted',
    reasonCode: 'allowed',
    occurredAt: '2026-11-10T02:41:08.016Z',
    receivedAt: '2026-11-10T02:41:12.016Z',
    deviceSequence: null,
    metadata: null,
    createdAt: '2026-11-10T02:41:12.016Z',
    ...overrides,
  }
}

describe('eventReceipt', () => {
  it('construye comprobante para evento permitido en tiempo real con etiquetas claras', () => {
    const payload = buildEventReceiptMessage(makeEvent())

    expect(payload.title).toBe('Comprobante de acceso — Accesa')
    expect(payload.message).toContain('Comprobante de evento de acceso — Accesa')
    expect(payload.message).toContain('Resultado: Acceso permitido')
    expect(payload.message).toContain('Motivo: Autorizado')
    expect(payload.message).toContain('Área: Acceso Principal')
    expect(payload.message).not.toContain('(MAIN_ENTRANCE)')
    expect(payload.message).toContain('Fecha y hora:')
    expect(payload.message).toContain('Registrado en sistema:')
    expect(payload.message).toContain(
      'Sincronización: Sincronizado en tiempo real',
    )
    expect(payload.message).toContain('Tarjeta RFID: 04 A1 B2 C3 D4 E5 F6')
    expect(payload.message).toContain('Referencia: client-evt-001')
    expect(payload.message).not.toContain('Lector:')
    expect(payload.message).not.toContain('Secuencia del dispositivo:')
  })

  it('construye comprobante para evento denegado diferido sin exponer detalles de lector ni secuencia', () => {
    const payload = buildEventReceiptMessage(
      makeEvent({
        clientEventId: 'client-evt-999',
        areaId: '99999999-aaaa-bbbb-cccc-111111111111',
        decision: 'denied',
        reasonCode: 'permission_outside_schedule',
        occurredAt: '2026-11-10T02:00:00.000Z',
        receivedAt: '2026-11-10T02:05:00.000Z',
        deviceSequence: '42',
      }),
    )

    expect(payload.title).toBe('Comprobante de acceso — Accesa')
    expect(payload.message).toContain('Resultado: Acceso denegado')
    expect(payload.message).toContain('Motivo: Fuera de horario permitido')
    expect(payload.message).toContain('Área: Área registrada')
    expect(payload.message).not.toContain('99999999')
    expect(payload.message).toContain('Fecha y hora:')
    expect(payload.message).toContain('Registrado en sistema:')
    expect(payload.message).toContain(
      'Sincronización: Lectura offline sincronizada tras 5 min',
    )
    expect(payload.message).toContain('Referencia: client-evt-999')
    expect(payload.message).not.toContain('Lector:')
    expect(payload.message).not.toContain('Secuencia del dispositivo:')
  })

  it('incluye nombre limpio de area sin lector ni secuencia aunque area, device y deviceSequence vengan adjuntos', () => {
    const payload = buildEventReceiptMessage(
      makeEvent({
        areaId: 'custom-area-id',
        deviceSequence: '108',
        area: {
          id: 'custom-area-id',
          code: 'ROBOTICS_LAB',
          name: 'Laboratorio de Robótica',
        },
        device: {
          id: 'dev-1',
          deviceCode: 'ESP32-ROB-01',
          name: 'Lector Robótica',
          location: 'Edificio B, Piso 2',
        },
      }),
    )

    expect(payload.message).toContain('Área: Laboratorio de Robótica')
    expect(payload.message).not.toContain('(ROBOTICS_LAB)')
    expect(payload.message).not.toContain('Lector:')
    expect(payload.message).not.toContain('Secuencia del dispositivo:')
  })
})
