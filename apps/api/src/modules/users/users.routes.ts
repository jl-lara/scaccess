import { Router } from 'express'
import { requireAuth, requireRoles } from '../../middleware/auth.js'
import { validateRequest } from '../../middleware/validate.js'
import { getUsers, getUser, patchUser, postUser } from './users.controller.js'
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from './users.schemas.js'

export const usersRouter = Router()

usersRouter.use(requireAuth, requireRoles('admin'))

usersRouter.get('/', validateRequest({ query: listUsersQuerySchema }), getUsers)

usersRouter.get('/:id', validateRequest({ params: userIdParamsSchema }), getUser)

usersRouter.post('/', validateRequest({ body: createUserSchema }), postUser)

usersRouter.patch(
  '/:id',
  validateRequest({ params: userIdParamsSchema, body: updateUserSchema }),
  patchUser,
)
