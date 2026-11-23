import { ABOUT_PRINCIPLES } from '../data/landingContent'

export function AboutSection() {
  return (
    <section id="nosotros" className="section-titanium" aria-labelledby="about-heading">
      <div className="container">
        <div className="about-layout">
          <div className="section-header">
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
          </div>

          <div className="about-principles">
            {ABOUT_PRINCIPLES.map((principle) => (
              <article key={principle.title} className="about-principle">
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
