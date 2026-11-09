import type { RequestHandler } from 'express'
import { getDashboardSummary } from './dashboard.service.js'

export const getSummary: RequestHandler = async (_req, res, next) => {
  try {
    const summary = await getDashboardSummary()
    res.status(200).json(summary)
  } catch (error) {
    next(error)
  }
}
