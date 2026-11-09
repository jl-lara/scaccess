import type { RequestHandler, Response } from 'express'
import type { z } from 'zod'

export interface ValidationSchemas {
  body?: z.ZodType
  query?: z.ZodType
  params?: z.ZodType
}

interface ValidatedRequestData {
  body: unknown
  query: unknown
  params: unknown
}

interface ValidatedLocals {
  validated?: ValidatedRequestData
}

/**
 * Parses the selected request parts and exposes the sanitized values through
 * `res.locals.validated`. The parsed body replaces `req.body` so downstream
 * handlers never see the raw payload.
 */
export function validateRequest(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    try {
      const validated: ValidatedRequestData = {
        body: schemas.body ? schemas.body.parse(req.body) : req.body,
        query: schemas.query ? schemas.query.parse(req.query) : req.query,
        params: schemas.params ? schemas.params.parse(req.params) : req.params,
      }

      if (schemas.body) {
        req.body = validated.body
      }

      const locals = res.locals as ValidatedLocals
      locals.validated = validated

      next()
    } catch (error) {
      next(error)
    }
  }
}

export function getValidated<B = unknown, Q = unknown, P = unknown>(
  res: Response,
): { body: B; query: Q; params: P } {
  const locals = res.locals as ValidatedLocals

  if (!locals.validated) {
    throw new Error('getValidated called before validateRequest')
  }

  return locals.validated as { body: B; query: Q; params: P }
}
