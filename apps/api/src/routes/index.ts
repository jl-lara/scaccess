import { Router } from 'express'
import { accessDevicesRouter } from '../modules/access-devices/access-devices.routes.js'
import {
  accessEventsRouter,
  myAccessEventsRouter,
} from '../modules/access-events/access-events.routes.js'
import { accessPermissionsRouter } from '../modules/access-permissions/access-permissions.routes.js'
import { areasRouter } from '../modules/areas/areas.routes.js'
import { authRouter } from '../modules/auth/auth.routes.js'
import { credentialsRouter } from '../modules/credentials/credentials.routes.js'
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js'
import { deviceSyncRouter } from '../modules/device-sync/device-sync.routes.js'
import { employeesRouter } from '../modules/employees/employees.routes.js'
import { healthRouter } from '../modules/health/health.routes.js'
import { openApiRouter } from '../modules/openapi/openapi.routes.js'
import { rolesRouter } from '../modules/roles/roles.routes.js'
import { usersRouter } from '../modules/users/users.routes.js'

export const v1Router = Router()

v1Router.use('/health', healthRouter)

// Documentation lives at /api/v1/openapi.json and /api/v1/docs.
v1Router.use('/', openApiRouter)

v1Router.use('/auth', authRouter)
v1Router.use('/roles', rolesRouter)
v1Router.use('/users', usersRouter)
v1Router.use('/areas', areasRouter)
v1Router.use('/employees', employeesRouter)
v1Router.use('/credentials', credentialsRouter)
v1Router.use('/access-permissions', accessPermissionsRouter)
v1Router.use('/access-devices', accessDevicesRouter)
v1Router.use('/devices', deviceSyncRouter)
v1Router.use('/access-events', accessEventsRouter)
v1Router.use('/me/access-events', myAccessEventsRouter)
v1Router.use('/dashboard', dashboardRouter)
