import { useState } from 'react'
import { Check, LayoutDashboard, Lock, Smartphone } from 'lucide-react'
import { FLOORPLAN_ZONES, MOBILE_EVENTS } from '../data/landingContent'
import { Reveal } from './Reveal'

const ADMIN_HIGHLIGHTS = [
  'Croquis interactivo de áreas con ocupación en vivo',
  'Reportes PDF listos para auditoría institucional',
  'Control de aforo y estado de sincronización por controlador',
] as const

export function EcosystemSection() {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('redes')
  const [selectedEventId, setSelectedEventId] = useState<string>(MOBILE_EVENTS[0]!.id)

  const selectedZone =
    FLOORPLAN_ZONES.find((zone) => zone.id === selectedZoneId) ?? FLOORPLAN_ZONES[0]!
  const activeEvent =
    MOBILE_EVENTS.find((evt) => evt.id === selectedEventId) ?? MOBILE_EVENTS[0]!

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
          <Reveal as="article" className="bento-featured" delayMs={0}>
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
                {FLOORPLAN_ZONES.map((zone) => {
                  const isSelected = zone.id === selectedZone.id
                  const occupancyPct = Math.round((zone.currentOccupancy / zone.capacity) * 100)
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      className="floorplan-zone-btn"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedZoneId(zone.id)}
                    >
                      <p className="floorplan-zone-name">{zone.name}</p>
                      <p className="floorplan-zone-meta">
                        Aforo {zone.currentOccupancy} / {zone.capacity} · {zone.deviceId}
                      </p>
                      <div className="floorplan-bar" aria-hidden="true">
                        <span
                          className="floorplan-bar-fill"
                          style={{ width: `${occupancyPct}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
              <div
                className="floorplan-inspector panel-fade-in"
                key={selectedZone.id}
                aria-live="polite"
              >
                <p className="floorplan-inspector-code">{selectedZone.code}</p>
                <p className="floorplan-inspector-sync">{selectedZone.syncState}</p>
                <p className="floorplan-inspector-event">{selectedZone.lastEvent}</p>
              </div>
            </div>
          </Reveal>

          <Reveal as="article" className="bento-secondary-wide" delayMs={80}>
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
              {MOBILE_EVENTS.map((evt) => {
                const isSelected = evt.id === activeEvent.id
                return (
                  <button
                    key={evt.id}
                    type="button"
                    className="mobile-log-btn"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedEventId(evt.id)}
                  >
                    <span className="mobile-log-place">{evt.area}</span>
                    <span className="mobile-log-time">{evt.timestamp}</span>
                  </button>
                )
              })}

              <div
                className="mobile-log-detail panel-fade-in"
                key={activeEvent.id}
                aria-live="polite"
              >
                <span className="mobile-log-decision">{activeEvent.decision}</span>
                <span className="mobile-log-uid">UID {activeEvent.cardUid}</span>
                <span className="mobile-log-method">{activeEvent.method}</span>
              </div>
            </div>
          </Reveal>

          <Reveal as="article" className="bento-secondary-compact" delayMs={150}>
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
          </Reveal>
        </div>
      </div>
    </section>
  )
}
