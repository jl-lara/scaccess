import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

export const ADMIN_ALLOWED_ROLES: readonly string[] = [
  'admin',
  'operator',
  'auditor',
  'viewer',
]

export type WebPermissionProfile = 'admin' | 'operator' | 'auditor' | 'viewer'

export interface WebPermissions {
  profile: WebPermissionProfile
  profileLabel: string
  profileSummary: string
  isAdmin: boolean
  canWriteCatalog: boolean
  canManageInfrastructure: boolean
  canManageUsers: boolean
  canViewCatalogs: boolean
  canExportReports: boolean
  canUseSimulator: boolean
}

const PROFILE_TABLE: Record<WebPermissionProfile, WebPermissions> = {
  admin: {
    profile: 'admin',
    profileLabel: 'Administrador',
    profileSummary: 'Control total',
    isAdmin: true,
    canWriteCatalog: true,
    canManageInfrastructure: true,
    canManageUsers: true,
    canViewCatalogs: true,
    canExportReports: true,
    canUseSimulator: true,
  },
  operator: {
    profile: 'operator',
    profileLabel: 'Operador',
    profileSummary: 'Operacion diaria',
    isAdmin: false,
    canWriteCatalog: true,
    canManageInfrastructure: false,
    canManageUsers: false,
    canViewCatalogs: true,
    canExportReports: true,
    canUseSimulator: true,
  },
  auditor: {
    profile: 'auditor',
    profileLabel: 'Auditor',
    profileSummary: 'Solo lectura y reportes',
    isAdmin: false,
    canWriteCatalog: false,
    canManageInfrastructure: false,
    canManageUsers: false,
    canViewCatalogs: true,
    canExportReports: true,
    canUseSimulator: false,
  },
  viewer: {
    profile: 'viewer',
    profileLabel: 'Monitor',
    profileSummary: 'Monitoreo en vivo',
    isAdmin: false,
    canWriteCatalog: false,
    canManageInfrastructure: false,
    canManageUsers: false,
    canViewCatalogs: false,
    canExportReports: false,
    canUseSimulator: false,
  },
}

const PROFILE_PRIORITY: readonly WebPermissionProfile[] = [
  'admin',
  'operator',
  'auditor',
  'viewer',
]

/** Resuelve el perfil y capacidades efectivas de la consola web segun roles. */
export function resolveWebPermissions(roles: readonly string[] | undefined): WebPermissions {
  if (!roles || roles.length === 0) {
    return PROFILE_TABLE.viewer
  }

  for (const candidate of PROFILE_PRIORITY) {
    if (roles.includes(candidate)) {
      return PROFILE_TABLE[candidate]
    }
  }

  return PROFILE_TABLE.viewer
}

/** Hook React con los permisos efectivos de la sesion administrativa actual. */
export function usePermissions(): WebPermissions {
  const { user } = useAuth()
  return useMemo(() => resolveWebPermissions(user?.roles), [user?.roles])
}
