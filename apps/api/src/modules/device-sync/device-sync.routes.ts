import { Router } from 'express'
import { requireDeviceAuth } from '../../middleware/deviceAuth.js'
import { validateRequest } from '../../middleware/validate.js'
import {
  getDeviceSyncHandler,
  syncDeviceEventsHandler,
} from './device-sync.controller.js'
import { deviceEventSyncBodySchema } from './device-sync.schemas.js'

export const deviceSyncRouter = Router()

deviceSyncRouter.get('/:deviceId/sync', requireDeviceAuth, getDeviceSyncHandler)

deviceSyncRouter.post(
  '/:deviceId/events/sync',
  requireDeviceAuth,
  validateRequest({ body: deviceEventSyncBodySchema }),
  syncDeviceEventsHandler,
)
