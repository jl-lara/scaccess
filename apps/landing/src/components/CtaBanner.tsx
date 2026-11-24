import { ArrowRight } from 'lucide-react'
import { AppLink } from '../lib/router'
import { Reveal } from './Reveal'

export function CtaBanner() {
  return (
    <section className="cta-band" aria-labelledby="cta-heading">
      <div className="container">
        <Reveal variant="scale" className="cta-card">
          <h2 id="cta-heading" className="cta-title">
            Lleva Accesa a tus laboratorios, edificios o instalaciones.
          </h2>
          <p className="cta-lead">
            Solicita una demostración técnica en una página dedicada y revisa con nuestro equipo el
            despliegue de nodos ESP32-S3 y consola web.
          </p>
          <div className="cta-actions">
            <AppLink to="/contacto" className="btn btn-cta-light btn-lg">
              Ir al formulario de contacto
              <ArrowRight size={18} className="btn-icon" aria-hidden="true" />
            </AppLink>
            <AppLink to="/#producto" className="btn btn-cta-outline btn-lg">
              Volver al simulador
            </AppLink>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
