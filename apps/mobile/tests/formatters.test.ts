import { describe, it, expect } from 'vitest'

import { formatCardUid, formatTime, formatDate } from '../src/utils/formatters'

describe('formatters', () => {
  it('agrupa el UID hexadecimal en pares en mayusculas', () => {
    expect(formatCardUid('04a1b2c3d4e5f6')).toBe('04 A1 B2 C3 D4 E5 F6')
  })

  it('formatea la hora en el huso de Tijuana', () => {
    expect(formatTime('2026-11-10T02:41:08.016Z')).toBe('18:41')
  })

  it('devuelve guion largo para fechas invalidas', () => {
    expect(formatTime('no-es-fecha')).toBe('—')
  })

  it('formatea la fecha en Tijuana incluyendo el anio', () => {
    const result = formatDate('2026-11-10T02:41:08.016Z')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('2026')
  })
})
