import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFoundHandler } from './middleware/notFound.js'
import { v1Router } from './routes/index.js'

function resolveCorsOrigin(rawOrigin: string): true | string[] {
  if (rawOrigin.trim() === '*') {
    return true
  }

  return rawOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

export function createApp(): express.Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: resolveCorsOrigin(env.CORS_ORIGIN) }))
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/v1', v1Router)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export const app = createApp()
