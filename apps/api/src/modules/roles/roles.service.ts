import type { RoleDto } from '@scaccess/shared'
import { getPrismaClient } from '../../config/prisma.js'

export async function listRoles(): Promise<RoleDto[]> {
  const roles = await getPrismaClient().role.findMany({
    orderBy: { code: 'asc' },
  })

  return roles.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
  }))
}
