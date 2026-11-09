import { Router } from 'express'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validateRequest } from '../../middleware/validate.js'
import { createEmployeesController } from './employees.controller.js'
import {
  createEmployeeBodySchema,
  employeeIdParamsSchema,
  employeeListQuerySchema,
  updateEmployeeBodySchema,
} from './employees.schemas.js'
import { createEmployeesService, type EmployeesService } from './employees.service.js'

export function createEmployeesRouter(
  service: EmployeesService = createEmployeesService(),
): Router {
  const router = Router()
  const controller = createEmployeesController(service)

  router.get(
    '/',
    requireAuth,
    requireRoles('admin', 'operator', 'auditor'),
    validateRequest({ query: employeeListQuerySchema }),
    controller.list,
  )

  router.get(
    '/:id',
    requireAuth,
    requireRoles('admin', 'operator', 'auditor'),
    validateRequest({ params: employeeIdParamsSchema }),
    controller.getById,
  )

  router.post(
    '/',
    requireAuth,
    requireRoles('admin', 'operator'),
    validateRequest({ body: createEmployeeBodySchema }),
    controller.create,
  )

  router.patch(
    '/:id',
    requireAuth,
    requireRoles('admin', 'operator'),
    validateRequest({ params: employeeIdParamsSchema, body: updateEmployeeBodySchema }),
    controller.update,
  )

  return router
}

export const employeesRouter = createEmployeesRouter()
