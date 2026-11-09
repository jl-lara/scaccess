import type { RequestHandler } from 'express'
import { getAuthenticatedUser } from '../../middleware/auth.js'
import { getAuthenticatedProfile } from './auth.service.js'

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const currentUser = getAuthenticatedUser(req, res)
    const profile = await getAuthenticatedProfile(currentUser.id)
    res.status(200).json(profile)
  } catch (error) {
    next(error)
  }
}
