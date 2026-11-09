import type { DashboardSummaryDto } from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'

const RECENT_EVENTS_WINDOW_MS = 24 * 60 * 60 * 1000

export async function getDashboardSummary(now: Date = new Date()): Promise<DashboardSummaryDto> {
  const prisma = getPrismaClient()
  const since = new Date(now.getTime() - RECENT_EVENTS_WINDOW_MS)

  const [
    employeesTotal,
    employeesActive,
    credentialsTotal,
    credentialsActive,
    credentialsBlockedOrLost,
    areasTotal,
    areasActive,
    devicesTotal,
    devicesActive,
    activeDevices,
    grantedEvents,
    deniedEvents,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: 'active' } }),
    prisma.credential.count(),
    prisma.credential.count({ where: { status: 'active' } }),
    prisma.credential.count({ where: { status: { in: ['blocked', 'lost'] } } }),
    prisma.area.count(),
    prisma.area.count({ where: { isActive: true } }),
    prisma.accessDevice.count(),
    prisma.accessDevice.count({ where: { status: 'active' } }),
    prisma.accessDevice.findMany({
      where: { status: 'active' },
      select: {
        configVersion: true,
        syncState: { select: { configVersion: true } },
      },
    }),
    prisma.accessEvent.count({
      where: { decision: 'granted', occurredAt: { gte: since } },
    }),
    prisma.accessEvent.count({
      where: { decision: 'denied', occurredAt: { gte: since } },
    }),
  ])

  const outOfSyncDevices = activeDevices.filter(
    (device) => !device.syncState || device.syncState.configVersion < device.configVersion,
  ).length

  return {
    employees: { total: employeesTotal, active: employeesActive },
    credentials: {
      total: credentialsTotal,
      active: credentialsActive,
      blockedOrLost: credentialsBlockedOrLost,
    },
    areas: { total: areasTotal, active: areasActive },
    devices: {
      total: devicesTotal,
      active: devicesActive,
      outOfSync: outOfSyncDevices,
    },
    recentEvents24h: { granted: grantedEvents, denied: deniedEvents },
  }
}
