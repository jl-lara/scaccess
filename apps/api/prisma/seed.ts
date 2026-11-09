import { disconnectPrisma, getPrismaClient } from '../src/config/prisma.js'

const systemRoles = [
  {
    code: 'admin',
    name: 'Administrador',
    description: 'Acceso completo a la administracion del sistema',
  },
  {
    code: 'operator',
    name: 'Operador',
    description: 'Gestion de empleados, tarjetas, permisos y dispositivos',
  },
  {
    code: 'auditor',
    name: 'Auditor',
    description: 'Consulta del historial de accesos y reportes',
  },
] as const

const baseAreas = [
  {
    code: 'MAIN_ENTRANCE',
    name: 'Acceso Principal',
    description: 'Entrada principal de la instalacion',
  },
  {
    code: 'LAB_ELECTRONICS',
    name: 'Laboratorio de Electronica',
    description: 'Laboratorio de electronica',
  },
] as const

const TIMEZONE = 'America/Tijuana'

async function seed(): Promise<void> {
  const prisma = getPrismaClient()

  for (const role of systemRoles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    })
  }

  for (const area of baseAreas) {
    await prisma.area.upsert({
      where: { code: area.code },
      update: {
        name: area.name,
        description: area.description,
        timezone: TIMEZONE,
      },
      create: {
        code: area.code,
        name: area.name,
        description: area.description,
        timezone: TIMEZONE,
      },
    })
  }

  console.log('[seed] system roles and base areas are ready')
}

async function main(): Promise<void> {
  try {
    await seed()
  } finally {
    await disconnectPrisma()
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed', error)
  process.exitCode = 1
})
