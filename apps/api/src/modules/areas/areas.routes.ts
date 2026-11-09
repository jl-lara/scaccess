import { Router } from 'express'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validateRequest } from '../../middleware/validate.js'
import { createAreasController } from './areas.controller.js'
import {
  areaIdParamsSchema,
  areaListQuerySchema,
  createAreaBodySchema,
  updateAreaBodySchema,
} from './areas.schemas.js'
import { createAreasService, type AreasService } from './areas.service.js'

export function createAreasRouter(service: AreasService = createAreasService()): Router {
  const router = Router()
  const controller = createAreasController(service)

  router.get(
    '/',
    requireAuth,
    requireRoles('admin', 'operator', 'auditor'),
    validateRequest({ query: areaListQuerySchema }),
    controller.list,
  )

  router.get(
    '/:id',
    requireAuth,
    requireRoles('admin', 'operator', 'auditor'),
    validateRequest({ params: areaIdParamsSchema }),
    controller.getById,
  )

  router.post(
    '/',
    requireAuth,
    requireRoles('admin'),
    validateRequest({ body: createAreaBodySchema }),
    controller.create,
  )

  router.patch(
    '/:id',
    requireAuth,
    requireRoles('admin'),
    validateRequest({ params: areaIdParamsSchema, body: updateAreaBodySchema }),
    controller.update,
  )

  return router
}

export const areasRouter = createAreasRouter()
