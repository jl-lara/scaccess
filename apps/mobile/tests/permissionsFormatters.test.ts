import type { MyAccessPermissionDto } from '@scaccess/shared'
import { describe, expect, it } from 'vitest'

import {
  formatPermissionSchedule,
  formatValidityRange,
  getPermissionEffectiveStatus,
} from '../src/utils/permissionsFormatters'

function makePermission(
  overrides: Partial<MyAccessPermissionDto> = {},
  areaOverrides: Partial<MyAccessPermissionDto['area']> = {},
): MyAccessPermissionDto {
  return {
    id: 'perm-1',
    areaId: 'area-1',
    validFrom: null,
    validTo: null,
    schedule: null,
    revokedAt: null,
    ...overrides,
    area: {
      id: 'area-1',
      code: 'MAIN_ENTRANCE',
      name: 'Acceso Principal',
      description: null,
      isActive: true,
      timezone: 'America/Tijuana',
      ...areaOverrides,
    },
  }
}

describe('permissionsFormatters', () => {
  describe('getPermissionEffectiveStatus', () => {
    const now = new Date('2026-11-10T12:00:00.000Z')

    it('identifica los 5 estados efectivos de un permiso', () => {
      expect(
        getPermissionEffectiveStatus(
          makePermission({ revokedAt: '2026-11-01T00:00:00.000Z' }),
          now,
        ),
      ).toBe('revoked')

      expect(
        getPermissionEffectiveStatus(
          makePermission({}, { isActive: false }),
          now,
        ),
      ).toBe('area_inactive')

      expect(
        getPermissionEffectiveStatus(
          makePermission({ validFrom: '2026-11-15T00:00:00.000Z' }),
          now,
        ),
      ).toBe('scheduled')

      expect(
        getPermissionEffectiveStatus(
          makePermission({ validTo: '2026-11-09T23:59:59.000Z' }),
          now,
        ),
      ).toBe('expired')

      expect(
        getPermissionEffectiveStatus(
          makePermission({
            validFrom: '2026-11-01T00:00:00.000Z',
            validTo: '2026-11-20T00:00:00.000Z',
          }),
          now,
        ),
      ).toBe('active')
    })

    it('respeta la precedencia revoked > area_inactive > scheduled > expired > active', () => {
      expect(
        getPermissionEffectiveStatus(
          makePermission(
            {
              revokedAt: '2026-11-05T00:00:00.000Z',
              validFrom: '2026-11-20T00:00:00.000Z',
              validTo: '2026-11-01T00:00:00.000Z',
            },
            { isActive: false },
          ),
          now,
        ),
      ).toBe('revoked')

      expect(
        getPermissionEffectiveStatus(
          makePermission(
            {
              validFrom: '2026-11-20T00:00:00.000Z',
              validTo: '2026-11-01T00:00:00.000Z',
            },
            { isActive: false },
          ),
          now,
        ),
      ).toBe('area_inactive')

      expect(
        getPermissionEffectiveStatus(
          makePermission({
            validFrom: '2026-11-20T00:00:00.000Z',
            validTo: '2026-11-01T00:00:00.000Z',
          }),
          now,
        ),
      ).toBe('scheduled')
    })
  })

  describe('formatValidityRange', () => {
    it('formatea ambos null, solo validFrom, solo validTo y ambos presentes', () => {
      expect(formatValidityRange(null, null)).toBe(
        'Permanente (sin vencimiento)',
      )
      expect(formatValidityRange('2026-11-01T12:00:00.000Z', null)).toBe(
        'Desde 01/11/2026',
      )
      expect(formatValidityRange(null, '2026-11-30T12:00:00.000Z')).toBe(
        'Hasta 30/11/2026',
      )
      expect(
        formatValidityRange(
          '2026-11-01T12:00:00.000Z',
          '2026-11-30T12:00:00.000Z',
        ),
      ).toBe('01/11/2026 – 30/11/2026')
    })
  })

  describe('formatPermissionSchedule', () => {
    it('formatea null, undefined, cadena vacia y cadena de texto', () => {
      expect(formatPermissionSchedule(null)).toBe('Cualquier horario (24/7)')
      expect(formatPermissionSchedule(undefined)).toBe('Cualquier horario (24/7)')
      expect(formatPermissionSchedule('   ')).toBe('Cualquier horario (24/7)')
      expect(formatPermissionSchedule('Lunes a Viernes 08:00-17:00')).toBe(
        'Lunes a Viernes 08:00-17:00',
      )
    })

    it('formatea objeto con dias y ventana horaria', () => {
      expect(
        formatPermissionSchedule({
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start: '08:00',
          end: '17:00',
        }),
      ).toBe('Lun, Mar, Mié, Jue, Vie · 08:00–17:00')

      expect(
        formatPermissionSchedule({
          weekdays: [1, 3, 5],
        }),
      ).toBe('Lun, Mié, Vie')

      expect(
        formatPermissionSchedule({
          from: '09:00',
          to: '14:00',
        }),
      ).toBe('09:00–14:00')
    })

    it('formatea arreglos de ventanas y usa fallback para formatos desconocidos', () => {
      expect(formatPermissionSchedule([])).toBe('Cualquier horario (24/7)')

      expect(
        formatPermissionSchedule([
          { days: ['mon', 'wed'], start: '08:00', end: '12:00' },
          { days: ['sat'], startTime: '09:00', endTime: '13:00' },
        ]),
      ).toBe('Lun, Mié · 08:00–12:00 · Sáb · 09:00–13:00')

      expect(formatPermissionSchedule({ mode: 'custom_rule' })).toBe(
        'Horario personalizado',
      )
      expect(formatPermissionSchedule(42)).toBe('Horario personalizado')
    })
  })
})
