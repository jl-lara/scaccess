import { Check, LayoutDashboard, Lock, Smartphone } from 'lucide-react'

const ADMIN_HIGHLIGHTS = [
  'Croquis interactivo de áreas con ocupación en vivo',
  'Reportes PDF listos para auditoría institucional',
  'Control de aforo y estado de sincronización por controlador',
] as const

export function EcosystemSection() {
  return (
    <section id="ecosistema" className="section-titanium" aria-labelledby="ecosystem-heading">
      <div className="container">
        <div className="section-header">
          <h2 id="ecosystem-heading" className="section-title">
            Un ecosistema coordinado para quienes administran y quienes ingresan.
          </h2>
          <p className="section-lead">
            Desde la operación central del campus hasta el historial personal de cada colaborador,
            con reglas de acceso claras en cada capa.
          </p>
        </div>

        <div className="bento-grid">
          <article className="bento-featured">
            <div>
              <span className="bento-icon-wrap">
                <LayoutDashboard size={22} aria-hidden="true" />
              </span>
              <h3 className="bento-title">Consola Web Administrativa</h3>
              <p className="bento-copy">
                Supervisa entradas, altas de personal, tarjetas RFID, áreas y dispositivos ESP32-S3
                desde un panel claro diseñado para operación diaria.
              </p>
              <ul className="bento-feature-list">
                {ADMIN_HIGHLIGHTS.map((item) => (
                  <li key={item}>
                    <Check size={16} color="#0d9488" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="floorplan-preview" aria-label="Vista esquemática de croquis en vivo">
              <div className="floorplan-header">
                <p className="floorplan-title">Croquis en vivo · Edificio de Ingeniería</p>
                <span className="floorplan-badge">4 áreas activas</span>
              </div>
              <div className="floorplan-zones">
                <div className="floorplan-zone">
                  <p className="floorplan-zone-name">Laboratorio Redes</p>
                  <p className="floorplan-zone-meta">Aforo 14 / 24 · ESP32-01</p>
                </div>
                <div className="floorplan-zone">
                  <p className="floorplan-zone-name">Centro de Datos</p>
                  <p className="floorplan-zone-meta">Aforo 2 / 4 · ESP32-02</p>
                </div>
                <div className="floorplan-zone">
                  <p className="floorplan-zone-name">Taller Prototipos</p>
                  <p className="floorplan-zone-meta">Aforo 9 / 18 · ESP32-03</p>
                </div>
                <div className="floorplan-zone">
                  <p className="floorplan-zone-name">Archivo Técnico</p>
                  <p className="floorplan-zone-meta">Aforo 1 / 6 · ESP32-04</p>
                </div>
              </div>
            </div>
          </article>

          <article className="bento-secondary-wide">
            <div>
              <span className="bento-icon-wrap">
                <Smartphone size={22} aria-hidden="true" />
              </span>
              <h3 className="bento-title">App Móvil para Empleados</h3>
              <p className="bento-copy">
                Cada colaborador consulta exclusivamente su historial personal y el detalle de sus
                propios accesos, sin visibilidad sobre otros usuarios ni funciones administrativas.
              </p>
            </div>

            <div className="mobile-log-preview" aria-label="Ejemplo de historial personal móvil">
              <div className="mobile-log-item">
                <span className="mobile-log-place">Laboratorio de Telemática B2</span>
                <span className="mobile-log-time">Hoy · 08:14</span>
              </div>
              <div className="mobile-log-item">
                <span className="mobile-log-place">Acceso Principal Edificio C</span>
                <span className="mobile-log-time">Ayer · 17:42</span>
              </div>
            </div>
          </article>

          <article className="bento-secondary-compact">
            <div>
              <span className="bento-icon-wrap">
                <Lock size={22} aria-hidden="true" />
              </span>
              <h3 className="bento-title">Seguridad y Auditoría Inmutable</h3>
              <p className="bento-copy">
                Control de roles RBAC en consola, aislamiento de datos mediante PostgreSQL con
                políticas RLS y conservación permanente de la bitácora histórica, incluyendo
                tarjetas no registradas.
              </p>
            </div>

            <div className="security-tags">
              <span className="security-tag">Roles RBAC</span>
              <span className="security-tag">PostgreSQL + RLS</span>
              <span className="security-tag">Bitácora inmutable</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
