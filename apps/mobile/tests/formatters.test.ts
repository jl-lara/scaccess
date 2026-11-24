import { describe, it, expect } from 'vitest'

import {
  TIJUANA_TIME_ZONE,
  formatCardUid,
  formatTime,
  formatDate,
  formatDateKey,
  formatDayHeading,
} from '../src/utils/formatters'

describe('formatters', () => {
  it('expone la zona horaria de Tijuana', () => {
    expect(TIJUANA_TIME_ZONE).toBe('America/Tijuana')
  })

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

  it('convierte una fecha UTC pasada la medianoche al dia local de Tijuana', () => {
    expect(formatDateKey('2026-11-10T02:30:00Z')).toBe('2026-11-09')
    expect(formatDateKey('2026-11-10T20:00:00Z')).toBe('2026-11-10')
  })

  it('devuelve cadena vacia en formatDateKey cuando la fecha es invalida', () => {
    expect(formatDateKey('fecha-invalida')).toBe('')
  })

  it('formatea encabezados de dia para Hoy, Ayer, fechas anteriores y claves invalidas', () => {
    const now = new Date('2026-11-10T20:00:00Z')

    expect(formatDayHeading('2026-11-10', now)).toBe('Hoy')
    expect(formatDayHeading('2026-11-09', now)).toBe('Ayer')

    const older = formatDayHeading('2026-11-02', now)
    expect(older.charAt(0)).toBe(older.charAt(0).toUpperCase())
    expect(older).toContain('2026')
    expect(older.toLowerCase()).toContain('lunes')

    expect(formatDayHeading('invalid-key', now)).toBe('Fecha desconocida')
    expect(formatDayHeading('', now)).toBe('Fecha desconocida')
  })
})
