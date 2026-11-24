import { WORKFLOW_STEPS } from '../data/landingContent'
import { Reveal } from './Reveal'

export function WorkflowSection() {
  return (
    <section id="flujo" className="section-white" aria-labelledby="workflow-heading">
      <div className="container">
        <Reveal className="section-header">
          <h2 id="workflow-heading" className="section-title">
            Del registro de credenciales a la auditoría continua.
          </h2>
          <p className="section-lead">
            Cuatro pasos operativos para desplegar control de acceso físico sin dependencias
            frágiles de red.
          </p>
        </Reveal>

        <ol className="workflow-list">
          {WORKFLOW_STEPS.map((step, index) => (
            <Reveal
              key={step.stepNumber}
              as="li"
              className="workflow-step"
              delayMs={index * 80}
            >
              <span className="workflow-step-num" aria-hidden="true">
                {step.stepNumber}
              </span>
              <h3 className="workflow-step-title">{step.title}</h3>
              <p className="workflow-step-desc">{step.description}</p>
              <span className="workflow-deliverable">{step.deliverable}</span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
