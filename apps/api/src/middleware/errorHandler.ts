import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { isProduction } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

interface ErrorResponseBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    const body: ErrorResponseBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    }
    res.status(error.statusCode).json(body)
    return
  }

  if (error instanceof ZodError) {
    const body: ErrorResponseBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.issues,
      },
    }
    res.status(400).json(body)
    return
  }

  console.error('[api] unhandled error', error)

  const body: ErrorResponseBody = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'Internal server error' : 'Unexpected error',
    },
  }
  res.status(500).json(body)
}
