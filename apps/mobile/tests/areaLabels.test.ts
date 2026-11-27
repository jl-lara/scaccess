import { describe, it, expect } from 'vitest'

import {
  CREDENTIAL_STATUS_LABELS,
  DECISION_LABELS,
  EMPLOYEE_STATUS_LABELS,
  REASON_LABELS,
  getAreaDisplayName,
  getEventAreaDisplayName,
  getEventDeviceDisplayName,
} from '../src/utils/areaLabels'

describe('areaLabels', () => {
  it('expone las etiquetas de decision en espanol', () => {
    expect(DECISION_LABELS.granted).toBe('Acceso permitido')
    expect(DECISION_LABELS.denied).toBe('Acceso denegado')
  })

  it('expone las etiquetas de motivo en espanol', () => {
    expect(REASON_LABELS.allowed).toBe('Autorizado')
    expect(REASON_LABELS.card_unknown).toBe('Tarjeta no reconocida')
    expect(REASON_LABELS.area_not_allowed).toBe('Área no autorizada')
    expect(REASON_LABELS.device_error).toBe('Error de lectura')
  })

  it('expone las etiquetas de estado de empleado y credencial en espanol', () => {
    expect(EMPLOYEE_STATUS_LABELS).toEqual({
      active: 'Activo',
      inactive: 'Inactivo',
      suspended: 'Suspendido',
    })
    expect(CREDENTIAL_STATUS_LABELS).toEqual({
      active: 'Activa',
      blocked: 'Bloqueada',
      lost: 'Extraviada',
      retired: 'Retirada',
    })
  })

  it('resuelve el nombre limpio de las 6 areas conocidas sin codigo interno', () => {
    expect(getAreaDisplayName('8a983ee5-b312-454b-b51b-f53a79ea62ae')).toBe(
      'Acceso Principal',
    )
    expect(getAreaDisplayName('b56485d7-1826-435a-b242-701750f87da5')).toBe(
      'Laboratorio de Electrónica',
    )
    expect(getAreaDisplayName('24abc3d9-6558-4c79-878a-8a662622d17c')).toBe(
      'Área de Pruebas QA',
    )
    expect(getAreaDisplayName('c89c95b3-0394-459f-b620-6d1b7281e76f')).toBe(
      'Oficinas Administrativas',
    )
    expect(getAreaDisplayName('3c4a92ce-a31e-42cb-88f4-bbf468d5067b')).toBe(
      'Centro de Datos y Servidores',
    )
    expect(getAreaDisplayName('5d4b72a4-acaa-42e3-93b7-9dfcad985f5b')).toBe(
      'Almacén General y Logística',
    )
  })

  it('devuelve un respaldo generico sin prefijo UUID para areas desconocidas', () => {
    expect(getAreaDisplayName('desconocido-1234567890')).toBe('Área registrada')
  })

  it('resuelve el nombre limpio del area de evento o aplica fallback amigable', () => {
    expect(
      getEventAreaDisplayName({
        areaId: 'custom-area-id',
        area: {
          id: 'custom-area-id',
          code: 'BIO_LAB',
          name: 'Laboratorio de Bioingeniería',
        },
      }),
    ).toBe('Laboratorio de Bioingeniería')

    expect(
      getEventAreaDisplayName({
        areaId: '8a983ee5-b312-454b-b51b-f53a79ea62ae',
      }),
    ).toBe('Acceso Principal')

    expect(
      getEventAreaDisplayName({
        areaId: 'abcdef12-3456-7890-abcd-ef1234567890',
      }),
    ).toBe('Área registrada')
  })

  it('resuelve el nombre del punto de acceso con ubicacion, sin ubicacion y sin device', () => {
    expect(
      getEventDeviceDisplayName({
        deviceId: 'dev-1',
        device: {
          id: 'dev-1',
          deviceCode: 'ESP32-MAIN-01',
          name: 'Torniquete Norte',
          location: 'Edificio A, Planta Baja',
        },
      }),
    ).toBe('Torniquete Norte · Edificio A, Planta Baja')

    expect(
      getEventDeviceDisplayName({
        deviceId: 'dev-2',
        device: {
          id: 'dev-2',
          deviceCode: 'ESP32-LAB-02',
          name: 'Puerta Laboratorio',
          location: null,
        },
      }),
    ).toBe('Puerta Laboratorio')

    expect(
      getEventDeviceDisplayName({
        deviceId: '98765432-1111-2222-3333-444455556666',
      }),
    ).toBe('Punto de acceso')
  })
})
