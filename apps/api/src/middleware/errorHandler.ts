import type { ErrorRequestHandler } from 'express'
import type { ApiErrorBody } from '@scaccess/shared'
import { ZodError } from 'zod'
import { isProduction } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

interface BodyParserError extends Error {
  status?: number
  type?: string
}

function isBodyParserError(error: unknown): error is BodyParserError {
  if (!(error instanceof Error)) {
    return false
  }

  const candidate = error as BodyParserError
  return (
    typeof candidate.status === 'number' ||
    (typeof candidate.type === 'string' && candidate.type.startsWith('entity.'))
  )
}

function formatErrorForLog(error: unknown): unknown {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : 'Unknown error'
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = {
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
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.issues,
      },
    }
    res.status(400).json(body)
    return
  }

  if (isBodyParserError(error)) {
    if (error.status === 413 || error.type === 'entity.too.large') {
      const body: ApiErrorBody = {
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload too large',
        },
      }
      res.status(413).json(body)
      return
    }

    if (
      error instanceof SyntaxError ||
      error.status === 400 ||
      error.type === 'entity.parse.failed'
    ) {
      const body: ApiErrorBody = {
        error: {
          code: 'BAD_REQUEST',
          message: 'Malformed JSON payload',
        },
      }
      res.status(400).json(body)
      return
    }
  }

  console.error('[api] unhandled error', formatErrorForLog(error))

  const body: ApiErrorBody = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'Internal server error' : 'Unexpected error',
    },
  }
  res.status(500).json(body)
}
