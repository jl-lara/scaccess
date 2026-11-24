import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { FAQ_ITEMS } from '../data/landingContent'
import { Reveal } from './Reveal'

export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null)

  return (
    <section id="preguntas" className="section-white" aria-labelledby="faq-heading">
      <div className="container">
        <Reveal className="section-header section-header-center">
          <h2 id="faq-heading" className="section-title">
            Preguntas frecuentes sobre implementación y operación.
          </h2>
          <p className="section-lead">
            Respuestas técnicas claras sobre resiliencia offline, hardware en puerta, privacidad de
            empleados y auditoría.
          </p>
        </Reveal>

        <div className="faq-list">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id
            const panelId = `${item.id}-panel`

            return (
              <div key={item.id} className="faq-item">
                <h3 className="faq-heading">
                  <button
                    type="button"
                    className="faq-trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                  >
                    <span>{item.question}</span>
                    <ChevronDown size={18} className="faq-chevron" aria-hidden="true" />
                  </button>
                </h3>
                <div
                  id={panelId}
                  className="faq-answer-wrap"
                  data-open={isOpen}
                  aria-hidden={!isOpen}
                >
                  <div className="faq-answer-inner">
                    <p className="faq-answer">{item.answer}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
