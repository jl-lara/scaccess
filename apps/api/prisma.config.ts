import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma 7 does not load .env automatically. The monorepo keeps a single .env
// at the repository root; load it without printing its contents.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
loadEnv({ path: path.join(projectRoot, '.env'), quiet: true })

// Migrations must use the direct connection (no pooler); fall back to the
// runtime URL when DIRECT_URL is not defined (ADR-0011).
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
