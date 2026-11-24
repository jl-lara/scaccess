/* global console, process */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REQUIRED_TABLES = [
  'employees',
  'credentials',
  'areas',
  'access_permissions',
  'access_events',
  'access_devices',
]

function loadRootEnv(rootDir) {
  const envPath = path.join(rootDir, '.env')
  if (!existsSync(envPath)) return

  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function assertBinary(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    console.error(
      `[db:backup] No se encontro '${command}' en el PATH. Instala PostgreSQL 17 client tools (pg_dump / pg_restore) y vuelve a intentarlo.`,
    )
    process.exit(1)
  }
  return result.stdout.trim()
}

function resolvePostgres17Binary(command) {
  if (process.platform === 'linux') {
    const versionedBinary = `/usr/lib/postgresql/17/bin/${command}`
    const result = spawnSync(versionedBinary, ['--version'], { encoding: 'utf8' })
    if (!result.error && result.status === 0) return versionedBinary
  }
  return command
}

function validateBackupUrl(dbUrl) {
  let parsed
  try {
    parsed = new URL(dbUrl)
  } catch {
    console.error('[db:backup] SUPABASE_DB_BACKUP_URL no tiene un formato URI valido.')
    process.exit(1)
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    console.error('[db:backup] SUPABASE_DB_BACKUP_URL debe usar el esquema postgresql://.')
    process.exit(1)
  }
  if (parsed.port !== '5432' || !parsed.hostname.includes('.pooler.supabase.com')) {
    console.error(
      '[db:backup] SUPABASE_DB_BACKUP_URL debe usar el Session Pooler de Supabase (puerto 5432).',
    )
    process.exit(1)
  }
  if (!parsed.username.startsWith('postgres.') || parsed.username === 'postgres.') {
    console.error(
      '[db:backup] El usuario del pooler debe tener el formato postgres.<project-ref>.',
    )
    process.exit(1)
  }
  if (!parsed.password) {
    console.error('[db:backup] SUPABASE_DB_BACKUP_URL no incluye una contraseña.')
    process.exit(1)
  }
}

function formatUtcTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  )
}

function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const rootDir = path.resolve(scriptDir, '..')

  loadRootEnv(rootDir)

  const dbUrl =
    process.env.SUPABASE_DB_BACKUP_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL

  if (!dbUrl) {
    console.error(
      '[db:backup] Define SUPABASE_DB_BACKUP_URL, DIRECT_URL o DATABASE_URL en el archivo .env raiz o en las variables de entorno.',
    )
    process.exit(1)
  }
  validateBackupUrl(dbUrl)

  const pgDumpBinary = resolvePostgres17Binary('pg_dump')
  const pgRestoreBinary = resolvePostgres17Binary('pg_restore')
  const pgDumpVersion = assertBinary(pgDumpBinary)
  assertBinary(pgRestoreBinary)

  const backupsDir = path.join(rootDir, 'backups')
  mkdirSync(backupsDir, { recursive: true })

  const timestamp = formatUtcTimestamp()
  const dumpFile = path.join(backupsDir, `scaccess-${timestamp}.dump`)

  console.log(`[db:backup] Usando ${pgDumpVersion}`)
  console.log(`[db:backup] Generando respaldo en ${path.relative(rootDir, dumpFile)}...`)

  const dumpResult = spawnSync(
    pgDumpBinary,
    [
      dbUrl,
      '--format=custom',
      '--compress=9',
      '--no-owner',
      '--no-acl',
      '--schema=public',
      `--file=${dumpFile}`,
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, PGSSLMODE: process.env.PGSSLMODE || 'require' },
    },
  )

  if (dumpResult.status !== 0) {
    console.error(
      '[db:backup] Error al ejecutar pg_dump. Verifica que SUPABASE_DB_BACKUP_URL use el usuario postgres.<project-ref>, la contrasena actual de Postgres y el puerto 5432 del Session Pooler.',
    )
    process.exit(dumpResult.status ?? 1)
  }

  const stats = statSync(dumpFile)
  if (stats.size === 0) {
    console.error('[db:backup] El archivo de respaldo quedo vacio.')
    process.exit(1)
  }

  const listResult = spawnSync(pgRestoreBinary, ['--list', dumpFile], {
    encoding: 'utf8',
  })
  if (listResult.status !== 0) {
    console.error('[db:backup] pg_restore --list fallo al verificar el respaldo.')
    if (listResult.stderr) console.error(listResult.stderr)
    process.exit(1)
  }

  const manifest = listResult.stdout
  for (const table of REQUIRED_TABLES) {
    if (!manifest.includes(`TABLE DATA public ${table} `)) {
      console.error(`[db:backup] Falta la tabla critica public.${table} en el respaldo.`)
      process.exit(1)
    }
  }

  const fileBytes = readFileSync(dumpFile)
  const sha256 = createHash('sha256').update(fileBytes).digest('hex')
  const shaFile = `${dumpFile}.sha256`
  writeFileSync(shaFile, `${sha256}  ${path.basename(dumpFile)}\n`, 'utf8')

  const sizeKb = (stats.size / 1024).toFixed(1)
  console.log(`[db:backup] Respaldo verificado correctamente.`)
  console.log(`[db:backup] Archivo: ${path.relative(rootDir, dumpFile)} (${sizeKb} KB)`)
  console.log(`[db:backup] Checksum SHA-256: ${sha256}`)
  console.log(`[db:backup] Archivo SHA-256: ${path.relative(rootDir, shaFile)}`)
}

main()
