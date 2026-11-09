import type { UserAccountDto } from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'
import { ApiError } from '../../utils/ApiError.js'
import { toUserAccountDto } from '../users/users.service.js'

const LAST_LOGIN_REFRESH_MS = 5 * 60 * 1000

const userAccountInclude = {
  userRoles: {
    include: { role: true },
  },
} as const

/**
 * Returns the profile for the authenticated account and refreshes
 * `lastLoginAt` when it is missing or older than the refresh window.
 */
export async function getAuthenticatedProfile(userId: string): Promise<UserAccountDto> {
  const prisma = getPrismaClient()

  const account = await prisma.userAccount.findUnique({
    where: { id: userId },
    include: userAccountInclude,
  })

  if (!account) {
    throw ApiError.notFound('User account not found')
  }

  const now = new Date()
  const shouldRefreshLastLogin =
    account.lastLoginAt === null ||
    now.getTime() - account.lastLoginAt.getTime() >= LAST_LOGIN_REFRESH_MS

  if (!shouldRefreshLastLogin) {
    return toUserAccountDto(account)
  }

  const updatedAccount = await prisma.userAccount.update({
    where: { id: userId },
    data: { lastLoginAt: now },
    include: userAccountInclude,
  })

  return toUserAccountDto(updatedAccount)
}
