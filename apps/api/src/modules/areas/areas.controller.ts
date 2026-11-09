import type { Request, Response } from 'express'
import { getValidated } from '../../middleware/validate.js'
import type {
  AreaListQuery,
  CreateAreaBody,
  UpdateAreaBody,
} from './areas.schemas.js'
import type { AreasService } from './areas.service.js'

interface IdParams {
  id: string
}

export function createAreasController(service: AreasService) {
  return {
    list: async (_req: Request, res: Response) => {
      const { query } = getValidated<unknown, AreaListQuery, unknown>(res)
      res.json(await service.list(query))
    },

    getById: async (_req: Request, res: Response) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res)
      res.json(await service.getById(params.id))
    },

    create: async (_req: Request, res: Response) => {
      const { body } = getValidated<CreateAreaBody, unknown, unknown>(res)
      res.status(201).json(await service.create(body))
    },

    update: async (_req: Request, res: Response) => {
      const { params, body } = getValidated<UpdateAreaBody, unknown, IdParams>(res)
      res.json(await service.update(params.id, body))
    },
  }
}
