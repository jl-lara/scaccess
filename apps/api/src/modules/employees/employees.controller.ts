import type { Request, Response } from 'express'
import { getValidated } from '../../middleware/validate.js'
import type {
  CreateEmployeeBody,
  EmployeeListQuery,
  UpdateEmployeeBody,
} from './employees.schemas.js'
import type { EmployeesService } from './employees.service.js'

interface IdParams {
  id: string
}

export function createEmployeesController(service: EmployeesService) {
  return {
    list: async (_req: Request, res: Response) => {
      const { query } = getValidated<unknown, EmployeeListQuery, unknown>(res)
      res.json(await service.list(query))
    },

    getById: async (_req: Request, res: Response) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res)
      res.json(await service.getById(params.id))
    },

    create: async (_req: Request, res: Response) => {
      const { body } = getValidated<CreateEmployeeBody, unknown, unknown>(res)
      res.status(201).json(await service.create(body))
    },

    update: async (_req: Request, res: Response) => {
      const { params, body } = getValidated<UpdateEmployeeBody, unknown, IdParams>(res)
      res.json(await service.update(params.id, body))
    },
  }
}
