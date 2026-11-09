import { Router } from 'express'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { getSummary } from './dashboard.controller.js'

export const dashboardRouter = Router()

dashboardRouter.get('/summary', requireAuth, requireRoles('admin', 'operator', 'auditor'), getSummary)
