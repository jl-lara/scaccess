import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowRight, CheckCircle2, ShieldAlert, Wifi, WifiOff } from 'lucide-react'
import {
  KEY_METRICS,
  READER_SCENARIOS,
  type ReaderScenario,
  type ReaderScenarioId,
} from '../data/landingContent'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { AppLink } from '../lib/router'
import { Reveal } from './Reveal'

function renderScenarioIcon(tone: ReaderScenario['statusTone']) {
  if (tone === 'granted') {
    return <CheckCircle2 size={28} color="#0d9488" aria-hidden="true" />
  }
  if (tone === 'denied') {
    return <ShieldAlert size={28} color="#be123c" aria-hidden="true" />
  }
  return <WifiOff size={28} color="#d97706" aria-hidden="true" />
}

export function HeroSection() {
  const [selectedId, setSelectedId] = useState<ReaderScenarioId>('authorized')
  const [scanCount, setScanCount] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const { ref: stageRef, progress } = useScrollProgress<HTMLDivElement>(0.1)

  useEffect(() => {
    if (scanCount === 0) {
      return
    }
    setIsScanning(true)
    const timerId = window.setTimeout(() => {
      setIsScanning(false)
    }, 650)
    return () => window.clearTimeout(timerId)
  }, [scanCount])

  const triggerScan = () => {
    setScanCount((prev) => prev + 1)
  }

  const activeScenario =
    READER_SCENARIOS.find((scenario) => scenario.id === selectedId) ?? READER_SCENARIOS[0]!

  const stageScale = 0.96 + Math.min(1, progress * 1.4) * 0.04
  const stageStyle = {
    '--stage-scale': stageScale.toFixed(3),
  } as CSSProperties

  return (
    <section id="producto" className="hero-section" aria-labelledby="hero-heading">
      <div className="container">
        <div className="hero-intro">
          <h1 id="hero-heading" className="hero-title hero-stagger-1">
            Control de acceso que nunca se detiene.
          </h1>
          <p className="hero-subtitle hero-stagger-2">
            Credenciales RFID validadas en puerta por un controlador ESP32-S3 con operación sin
            conexión, consola web administrativa y bitácora inmutable de eventos.
          </p>
          <div className="hero-actions hero-stagger-3">
            <AppLink to="/contacto" className="btn btn-primary btn-lg">
              Solicitar demostración{' '}
              <ArrowRight size={18} className="btn-icon" aria-hidden="true" />
            </AppLink>
            <AppLink to="/#hardware" className="btn btn-secondary btn-lg">
              Explorar arquitectura
            </AppLink>
          </div>
        </div>

        <div className="hero-stagger-4">
          <div ref={stageRef} className="reader-stage-wrap" style={stageStyle}>
            <div className="reader-stage" role="region" aria-label="Simulador interactivo del lector RFID">
              <div className="reader-controls">
                <p className="reader-controls-title">
                  Prueba la respuesta del lector RFID en puerta
                </p>
                <div className="reader-tabs" role="group" aria-label="Escenarios del lector RFID">
                  {READER_SCENARIOS.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      className="reader-tab"
                      aria-pressed={scenario.id === activeScenario.id}
                      onClick={() => setSelectedId(scenario.id)}
                    >
                      {scenario.label}
                    </button>
                  ))}
                  <button type="button" className="reader-scan-btn" onClick={triggerScan}>
                    Simular lectura
                  </button>
                </div>
              </div>

              <div className="reader-grid">
                <div className="reader-device" aria-live="polite">
                  <div className="reader-led-bar" data-tone={activeScenario.statusTone} />
                  <div
                    className={isScanning ? 'reader-pad reader-pad-scanning' : 'reader-pad'}
                    data-tone={activeScenario.statusTone}
                  >
                    <span className="reader-ripple" aria-hidden="true" />
                    <span className="reader-ripple reader-ripple-delay" aria-hidden="true" />
                    {renderScenarioIcon(activeScenario.statusTone)}
                  </div>
                  <div className="reader-device-screen">
                    <p className="reader-device-status">{activeScenario.statusBadge}</p>
                    <p className="reader-device-uid">UID {activeScenario.cardUid}</p>
                    <p className="reader-device-node">
                      {scanCount > 0
                        ? `Nodo ${activeScenario.nodeId} · ${scanCount} ${scanCount === 1 ? 'lectura' : 'lecturas'}`
                        : `Nodo ${activeScenario.nodeId}`}
                    </p>
                  </div>
                </div>

                <div key={activeScenario.id} className="reader-telemetry panel-fade-in">
                  <div className="reader-status-row">
                    <span className="reader-pill" data-tone={activeScenario.statusTone}>
                      {activeScenario.statusTone === 'offline' ? (
                        <WifiOff size={15} aria-hidden="true" />
                      ) : (
                        <Wifi size={15} aria-hidden="true" />
                      )}
                      {activeScenario.statusBadge}
                    </span>
                    <p className="reader-area">{activeScenario.areaName}</p>
                  </div>

                  <p className="reader-explanation">{activeScenario.explanation}</p>

                  <dl className="reader-metrics">
                    <div className="reader-metric">
                      <dt>Titular o estado</dt>
                      <dd>{activeScenario.holderName}</dd>
                    </div>
                    <div className="reader-metric">
                      <dt>Latencia de validación</dt>
                      <dd>{activeScenario.latencyMs}</dd>
                    </div>
                    <div className="reader-metric">
                      <dt>Estado del relevador</dt>
                      <dd>{activeScenario.relayState}</dd>
                    </div>
                    <div className="reader-metric">
                      <dt>Cola de sincronización</dt>
                      <dd>{activeScenario.syncQueueState}</dd>
                    </div>
                    <div className="reader-metric">
                      <dt>Lectura en puerta (occurred_at)</dt>
                      <dd>{activeScenario.occurredAt}</dd>
                    </div>
                    <div className="reader-metric">
                      <dt>Ingreso en servidor (received_at)</dt>
                      <dd>{activeScenario.receivedAt}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Reveal className="metrics-strip" delayMs={80}>
          {KEY_METRICS.map((metric) => (
            <div key={metric.label} className="metric-item">
              <p className="metric-value">{metric.value}</p>
              <p className="metric-label">{metric.label}</p>
              <p className="metric-detail">{metric.detail}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
