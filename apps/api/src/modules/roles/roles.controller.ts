import type { RequestHandler } from 'express'
import { listRoles } from './roles.service.js'

export const getRoles: RequestHandler = async (_req, res, next) => {
  try {
    const roles = await listRoles()
    res.status(200).json(roles)
  } catch (error) {
    next(error)
  }
}
