import { ABOUT_PRINCIPLES, TECH_STACK_PILLS } from '../data/landingContent'
import { Reveal } from './Reveal'

export function AboutSection() {
  return (
    <section id="nosotros" className="section-titanium" aria-labelledby="about-heading">
      <div className="container">
        <div className="about-layout">
          <Reveal className="section-header">
            <h2 id="about-heading" className="section-title">
              Ingeniería nacida en la Universidad Tecnológica de Tijuana.
            </h2>
            <p className="section-lead">
              Accesa surgió como respuesta práctica a una necesidad real en campus universitarios,
              laboratorios especializados e instalaciones técnicas: controlar quién entra a cada
              espacio sin detener la operación cuando falla el enlace de red.
            </p>
            <p className="section-lead">
              Combinamos hardware embebido ESP32-S3, una API modular con respaldo en PostgreSQL y
              herramientas administrativas directas para equipos de TI, seguridad y dirección.
            </p>

            <div className="about-institution">
              <img
                src="/brand/isotipo.png"
                alt=""
                aria-hidden="true"
                className="about-institution-mark"
                width={24}
                height={36}
              />
              <span className="about-institution-text">
                Proyecto de ingeniería · Universidad Tecnológica de Tijuana (UTT)
              </span>
            </div>

            <div className="tech-stack-strip" aria-label="Stack tecnológico de Accesa">
              {TECH_STACK_PILLS.map((pill) => (
                <span key={pill} className="tech-stack-pill">
                  {pill}
                </span>
              ))}
            </div>
          </Reveal>

          <div className="about-principles">
            {ABOUT_PRINCIPLES.map((principle, index) => (
              <Reveal
                key={principle.title}
                as="article"
                className="about-principle"
                delayMs={index * 80}
              >
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
