import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, RequestHandler, Response } from 'express'
import type { DeviceStatus } from '@scaccess/shared'
import { getPrismaClient } from '../config/prisma.js'
import { ApiError } from '../utils/ApiError.js'

export interface AuthenticatedDevice {
  id: string
  deviceCode: string
  status: DeviceStatus
  configVersion: bigint
  tokenId: string
}

export type DeviceAuthResolver = (
  token: string,
  deviceIdentifier: string,
) => Promise<AuthenticatedDevice | null>

interface RequestWithDevice extends Request {
  device?: AuthenticatedDevice
}

interface DeviceLocals {
  device?: AuthenticatedDevice
}

let deviceAuthResolver: DeviceAuthResolver | null = null

/**
 * Injects a device resolver so tests do not need a database. Passing `null`
 * restores the database-backed resolver.
 */
export function setDeviceAuthResolver(resolver: DeviceAuthResolver | null): void {
  deviceAuthResolver = resolver
}

export function hashDeviceSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex')
}

export function verifyDeviceSecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashDeviceSecret(secret), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')

  if (actual.length !== expected.length) {
    return false
  }

  return timingSafeEqual(actual, expected)
}

export function generateDeviceToken(): {
  tokenId: string
  secret: string
  token: string
  secretHash: string
} {
  const tokenId = `devtok_${randomBytes(8).toString('hex')}`
  const secret = randomBytes(32).toString('hex')

  return {
    tokenId,
    secret,
    token: `${tokenId}.${secret}`,
    secretHash: hashDeviceSecret(secret),
  }
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

async function resolveDatabaseDevice(
  token: string,
  _deviceIdentifier: string,
): Promise<AuthenticatedDevice | null> {
  const separatorIndex = token.indexOf('.')
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return null
  }

  const tokenId = token.slice(0, separatorIndex)
  const secret = token.slice(separatorIndex + 1)

  const credential = await getPrismaClient().deviceCredential.findUnique({
    where: { tokenId },
    include: { device: true },
  })

  if (!credential) {
    return null
  }

  if (credential.revokedAt !== null) {
    return null
  }

  if (credential.expiresAt !== null && credential.expiresAt.getTime() <= Date.now()) {
    return null
  }

  if (!verifyDeviceSecret(secret, credential.secretHash)) {
    return null
  }

  const { device } = credential

  return {
    id: device.id,
    deviceCode: device.deviceCode,
    status: device.status,
    configVersion: device.configVersion,
    tokenId: credential.tokenId,
  }
}

export function getAuthenticatedDevice(req: Request, res?: Response): AuthenticatedDevice {
  const request = req as RequestWithDevice
  const locals = res?.locals as DeviceLocals | undefined
  const device = request.device ?? locals?.device

  if (!device) {
    throw ApiError.unauthorized('Device authentication required')
  }

  return device
}

export const requireDeviceAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = extractBearerToken(req)
    if (!token) {
      throw ApiError.unauthorized('Device authentication required')
    }

    const deviceIdentifier = req.params.deviceId
    if (typeof deviceIdentifier !== 'string' || deviceIdentifier.length === 0) {
      throw ApiError.badRequest('Device identifier is required')
    }

    const resolver = deviceAuthResolver ?? resolveDatabaseDevice
    const device = await resolver(token, deviceIdentifier)

    if (!device) {
      throw ApiError.unauthorized('Invalid device credentials')
    }

    if (device.id !== deviceIdentifier && device.deviceCode !== deviceIdentifier) {
      throw ApiError.forbidden('Device token does not match requested device')
    }

    if (device.status !== 'active') {
      throw ApiError.forbidden('Device is not active')
    }

    const request = req as RequestWithDevice
    request.device = device

    const locals = res.locals as DeviceLocals
    locals.device = device

    next()
  } catch (error) {
    next(error)
  }
}
