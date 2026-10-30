import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { env } from './env.js'

let prismaClient: PrismaClient | undefined

/**
 * Lazily creates the Prisma client so the API can start (for example, to serve
 * the health endpoint) without database credentials configured.
 */
export function getPrismaClient(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not configured. Set it in the root .env file before using the database.',
    )
  }

  if (!prismaClient) {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
    prismaClient = new PrismaClient({ adapter })
  }

  return prismaClient
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect()
    prismaClient = undefined
  }
}
