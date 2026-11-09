import { Router } from 'express'
import {
  requireAuth,
  requireEmployeeAccount,
  requireRoles,
} from '../../middleware/auth.js'
import { validateRequest } from '../../middleware/validate.js'
import {
  accessEventIdParamsSchema,
  accessEventListQuerySchema,
  myAccessEventsQuerySchema,
} from './access-events.schemas.js'
import {
  getAccessEventHandler,
  getMyAccessEventHandler,
  listAccessEventsHandler,
  listMyAccessEventsHandler,
} from './access-events.controller.js'

/**
 * Administrative history: read-only. There is intentionally no PATCH or
 * DELETE route because access events are immutable.
 */
export const accessEventsRouter = Router()

accessEventsRouter.get(
  '/',
  requireAuth,
  requireRoles('admin', 'operator', 'auditor'),
  validateRequest({ query: accessEventListQuerySchema }),
  listAccessEventsHandler,
)

accessEventsRouter.get(
  '/:id',
  requireAuth,
  requireRoles('admin', 'operator', 'auditor'),
  validateRequest({ params: accessEventIdParamsSchema }),
  getAccessEventHandler,
)

/**
 * Employee-facing history for the mobile app. The employee identity always
 * comes from the authenticated account.
 */
export const myAccessEventsRouter = Router()

myAccessEventsRouter.get(
  '/',
  requireAuth,
  requireEmployeeAccount,
  validateRequest({ query: myAccessEventsQuerySchema }),
  listMyAccessEventsHandler,
)

myAccessEventsRouter.get(
  '/:id',
  requireAuth,
  requireEmployeeAccount,
  validateRequest({ params: accessEventIdParamsSchema }),
  getMyAccessEventHandler,
)
