import { describe, it, expect } from 'vitest'

import type { AccessEventDto } from '@scaccess/shared'

import {
  SYNC_DELAY_THRESHOLD_SECONDS,
  formatDurationCompact,
  getSyncDelayInfo,
  groupEventsByDay,
  summarizeAccessEvents,
} from '../src/utils/accessHistory'

function makeEvent(overrides: Partial<AccessEventDto> = {}): AccessEventDto {
  return {
    id: 'evt-1',
    deviceId: 'dev-1',
    clientEventId: 'client-1',
    deviceEpoch: null,
    cardUid: '04a1b2c3',
    employeeId: 'emp-1',
    credentialId: 'cred-1',
    areaId: '8a983ee5-b312-454b-b51b-f53a79ea62ae',
    decision: 'granted',
    reasonCode: 'allowed',
    occurredAt: '2026-11-10T18:00:00.000Z',
    receivedAt: '2026-11-10T18:00:05.000Z',
    deviceSequence: null,
    metadata: null,
    createdAt: '2026-11-10T18:00:05.000Z',
    ...overrides,
  }
}

describe('accessHistory', () => {
  describe('formatDurationCompact', () => {
    it('formatea segundos, minutos, horas y dias de manera compacta', () => {
      expect(formatDurationCompact(45)).toBe('45 s')
      expect(formatDurationCompact(60)).toBe('1 min')
      expect(formatDurationCompact(900)).toBe('15 min')
      expect(formatDurationCompact(7200)).toBe('2 h')
      expect(formatDurationCompact(8100)).toBe('2 h 15 min')
      expect(formatDurationCompact(86400)).toBe('1 d')
      expect(formatDurationCompact(190800)).toBe('2 d 5 h')
    })
  })

  describe('getSyncDelayInfo', () => {
    it('marca sincronizacion en tiempo real cuando el desfase es menor al umbral', () => {
      expect(SYNC_DELAY_THRESHOLD_SECONDS).toBe(60)
      const info = getSyncDelayInfo(
        '2026-11-10T18:00:00.000Z',
        '2026-11-10T18:00:12.000Z',
      )
      expect(info).toEqual({
        delaySeconds: 12,
        isDelayed: false,
        shortLabel: null,
        detailLabel: 'Sincronizado en tiempo real',
      })
    })

    it('marca sincronizacion diferida para minutos, horas, horas+minutos y dias', () => {
      expect(
        getSyncDelayInfo('2026-11-10T18:00:00.000Z', '2026-11-10T18:05:00.000Z'),
      ).toEqual({
        delaySeconds: 300,
        isDelayed: true,
        shortLabel: 'Offline · +5 min',
        detailLabel: 'Lectura offline sincronizada tras 5 min',
      })

      expect(
        getSyncDelayInfo('2026-11-10T18:00:00.000Z', '2026-11-10T20:00:00.000Z'),
      ).toEqual({
        delaySeconds: 7200,
        isDelayed: true,
        shortLabel: 'Offline · +2 h',
        detailLabel: 'Lectura offline sincronizada tras 2 h',
      })

      expect(
        getSyncDelayInfo('2026-11-10T18:00:00.000Z', '2026-11-10T20:15:00.000Z'),
      ).toEqual({
        delaySeconds: 8100,
        isDelayed: true,
        shortLabel: 'Offline · +2 h 15 min',
        detailLabel: 'Lectura offline sincronizada tras 2 h 15 min',
      })

      expect(
        getSyncDelayInfo('2026-11-10T18:00:00.000Z', '2026-11-12T23:00:00.000Z'),
      ).toEqual({
        delaySeconds: 190800,
        isDelayed: true,
        shortLabel: 'Offline · +2 d 5 h',
        detailLabel: 'Lectura offline sincronizada tras 2 d 5 h',
      })
    })

    it('acota desfases negativos a cero segundos', () => {
      const info = getSyncDelayInfo(
        '2026-11-10T18:05:00.000Z',
        '2026-11-10T18:04:30.000Z',
      )
      expect(info).toEqual({
        delaySeconds: 0,
        isDelayed: false,
        shortLabel: null,
        detailLabel: 'Sincronizado en tiempo real',
      })
    })

    it('devuelve estado no disponible cuando alguna fecha es invalida', () => {
      expect(getSyncDelayInfo('invalida', '2026-11-10T18:00:00.000Z')).toEqual({
        delaySeconds: null,
        isDelayed: false,
        shortLabel: null,
        detailLabel: 'Tiempo de sincronización no disponible',
      })
    })
  })

  describe('groupEventsByDay', () => {
    it('agrupa por dia en Tijuana preservando el orden de llegada', () => {
      const now = new Date('2026-11-10T20:00:00.000Z')
      const e1 = makeEvent({ id: 'e1', occurredAt: '2026-11-10T17:00:00.000Z' })
      const e2 = makeEvent({ id: 'e2', occurredAt: '2026-11-10T19:00:00.000Z' })
      // 02:30 UTC del 10 de nov corresponde al 09 de nov 18:30 en Tijuana
      const e3 = makeEvent({ id: 'e3', occurredAt: '2026-11-10T02:30:00.000Z' })
      const e4 = makeEvent({ id: 'e4', occurredAt: '2026-11-05T16:00:00.000Z' })

      const sections = groupEventsByDay([e1, e2, e3, e4], now)

      expect(sections).toHaveLength(3)
      expect(sections[0]?.dateKey).toBe('2026-11-10')
      expect(sections[0]?.title).toBe('Hoy')
      expect(sections[0]?.data.map((item) => item.id)).toEqual(['e1', 'e2'])

      expect(sections[1]?.dateKey).toBe('2026-11-09')
      expect(sections[1]?.title).toBe('Ayer')
      expect(sections[1]?.data.map((item) => item.id)).toEqual(['e3'])

      expect(sections[2]?.dateKey).toBe('2026-11-05')
      expect(sections[2]?.title).toContain('2026')
      expect(sections[2]?.data.map((item) => item.id)).toEqual(['e4'])
    })

    it('devuelve arreglo vacio cuando no hay eventos', () => {
      expect(groupEventsByDay([])).toEqual([])
    })
  })

  describe('summarizeAccessEvents', () => {
    it('calcula conteos de permitidos, denegados, diferidos y total paginado', () => {
      const events = [
        makeEvent({
          id: 'e1',
          decision: 'granted',
          occurredAt: '2026-11-10T19:00:00.000Z',
          receivedAt: '2026-11-10T19:00:03.000Z',
        }),
        makeEvent({
          id: 'e2',
          decision: 'denied',
          reasonCode: 'permission_outside_schedule',
          occurredAt: '2026-11-10T18:00:00.000Z',
          receivedAt: '2026-11-10T18:10:00.000Z',
        }),
        makeEvent({
          id: 'e3',
          decision: 'granted',
          occurredAt: '2026-11-10T17:00:00.000Z',
          receivedAt: '2026-11-10T17:02:00.000Z',
        }),
      ]

      expect(summarizeAccessEvents(events, 25)).toEqual({
        totalCount: 25,
        loadedCount: 3,
        grantedCount: 2,
        deniedCount: 1,
        delayedCount: 2,
        latestOccurredAt: '2026-11-10T19:00:00.000Z',
      })
    })

    it('devuelve conteos en cero y ultima fecha nula para lista vacia', () => {
      expect(summarizeAccessEvents([])).toEqual({
        totalCount: 0,
        loadedCount: 0,
        grantedCount: 0,
        deniedCount: 0,
        delayedCount: 0,
        latestOccurredAt: null,
      })
    })
  })
})
