import type {
  DeviceEventSyncResponse,
  DeviceSyncPayload,
} from '@scaccess/shared'
import type { Request, Response } from 'express'
import { getAuthenticatedDevice } from '../../middleware/deviceAuth.js'
import { getValidated } from '../../middleware/validate.js'
import type { DeviceEventSyncBody } from './device-sync.schemas.js'
import {
  buildDeviceSyncPayload,
  recordDeviceSync,
  syncDeviceEvents,
} from './device-sync.service.js'

function normalizeIfNoneMatch(header: string | string[] | undefined): string | null {
  const rawHeader = Array.isArray(header) ? header[0] : header

  if (!rawHeader) {
    return null
  }

  const trimmed = rawHeader.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

export async function getDeviceSyncHandler(
  req: Request,
  res: Response<DeviceSyncPayload>,
): Promise<void> {
  const device = getAuthenticatedDevice(req, res)
  const syncVersion = String(device.configVersion)

  if (normalizeIfNoneMatch(req.headers['if-none-match']) === syncVersion) {
    await recordDeviceSync(device.id, device.configVersion)
    res.status(304).end()
    return
  }

  const payload = await buildDeviceSyncPayload(device)
  await recordDeviceSync(device.id, device.configVersion)

  res.setHeader('ETag', `"${syncVersion}"`)
  res.status(200).json(payload)
}

export async function syncDeviceEventsHandler(
  req: Request,
  res: Response<DeviceEventSyncResponse>,
): Promise<void> {
  const device = getAuthenticatedDevice(req, res)
  const { body } = getValidated<DeviceEventSyncBody>(res)
  const result = await syncDeviceEvents(device, body)

  res.status(200).json(result)
}
