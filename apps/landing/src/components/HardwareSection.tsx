import type { CSSProperties } from 'react'
import { Cpu, Database, Radio, RefreshCw } from 'lucide-react'
import { HARDWARE_SPECS } from '../data/landingContent'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { Reveal } from './Reveal'

export function HardwareSection() {
  const { ref, progress } = useScrollProgress<HTMLDivElement>(0.15)
  const shiftPx = (0.5 - progress) * 18
  const panelStyle = {
    '--hardware-shift': `${shiftPx.toFixed(1)}px`,
  } as CSSProperties

  return (
    <section id="hardware" className="section-dark" aria-labelledby="hardware-heading">
      <div className="container">
        <div className="hardware-layout">
          <Reveal className="section-header">
            <h2 id="hardware-heading" className="section-title">
              Arquitectura offline-first pensada para la puerta física.
            </h2>
            <p className="section-lead">
              Cada controlador ESP32-S3 mantiene una copia local autorizada de permisos. Si la red
              del edificio cae, las puertas siguen abriendo y cerrando con precisión milimétrica.
            </p>

            <ul className="hardware-notes">
              <li className="hardware-note">
                <strong>Caché local de credenciales</strong>
                <span>
                  Valida UID autorizados directamente en memoria del controlador sin esperar
                  respuesta de servidores externos.
                </span>
              </li>
              <li className="hardware-note">
                <strong>Doble marca temporal real</strong>
                <span>
                  Distingue con claridad el instante exacto de lectura en puerta (occurred_at) de la
                  llegada al servidor (received_at).
                </span>
              </li>
              <li className="hardware-note">
                <strong>Sincronización idempotente</strong>
                <span>
                  Cada evento viaja con identificador client_event_id único para evitar duplicados al
                  restablecer la conexión.
                </span>
              </li>
            </ul>
          </Reveal>

          <div ref={ref} className="hardware-panel" style={panelStyle}>
            <div className="hardware-panel-head">
              <p className="hardware-node-name">Controlador de Acceso ESP32-S3</p>
              <span className="hardware-node-chip">Offline-first</span>
            </div>

            <div className="hardware-pipeline">
              <Reveal className="hardware-stage-row" delayMs={0}>
                <Radio size={20} className="hardware-stage-icon" aria-hidden="true" />
                <div>
                  <h3 className="hardware-stage-title">1. Lectura RFID 13.56 MHz</h3>
                  <p className="hardware-stage-copy">
                    Captura del UID sin contacto y verificación inmediata contra la tabla local.
                  </p>
                </div>
              </Reveal>

              <Reveal className="hardware-stage-row" delayMs={60}>
                <Cpu size={20} className="hardware-stage-icon" aria-hidden="true" />
                <div>
                  <h3 className="hardware-stage-title">2. Decisión autónoma y relevador</h3>
                  <p className="hardware-stage-copy">
                    Acciona la cerradura o registra el rechazo incluso sin enlace Wi-Fi activo.
                  </p>
                </div>
              </Reveal>

              <Reveal className="hardware-stage-row" delayMs={120}>
                <Database size={20} className="hardware-stage-icon" aria-hidden="true" />
                <div>
                  <h3 className="hardware-stage-title">3. Resguardo en cola no volátil</h3>
                  <p className="hardware-stage-copy">
                    Conserva eventos pendientes y tarjetas desconocidas con marca occurred_at.
                  </p>
                </div>
              </Reveal>

              <Reveal className="hardware-stage-row" delayMs={180}>
                <RefreshCw size={20} className="hardware-stage-icon" aria-hidden="true" />
                <div>
                  <h3 className="hardware-stage-title">4. Entrega idempotente al backend</h3>
                  <p className="hardware-stage-copy">
                    Al reconectar, transmite lotes deduplicados por client_event_id hacia PostgreSQL.
                  </p>
                </div>
              </Reveal>
            </div>

            <div className="hardware-code-strip" aria-label="Estructura resumida de evento">
              <span>client_event_id: uuid-v4</span>
              <span>occurred_at ≠ received_at</span>
            </div>
          </div>
        </div>

        <dl className="spec-strip">
          {HARDWARE_SPECS.map((spec, index) => (
            <Reveal key={spec.term} as="div" delayMs={index * 70} className="spec-item">
              <dt className="spec-term">{spec.term}</dt>
              <dd className="spec-value" style={{ marginLeft: 0 }}>
                {spec.value}
              </dd>
              <dd className="spec-detail" style={{ marginLeft: 0 }}>
                {spec.detail}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}
