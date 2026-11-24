import { Building2, FlaskConical, Server, Wrench, type LucideIcon } from 'lucide-react'
import { USE_CASE_SCENARIOS, type ScenarioIconName } from '../data/landingContent'
import { Reveal } from './Reveal'

const SCENARIO_ICONS: Record<ScenarioIconName, LucideIcon> = {
  flask: FlaskConical,
  building: Building2,
  wrench: Wrench,
  server: Server,
}

export function ScenariosSection() {
  return (
    <section id="escenarios" className="section-titanium" aria-labelledby="scenarios-heading">
      <div className="container">
        <Reveal className="section-header">
          <h2 id="scenarios-heading" className="section-title">
            Diseñado para espacios donde cada puerta importa.
          </h2>
          <p className="section-lead">
            Desde laboratorios académicos hasta cuartos críticos de infraestructura, Accesa adapta
            políticas y hardware sin cambiar de plataforma.
          </p>
        </Reveal>

        <div className="scenarios-grid">
          {USE_CASE_SCENARIOS.map((scenario, index) => {
            const Icon = SCENARIO_ICONS[scenario.iconName]
            return (
              <Reveal
                key={scenario.id}
                as="article"
                className="scenario-card"
                delayMs={index * 70}
              >
                <span className="scenario-icon-wrap" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <h3 className="scenario-title">{scenario.title}</h3>
                <p className="scenario-desc">{scenario.description}</p>
                <p className="scenario-highlight">{scenario.highlight}</p>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
