import { useState } from 'react'
import { Check, Shield } from 'lucide-react'
import { RBAC_ROLES, type RoleProfileId } from '../data/landingContent'
import { Reveal } from './Reveal'

export function RolesSection() {
  const [selectedRoleId, setSelectedRoleId] = useState<RoleProfileId>('admin')

  const activeRole =
    RBAC_ROLES.find((role) => role.id === selectedRoleId) ?? RBAC_ROLES[0]

  if (!activeRole) {
    return null
  }

  return (
    <section id="roles" className="section-white" aria-labelledby="roles-heading">
      <div className="container">
        <Reveal className="section-header">
          <h2 id="roles-heading" className="section-title">
            Permisos granulares para cada perfil operativo.
          </h2>
          <p className="section-lead">
            Cada rol accede únicamente a las vistas y acciones autorizadas por el backend,
            separando la administración institucional de la consulta personal móvil.
          </p>
        </Reveal>

        <div className="role-tabs" role="group" aria-label="Perfiles de acceso">
          {RBAC_ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              className="role-tab"
              aria-pressed={role.id === activeRole.id}
              onClick={() => setSelectedRoleId(role.id)}
            >
              {role.label}
            </button>
          ))}
        </div>

        <div key={activeRole.id} className="role-panel panel-fade-in" aria-live="polite">
          <div className="role-meta">
            <span className="role-surface-badge">{activeRole.surface}</span>
            <h3 className="role-panel-title">{activeRole.label}</h3>
            <p className="role-panel-summary">{activeRole.summary}</p>
          </div>

          <div className="role-columns">
            <div className="role-column">
              <h4 className="role-column-title">Capacidades habilitadas</h4>
              <ul className="role-list role-list-allow">
                {activeRole.permissions.map((permission) => (
                  <li key={permission}>
                    <Check size={16} className="role-list-icon" aria-hidden="true" />
                    <span>{permission}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="role-column">
              <h4 className="role-column-title">Límites de seguridad</h4>
              <ul className="role-list role-list-restrict">
                {activeRole.restrictions.map((restriction) => (
                  <li key={restriction}>
                    <Shield size={16} className="role-list-icon" aria-hidden="true" />
                    <span>{restriction}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
