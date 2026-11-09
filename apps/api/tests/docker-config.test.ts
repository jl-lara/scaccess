import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

function readRepositoryFile(relativePath: string): string {
  const absolutePath = path.join(repositoryRoot, relativePath)

  expect(existsSync(absolutePath), `${relativePath} should exist`).toBe(true)

  return readFileSync(absolutePath, 'utf8')
}

describe('Dockerfile', () => {
  it('defines the deps, build and runner stages on node:22-alpine', () => {
    const dockerfile = readRepositoryFile('Dockerfile')

    expect(dockerfile).toContain('FROM node:22-alpine AS deps')
    expect(dockerfile).toContain('FROM deps AS build')
    expect(dockerfile).toContain('FROM node:22-alpine AS runner')
  })

  it('installs dependencies, builds the workspaces and prunes dev dependencies', () => {
    const dockerfile = readRepositoryFile('Dockerfile')

    expect(dockerfile).toContain('npm ci --include=dev')
    expect(dockerfile).toContain('npm run build')
    expect(dockerfile).toContain('npm prune --omit=dev')
  })

  it('runs as the unprivileged node user and exposes port 3000', () => {
    const dockerfile = readRepositoryFile('Dockerfile')

    expect(dockerfile).toContain('USER node')
    expect(dockerfile).toContain('EXPOSE 3000')
    expect(dockerfile).toContain('ENV PORT=3000')
    expect(dockerfile).toContain('ENV NODE_ENV=production')
  })

  it('checks /api/v1/health and starts the compiled server', () => {
    const dockerfile = readRepositoryFile('Dockerfile')

    expect(dockerfile).toContain('HEALTHCHECK')
    expect(dockerfile).toContain('--interval=30s')
    expect(dockerfile).toContain('--timeout=5s')
    expect(dockerfile).toContain('--start-period=10s')
    expect(dockerfile).toContain('--retries=3')
    expect(dockerfile).toContain('/api/v1/health')
    expect(dockerfile).toContain('CMD ["node", "apps/api/dist/server.js"]')
  })
})

describe('.dockerignore', () => {
  it('excludes local dependencies, build output, secrets and out-of-scope apps', () => {
    const dockerignore = readRepositoryFile('.dockerignore')
    const entries = dockerignore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))

    const requiredEntries = [
      'node_modules',
      '**/node_modules',
      '**/dist',
      '.git',
      '.gitignore',
      '.env',
      '.env.*',
      '!.env.example',
      '.agents',
      'docs',
      'apps/admin',
      'apps/mobile',
      'apps/api/tests',
      'coverage',
      '*.log',
    ]

    for (const entry of requiredEntries) {
      expect(entries, `missing .dockerignore entry: ${entry}`).toContain(entry)
    }
  })
})

describe('docker-compose.yml', () => {
  it('defines the api service with the expected image and build context', () => {
    const compose = readRepositoryFile('docker-compose.yml')

    expect(compose).toContain('api:')
    expect(compose).toContain('container_name: scaccess-api')
    expect(compose).toContain('image: scaccess-api:latest')
    expect(compose).toContain('context: .')
    expect(compose).toContain('dockerfile: Dockerfile')
    expect(compose).toContain('"${PORT:-3000}:3000"')
  })

  it('loads optional environment variables and keeps the container restarting', () => {
    const compose = readRepositoryFile('docker-compose.yml')

    expect(compose).toContain('path: .env')
    expect(compose).toContain('required: false')
    expect(compose).toContain('NODE_ENV: ${NODE_ENV:-production}')
    expect(compose).toContain('PORT: 3000')
    expect(compose).toContain('restart: unless-stopped')
  })

  it('declares a healthcheck against /api/v1/health', () => {
    const compose = readRepositoryFile('docker-compose.yml')

    expect(compose).toContain('healthcheck:')
    expect(compose).toContain('/api/v1/health')
    expect(compose).toContain('interval: 30s')
    expect(compose).toContain('timeout: 5s')
    expect(compose).toContain('start_period: 10s')
    expect(compose).toContain('retries: 3')
  })
})
