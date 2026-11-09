import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { getMe } from './auth.controller.js'

export const authRouter = Router()

authRouter.get('/me', requireAuth, getMe)
