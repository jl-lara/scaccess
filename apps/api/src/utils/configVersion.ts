import { getPrismaClient } from '../config/prisma.js'

/**
 * Advances the configuration version of every active device that covers at
 * least one of the given areas. When no areas are provided, every active
 * device is bumped.
 */
export async function bumpDevicesConfigVersion(areaIds?: string[]): Promise<void> {
  const prisma = getPrismaClient()

  await prisma.accessDevice.updateMany({
    where: {
      status: 'active',
      ...(areaIds && areaIds.length > 0
        ? { deviceAreas: { some: { areaId: { in: areaIds } } } }
        : {}),
    },
    data: {
      configVersion: { increment: 1n },
    },
  })
}
