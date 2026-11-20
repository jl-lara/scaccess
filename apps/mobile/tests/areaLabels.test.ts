import { describe, it, expect } from 'vitest'

import {
  DECISION_LABELS,
  REASON_LABELS,
  getAreaDisplayName,
} from '../src/utils/areaLabels'

describe('areaLabels', () => {
  it('expone las etiquetas de decision en espanol', () => {
    expect(DECISION_LABELS.granted).toBe('Acceso permitido')
    expect(DECISION_LABELS.denied).toBe('Acceso denegado')
  })

  it('expone las etiquetas de motivo en espanol', () => {
    expect(REASON_LABELS.allowed).toBe('Autorizado')
    expect(REASON_LABELS.card_unknown).toBe('Tarjeta no reconocida')
  })

  it('resuelve el nombre de las 6 areas conocidas', () => {
    expect(getAreaDisplayName('8a983ee5-b312-454b-b51b-f53a79ea62ae')).toBe(
      'Acceso Principal (MAIN_ENTRANCE)',
    )
    expect(getAreaDisplayName('b56485d7-1826-435a-b242-701750f87da5')).toBe(
      'Laboratorio de Electrónica (LAB_ELECTRONICS)',
    )
    expect(getAreaDisplayName('24abc3d9-6558-4c79-878a-8a662622d17c')).toBe(
      'Área de Pruebas QA (QA_TEST_AREA)',
    )
    expect(getAreaDisplayName('c89c95b3-0394-459f-b620-6d1b7281e76f')).toBe(
      'Oficinas Administrativas (ADMIN_OFFICES)',
    )
    expect(getAreaDisplayName('3c4a92ce-a31e-42cb-88f4-bbf468d5067b')).toBe(
      'Centro de Datos y Servidores (SERVER_ROOM)',
    )
    expect(getAreaDisplayName('5d4b72a4-acaa-42e3-93b7-9dfcad985f5b')).toBe(
      'Almacén General y Logística (WAREHOUSE_RFID)',
    )
  })

  it('usa el prefijo del id para areas desconocidas', () => {
    expect(getAreaDisplayName('desconocido-1234567890')).toBe('Área desconoc')
  })
})
