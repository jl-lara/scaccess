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

  it('resuelve el nombre de un area conocida', () => {
    expect(getAreaDisplayName('8a983ee5-b312-454b-b51b-f53a79ea62ae')).toBe(
      'Acceso Principal (MAIN_ENTRANCE)',
    )
  })

  it('usa el prefijo del id para areas desconocidas', () => {
    expect(getAreaDisplayName('desconocido-1234567890')).toBe('Área desconoc')
  })
})
