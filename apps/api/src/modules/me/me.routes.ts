import { Router } from 'express'
import { requireAuth, requireEmployeeAccount } from '../../middleware/auth.js'
import { validateRequest } from '../../middleware/validate.js'
import { getMyProfileHandler, listMyPermissionsHandler } from './me.controller.js'
import { myPermissionsQuerySchema } from './me.schemas.js'

/**
 * Employee self-service routes for the mobile app. The employee identity
 * always comes from the authenticated account.
 */
export const meRouter = Router()

meRouter.get('/profile', requireAuth, requireEmployeeAccount, getMyProfileHandler)

meRouter.get(
  '/permissions',
  requireAuth,
  requireEmployeeAccount,
  validateRequest({ query: myPermissionsQuerySchema }),
  listMyPermissionsHandler,
)
