import { Router } from 'express'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validateRequest } from '../../middleware/validate.js'
import { createCredentialsController } from './credentials.controller.js'
import {
  createCredentialBodySchema,
  credentialIdParamsSchema,
  credentialListQuerySchema,
  updateCredentialBodySchema,
} from './credentials.schemas.js'
import { createCredentialsService, type CredentialsService } from './credentials.service.js'

export function createCredentialsRouter(
  service: CredentialsService = createCredentialsService(),
): Router {
  const router = Router()
  const controller = createCredentialsController(service)

  router.get(
    '/',
    requireAuth,
    requireRoles('admin', 'operator', 'auditor'),
    validateRequest({ query: credentialListQuerySchema }),
    controller.list,
  )

  router.get(
    '/:id',
    requireAuth,
    requireRoles('admin', 'operator', 'auditor'),
    validateRequest({ params: credentialIdParamsSchema }),
    controller.getById,
  )

  router.post(
    '/',
    requireAuth,
    requireRoles('admin', 'operator'),
    validateRequest({ body: createCredentialBodySchema }),
    controller.create,
  )

  router.patch(
    '/:id',
    requireAuth,
    requireRoles('admin', 'operator'),
    validateRequest({ params: credentialIdParamsSchema, body: updateCredentialBodySchema }),
    controller.update,
  )

  return router
}

export const credentialsRouter = createCredentialsRouter()
