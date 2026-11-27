import type { AccessEventDto, MyAccessPermissionDto } from '@scaccess/shared'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HISTORY_FILTERS,
  HISTORY_DATE_CHECKLIST,
  HISTORY_DECISION_CHECKLIST,
  buildHistoryQueryParams,
  countActiveHistoryFilters,
  getActiveFilterSummaryLabels,
  getTijuanaStartOfDayIso,
  hasActiveHistoryFilters,
  mergeAreaOptions,
  toggleAreaFilter,
  toggleDatePresetFilter,
  toggleDecisionFilter,
} from '../src/utils/historyFilters'

function makePermission(
  areaId: string,
  name: string,
  code: string,
): MyAccessPermissionDto {
  return {
    id: `perm-${areaId}`,
    areaId,
    validFrom: null,
    validTo: null,
    schedule: null,
    revokedAt: null,
    area: {
      id: areaId,
      code,
      name,
      description: null,
      isActive: true,
      timezone: 'America/Tijuana',
    },
  }
}

function makeEvent(
  id: string,
  areaId: string,
  area?: { id: string; code: string; name: string },
): AccessEventDto {
  return {
    id,
    deviceId: 'dev-1',
    clientEventId: `client-${id}`,
    deviceEpoch: null,
    cardUid: '04A1B2C3D4E5F6',
    employeeId: 'emp-1',
    credentialId: 'cred-1',
    areaId,
    decision: 'granted',
    reasonCode: 'allowed',
    occurredAt: '2026-11-10T10:00:00.000Z',
    receivedAt: '2026-11-10T10:00:01.000Z',
    deviceSequence: null,
    metadata: null,
    createdAt: '2026-11-10T10:00:01.000Z',
    area,
  }
}

