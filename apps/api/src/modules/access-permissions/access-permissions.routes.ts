import { Router } from 'express'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validateRequest } from '../../middleware/validate.js'
import { createAccessPermissionsController } from './access-permissions.controller.js'
import {
  accessPermissionIdParamsSchema,
  accessPermissionListQuerySchema,
  createAccessPermissionBodySchema,
} from './access-permissions.schemas.js'
import {
  createAccessPermissionsService,
  type AccessPermissionsService,
} from './access-permissions.service.js'

export function createAccessPermissionsRouter(
  service: AccessPermissionsService = createAccessPermissionsService(),
): Router {
  const router = Router()
  const controller = createAccessPermissionsController(service)

  router.get(
    '/',
    requireAuth,
    requireRoles('admin', 'operator', 'auditor'),
    validateRequest({ query: accessPermissionListQuerySchema }),
    controller.list,
  )

  router.post(
    '/',
    requireAuth,
    requireRoles('admin', 'operator'),
    validateRequest({ body: createAccessPermissionBodySchema }),
    controller.create,
  )

  router.post(
    '/:id/revoke',
    requireAuth,
    requireRoles('admin', 'operator'),
    validateRequest({ params: accessPermissionIdParamsSchema }),
    controller.revoke,
  )

  return router
}

export const accessPermissionsRouter = createAccessPermissionsRouter()
