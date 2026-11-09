import type { Request, Response } from 'express'
import { getAuthenticatedUser } from '../../middleware/auth.js'
import { getValidated } from '../../middleware/validate.js'
import type {
  AccessPermissionListQuery,
  CreateAccessPermissionBody,
} from './access-permissions.schemas.js'
import type { AccessPermissionsService } from './access-permissions.service.js'

interface IdParams {
  id: string
}

export function createAccessPermissionsController(service: AccessPermissionsService) {
  return {
    list: async (_req: Request, res: Response) => {
      const { query } = getValidated<unknown, AccessPermissionListQuery, unknown>(res)
      res.json(await service.list(query))
    },

    create: async (req: Request, res: Response) => {
      const { body } = getValidated<CreateAccessPermissionBody, unknown, unknown>(res)
      const user = getAuthenticatedUser(req, res)
      res.status(201).json(await service.create(body, user.id))
    },

    revoke: async (_req: Request, res: Response) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res)
      res.json(await service.revoke(params.id))
    },
  }
}
