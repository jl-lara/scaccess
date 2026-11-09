import { Router } from 'express'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validateRequest } from '../../middleware/validate.js'
import {
  accessDeviceCredentialParamsSchema,
  accessDeviceIdParamsSchema,
  createAccessDeviceBodySchema,
  listAccessDevicesQuerySchema,
  updateAccessDeviceBodySchema,
} from './access-devices.schemas.js'
import {
  createAccessDeviceHandler,
  getAccessDeviceHandler,
  getDeviceSyncStateHandler,
  issueDeviceCredentialHandler,
  listAccessDevicesHandler,
  revokeDeviceCredentialHandler,
  updateAccessDeviceHandler,
} from './access-devices.controller.js'

export const accessDevicesRouter = Router()

accessDevicesRouter.get(
  '/',
  requireAuth,
  requireRoles('admin', 'operator', 'auditor'),
  validateRequest({ query: listAccessDevicesQuerySchema }),
  listAccessDevicesHandler,
)

accessDevicesRouter.post(
  '/',
  requireAuth,
  requireRoles('admin'),
  validateRequest({ body: createAccessDeviceBodySchema }),
  createAccessDeviceHandler,
)

accessDevicesRouter.get(
  '/:id/sync-state',
  requireAuth,
  requireRoles('admin', 'operator', 'auditor'),
  validateRequest({ params: accessDeviceIdParamsSchema }),
  getDeviceSyncStateHandler,
)

accessDevicesRouter.post(
  '/:id/credentials',
  requireAuth,
  requireRoles('admin'),
  validateRequest({ params: accessDeviceIdParamsSchema }),
  issueDeviceCredentialHandler,
)

accessDevicesRouter.post(
  '/:id/credentials/:credentialId/revoke',
  requireAuth,
  requireRoles('admin'),
  validateRequest({ params: accessDeviceCredentialParamsSchema }),
  revokeDeviceCredentialHandler,
)

accessDevicesRouter.get(
  '/:id',
  requireAuth,
  requireRoles('admin', 'operator', 'auditor'),
  validateRequest({ params: accessDeviceIdParamsSchema }),
  getAccessDeviceHandler,
)

accessDevicesRouter.patch(
  '/:id',
  requireAuth,
  requireRoles('admin'),
  validateRequest({
    params: accessDeviceIdParamsSchema,
    body: updateAccessDeviceBodySchema,
  }),
  updateAccessDeviceHandler,
)