describe('historyFilters', () => {
  describe('hasActiveHistoryFilters', () => {
    it('devuelve false para los filtros por defecto', () => {
      expect(hasActiveHistoryFilters(DEFAULT_HISTORY_FILTERS)).toBe(false)
    })

    it('devuelve true cuando decision, datePreset o areaId estan activos', () => {
      expect(
        hasActiveHistoryFilters({
          ...DEFAULT_HISTORY_FILTERS,
          decision: 'denied',
        }),
      ).toBe(true)
      expect(
        hasActiveHistoryFilters({
          ...DEFAULT_HISTORY_FILTERS,
          datePreset: '7d',
        }),
      ).toBe(true)
      expect(
        hasActiveHistoryFilters({
          ...DEFAULT_HISTORY_FILTERS,
          areaId: 'area-1',
        }),
      ).toBe(true)
    })
  })

  describe('getTijuanaStartOfDayIso', () => {
    it('calcula el inicio del dia en Tijuana aunque en UTC ya sea el dia siguiente', () => {
      const utcNextDayInstant = new Date('2026-11-10T02:30:00Z')
      expect(getTijuanaStartOfDayIso(utcNextDayInstant)).toBe(
        '2026-11-09T08:00:00.000Z',
      )
    })

    it('calcula el inicio del dia en Tijuana para un instante dentro del mismo dia local', () => {
      const sameDayInstant = new Date('2026-11-10T20:15:45Z')
      expect(getTijuanaStartOfDayIso(sameDayInstant)).toBe(
        '2026-11-10T08:00:00.000Z',
      )
    })
  })

  describe('buildHistoryQueryParams', () => {
    const fixedNow = new Date('2026-11-10T02:30:00.000Z')

    it('construye parametros base para el preset all sin decision ni areaId', () => {
      expect(
        buildHistoryQueryParams(DEFAULT_HISTORY_FILTERS, 1, 20, fixedNow),
      ).toEqual({
        page: 1,
        pageSize: 20,
      })
    })

    it('calcula from correctamente para los presets today, 7d y 30d', () => {
      expect(
        buildHistoryQueryParams(
          { ...DEFAULT_HISTORY_FILTERS, datePreset: 'today' },
          2,
          15,
          fixedNow,
        ),
      ).toEqual({
        page: 2,
        pageSize: 15,
        from: '2026-11-09T08:00:00.000Z',
      })

      expect(
        buildHistoryQueryParams(
          { ...DEFAULT_HISTORY_FILTERS, datePreset: '7d' },
          1,
          20,
          fixedNow,
        ),
      ).toEqual({
        page: 1,
        pageSize: 20,
        from: '2026-11-03T02:30:00.000Z',
      })

      expect(
        buildHistoryQueryParams(
          { ...DEFAULT_HISTORY_FILTERS, datePreset: '30d' },
          1,
          20,
          fixedNow,
        ),
      ).toEqual({
        page: 1,
        pageSize: 20,
        from: '2026-10-11T02:30:00.000Z',
      })
    })

    it('incluye decision y areaId cuando estan seleccionados', () => {
      expect(
        buildHistoryQueryParams(
          {
            decision: 'denied',
            datePreset: 'today',
            areaId: 'area-lab-1',
          },
          3,
          10,
          fixedNow,
        ),
      ).toEqual({
        page: 3,
        pageSize: 10,
        decision: 'denied',
        areaId: 'area-lab-1',
        from: '2026-11-09T08:00:00.000Z',
      })
    })
  })

  describe('mergeAreaOptions', () => {
    it('deduplica areas entre permisos y eventos y las ordena alfabeticamente', () => {
      const permissions = [
        makePermission('area-2', 'Centro de Datos', 'SERVER_ROOM'),
        makePermission('area-1', 'Acceso Principal', 'MAIN_ENTRANCE'),
      ]
      const events = [
        makeEvent('evt-1', 'area-2', {
          id: 'area-2',
          code: 'SERVER_ROOM',
          name: 'Centro de Datos (duplicado)',
        }),
        makeEvent('evt-2', 'area-3', {
          id: 'area-3',
          code: 'WAREHOUSE',
          name: 'Almacén General',
        }),
        makeEvent('evt-3', 'area-4'),
      ]

      expect(mergeAreaOptions(permissions, events)).toEqual([
        { id: 'area-1', name: 'Acceso Principal', code: 'MAIN_ENTRANCE' },
        { id: 'area-3', name: 'Almacén General', code: 'WAREHOUSE' },
        { id: 'area-2', name: 'Centro de Datos', code: 'SERVER_ROOM' },
      ])
    })
  })

  describe('constantes de checklist', () => {
    it('expone las opciones de decision y periodo en espanol', () => {
      expect(HISTORY_DECISION_CHECKLIST).toEqual([
        { value: 'granted', label: 'Permitidos' },
        { value: 'denied', label: 'Denegados' },
      ])
      expect(HISTORY_DATE_CHECKLIST).toEqual([
        { value: 'today', label: 'Hoy' },
        { value: '7d', label: 'Últimos 7 días' },
        { value: '30d', label: 'Últimos 30 días' },
      ])
    })
  })

  describe('countActiveHistoryFilters', () => {
    it('devuelve 0 para los filtros por defecto', () => {
      expect(countActiveHistoryFilters(DEFAULT_HISTORY_FILTERS)).toBe(0)
    })

    it('cuenta 1, 2 o 3 filtros segun las combinaciones activas', () => {
      expect(
        countActiveHistoryFilters({
          ...DEFAULT_HISTORY_FILTERS,
          decision: 'granted',
        }),
      ).toBe(1)

      expect(
        countActiveHistoryFilters({
          decision: 'denied',
          datePreset: '7d',
          areaId: null,
        }),
      ).toBe(2)

      expect(
        countActiveHistoryFilters({
          decision: 'granted',
          datePreset: '30d',
          areaId: 'area-1',
        }),
      ).toBe(3)
    })
  })

  describe('getActiveFilterSummaryLabels', () => {
    const areaOptions = [
      { id: 'area-1', name: 'Acceso Principal', code: 'MAIN_ENTRANCE' },
      { id: 'area-2', name: 'Laboratorio de Electrónica', code: 'LAB_ELEC' },
    ]

    it('devuelve un arreglo vacio para los filtros por defecto', () => {
      expect(
        getActiveFilterSummaryLabels(DEFAULT_HISTORY_FILTERS, areaOptions),
      ).toEqual([])
    })

    it('devuelve etiquetas ordenadas de decision, periodo y nombre limpio de area sin codigo', () => {
      const labels = getActiveFilterSummaryLabels(
        {
          decision: 'denied',
          datePreset: '7d',
          areaId: 'area-2',
        },
        areaOptions,
      )

      expect(labels).toEqual([
        'Denegados',
        'Últimos 7 días',
        'Laboratorio de Electrónica',
      ])
      expect(labels.join(' ')).not.toContain('LAB_ELEC')
    })

    it('usa la etiqueta de respaldo cuando areaId no esta en areaOptions', () => {
      expect(
        getActiveFilterSummaryLabels(
          {
            decision: 'granted',
            datePreset: 'today',
            areaId: 'area-missing',
          },
          areaOptions,
        ),
      ).toEqual(['Permitidos', 'Hoy', 'Área seleccionada'])
    })
  })

  describe('helpers toggle de filtros', () => {
    it('alterna toggleDecisionFilter entre el objetivo y all', () => {
      expect(toggleDecisionFilter('all', 'granted')).toBe('granted')
      expect(toggleDecisionFilter('granted', 'granted')).toBe('all')
      expect(toggleDecisionFilter('granted', 'denied')).toBe('denied')
    })

    it('alterna toggleDatePresetFilter entre el objetivo y all', () => {
      expect(toggleDatePresetFilter('all', 'today')).toBe('today')
      expect(toggleDatePresetFilter('today', 'today')).toBe('all')
      expect(toggleDatePresetFilter('today', '30d')).toBe('30d')
    })

    it('alterna toggleAreaFilter entre areaId y null', () => {
      expect(toggleAreaFilter(null, 'area-1')).toBe('area-1')
      expect(toggleAreaFilter('area-1', 'area-1')).toBeNull()
      expect(toggleAreaFilter('area-1', 'area-2')).toBe('area-2')
    })
  })
})
