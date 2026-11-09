import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

// Single .env at the repository root. Works the same from src/config (tsx)
// and dist/config (compiled output).
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDirectory, '../../../..')
loadEnv({ path: path.join(projectRoot, '.env'), quiet: true })

const postgresUrl = z.string().refine(
  (value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'postgres:' || url.protocol === 'postgresql:'
    } catch {
      return false
    }
  },
  { message: 'must be a postgres:// or postgresql:// URL' },
)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  DATABASE_URL: postgresUrl.optional(),
  DIRECT_URL: postgresUrl.optional(),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

function loadEnvironment(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')

    throw new Error(`Invalid environment configuration:\n${issues}`)
  }

  return result.data
}

export const env = loadEnvironment()

export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'
