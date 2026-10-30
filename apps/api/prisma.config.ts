import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma 7 does not load .env automatically. The monorepo keeps a single .env
// at the repository root; load it without printing its contents.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
loadEnv({ path: path.join(projectRoot, '.env'), quiet: true })

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
