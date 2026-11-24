import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePermissions } from '../../lib/permissions'

export interface RoleGuardProps {
  require: 'admin' | 'catalogs'
  children: ReactNode
}

/** Protege modulos administrativos segun el perfil web efectivo sin disparar peticiones restringidas. */
export function RoleGuard({ require, children }: RoleGuardProps) {
  const permissions = usePermissions()
  const isAllowed = require === 'admin' ? permissions.isAdmin : permissions.canViewCatalogs

  if (isAllowed) {
    return <>{children}</>
  }

  return (
    <section className="surface-card restricted-card" role="alert">
      <ShieldAlert size={28} aria-hidden="true" />
      <h1 className="page-title">Módulo restringido para tu perfil</h1>
      <p className="restricted-card-profile">
        Perfil activo: {permissions.profileLabel} · {permissions.profileSummary}
      </p>
      <p className="restricted-card-description">
        Tu sesión actual no cuenta con autorización para consultar o administrar este módulo.
      </p>
      <Link to="/" className="btn btn-primary">
        Volver al panel de control
      </Link>
    </section>
  )
}
