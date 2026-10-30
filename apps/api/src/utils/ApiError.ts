export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = 'Insufficient permissions'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message)
  }

  static badRequest(message = 'Invalid request', details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }
}
