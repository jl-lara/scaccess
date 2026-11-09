import { Router } from 'express'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { getRoles } from './roles.controller.js'

export const rolesRouter = Router()

rolesRouter.get('/', requireAuth, requireRoles('admin'), getRoles)
