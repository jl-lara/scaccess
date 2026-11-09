import type { Request, Response } from 'express'
import { getValidated } from '../../middleware/validate.js'
import type {
  CreateCredentialBody,
  CredentialListQuery,
  UpdateCredentialBody,
} from './credentials.schemas.js'
import type { CredentialsService } from './credentials.service.js'

interface IdParams {
  id: string
}

export function createCredentialsController(service: CredentialsService) {
  return {
    list: async (_req: Request, res: Response) => {
      const { query } = getValidated<unknown, CredentialListQuery, unknown>(res)
      res.json(await service.list(query))
    },

    getById: async (_req: Request, res: Response) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res)
      res.json(await service.getById(params.id))
    },

    create: async (_req: Request, res: Response) => {
      const { body } = getValidated<CreateCredentialBody, unknown, unknown>(res)
      res.status(201).json(await service.create(body))
    },

    update: async (_req: Request, res: Response) => {
      const { params, body } = getValidated<UpdateCredentialBody, unknown, IdParams>(res)
      res.json(await service.update(params.id, body))
    },
  }
}
