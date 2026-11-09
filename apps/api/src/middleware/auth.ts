import type { Request, RequestHandler, Response } from 'express'
import type { AccountStatus } from '@scaccess/shared'
import { env } from '../config/env.js'
import { getPrismaClient } from '../config/prisma.js'
import { ApiError } from '../utils/ApiError.js'

export interface AuthenticatedUser {
  id: string
  authUserId: string
  employeeId: string | null
  email: string
  status: AccountStatus
  roles: string[]
}

export type AuthTokenResolver = (token: string) => Promise<AuthenticatedUser | null>

interface RequestWithUser extends Request {
  user?: AuthenticatedUser
}

interface AuthLocals {
  user?: AuthenticatedUser
}

let authTokenResolver: AuthTokenResolver | null = null

/**
 * Injects a token resolver so tests (and alternative identity providers) do
 * not need network access. Passing `null` restores the Supabase resolver.
 */
export function setAuthTokenResolver(resolver: AuthTokenResolver | null): void {
  authTokenResolver = resolver
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header) {
    return null
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1]?.trim()
  return token && token.length > 0 ? token : null
}

async function resolveSupabaseUser(token: string): Promise<AuthenticatedUser | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw ApiError.unauthorized('Authentication is not configured')
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as { id?: unknown }
  const authUserId = typeof payload.id === 'string' ? payload.id : null
  if (!authUserId) {
    return null
  }

  const account = await getPrismaClient().userAccount.findUnique({
    where: { authUserId },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  })

  if (!account) {
    return null
  }

  return {
    id: account.id,
    authUserId: account.authUserId,
    employeeId: account.employeeId,
    email: account.email,
    status: account.status,
    roles: account.userRoles.map((userRole) => userRole.role.code),
  }
}

export function getAuthenticatedUser(req: Request, res?: Response): AuthenticatedUser {
  const request = req as RequestWithUser
  const locals = res?.locals as AuthLocals | undefined
  const user = request.user ?? locals?.user

  if (!user) {
    throw ApiError.unauthorized('Authentication required')
  }

  return user
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = extractBearerToken(req)
    if (!token) {
      throw ApiError.unauthorized('Authentication required')
    }

    const resolver = authTokenResolver ?? resolveSupabaseUser
    const user = await resolver(token)

    if (!user) {
      throw ApiError.unauthorized('Invalid or expired token')
    }

    if (user.status !== 'active') {
      throw ApiError.forbidden('Account is not active')
    }

    const request = req as RequestWithUser
    request.user = user

    const locals = res.locals as AuthLocals
    locals.user = user

    next()
  } catch (error) {
    next(error)
  }
}

export function requireRoles(...allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req, res)
      const hasAllowedRole = user.roles.some((role) => allowedRoles.includes(role))

      if (!hasAllowedRole) {
        throw ApiError.forbidden('Insufficient permissions')
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

export const requireEmployeeAccount: RequestHandler = (req, res, next) => {
  try {
    const user = getAuthenticatedUser(req, res)

    if (user.employeeId === null) {
      throw ApiError.forbidden('Employee account required')
    }

    next()
  } catch (error) {
    next(error)
  }
}
