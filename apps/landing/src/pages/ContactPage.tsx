import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, Building2, CheckCircle2, Clock, Mail } from 'lucide-react'
import { CONTACT_REASONS, DEMO_TIMELINE, DOOR_SCALE_OPTIONS } from '../data/landingContent'
import { AppLink } from '../lib/router'

interface ContactFormValues {
  name: string
  email: string
  organization: string
  reason: string
  doors: string
  message: string
}

type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>

const INITIAL_VALUES: ContactFormValues = {
  name: '',
  email: '',
  organization: '',
  reason: '',
  doors: '',
  message: '',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Ingresa tu nombre completo.'
  } else if (values.name.trim().length < 3) {
    errors.name = 'El nombre debe tener al menos 3 caracteres.'
  }

  if (!values.email.trim()) {
    errors.email = 'Ingresa un correo electrónico de contacto.'
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Ingresa un correo electrónico válido.'
  }

  if (!values.organization.trim()) {
    errors.organization = 'Indica tu organización o institución.'
  }

  if (!values.reason.trim()) {
    errors.reason = 'Selecciona un motivo de contacto.'
  }

  if (!values.message.trim()) {
    errors.message = 'Escribe un mensaje con los detalles de tu solicitud.'
  } else if (values.message.trim().length < 10) {
    errors.message = 'El mensaje debe contener al menos 10 caracteres.'
  }

  return errors
}

export function ContactPage() {
  const [values, setValues] = useState<ContactFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [submittedValues, setSubmittedValues] = useState<ContactFormValues | null>(null)

  const clearFieldError = (field: keyof ContactFormValues) => {
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev }
        delete updated[field]
        return updated
      })
    }
  }

  const handleFieldChange =
    (field: keyof ContactFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value
      setValues((prev) => ({ ...prev, [field]: nextValue }))
      clearFieldError(field)
    }

  const handleSelectReasonChip = (reason: string) => {
    setValues((prev) => ({ ...prev, reason }))
    clearFieldError('reason')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validateContactForm(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSubmittedValues({
      name: values.name.trim(),
      email: values.email.trim(),
      organization: values.organization.trim(),
      reason: values.reason,
      doors: values.doors,
      message: values.message.trim(),
    })
  }

  const handleReset = () => {
    setSubmittedValues(null)
    setValues(INITIAL_VALUES)
    setErrors({})
  }

  return (
    <section id="contacto" className="contact-page" aria-labelledby="contact-heading">
      <div className="container">
        <div className="contact-hero">
          <AppLink to="/" className="contact-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Volver a la página principal
          </AppLink>
          <h1 id="contact-heading" className="contact-hero-title">
            Agenda una demostración para tu institución.
          </h1>
          <p className="contact-hero-lead">
            Cuéntanos cuántas puertas, laboratorios o áreas deseas controlar y te mostraremos el
            funcionamiento completo del controlador ESP32-S3, la consola administrativa y la app
            móvil.
          </p>
        </div>

        <div className="contact-layout">
          <aside className="contact-sidebar">
            <ul className="contact-details">
              <li className="contact-detail-item">
                <Building2 size={18} className="contact-detail-icon" aria-hidden="true" />
                <span>Universidad Tecnológica de Tijuana · Carretera Libre Tijuana-Tecate</span>
              </li>
              <li className="contact-detail-item">
                <Mail size={18} className="contact-detail-icon" aria-hidden="true" />
                <span>contacto@accesa.utt.edu.mx</span>
              </li>
              <li className="contact-detail-item">
                <Clock size={18} className="contact-detail-icon" aria-hidden="true" />
                <span>Atención académica e institucional de lunes a viernes, 9:00 a 17:00 h</span>
              </li>
            </ul>

            <div className="demo-timeline">
              <h2 className="demo-timeline-title">¿Qué sigue después de enviar tu solicitud?</h2>
              <ol className="demo-timeline-list">
                {DEMO_TIMELINE.map((item) => (
                  <li key={item.step} className="demo-timeline-item">
                    <span className="demo-timeline-step" aria-hidden="true">
                      {item.step}
                    </span>
                    <div className="demo-timeline-body">
                      <h3>{item.title}</h3>
                      <p>{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="contact-card">
            {submittedValues ? (
              <div className="contact-confirmation" role="status" aria-live="polite">
                <div className="contact-confirmation-head">
                  <CheckCircle2 size={24} aria-hidden="true" />
                  <h3>Solicitud registrada correctamente</h3>
                </div>
                <p className="contact-confirmation-copy">
                  Gracias, {submittedValues.name}. Nuestro equipo revisará tu solicitud y responderá
                  al correo proporcionado.
                </p>

                <dl className="contact-summary">
                  <div className="contact-summary-row">
                    <dt>Correo electrónico</dt>
                    <dd>{submittedValues.email}</dd>
                  </div>
                  <div className="contact-summary-row">
                    <dt>Organización o institución</dt>
                    <dd>{submittedValues.organization}</dd>
                  </div>
                  <div className="contact-summary-row">
                    <dt>Motivo de contacto</dt>
                    <dd>{submittedValues.reason}</dd>
                  </div>
                  {submittedValues.doors && (
                    <div className="contact-summary-row">
                      <dt>Puertas estimadas</dt>
                      <dd>{submittedValues.doors}</dd>
                    </div>
                  )}
                </dl>

                <div className="contact-confirmation-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset}>
                    Enviar otro mensaje
                  </button>
                  <AppLink to="/" className="btn btn-primary btn-sm">
                    Volver al inicio
                  </AppLink>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="contact-reason-chips"
                  role="group"
                  aria-label="Selección rápida de motivo"
                >
                  {CONTACT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className="contact-reason-chip"
                      aria-pressed={values.reason === reason}
                      onClick={() => handleSelectReasonChip(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <form className="contact-form" noValidate onSubmit={handleSubmit}>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label htmlFor="contact-name" className="form-label">
                        Nombre completo
                      </label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        className="form-input"
                        autoComplete="name"
                        placeholder="Ej. Valeria Mendoza"
                        value={values.name}
                        onChange={handleFieldChange('name')}
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? 'contact-name-error' : undefined}
                      />
                      {errors.name && (
                        <p id="contact-name-error" className="form-error">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div className="form-field">
                      <label htmlFor="contact-email" className="form-label">
                        Correo electrónico
                      </label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        className="form-input"
                        autoComplete="email"
                        placeholder="nombre@institucion.edu.mx"
                        value={values.email}
                        onChange={handleFieldChange('email')}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'contact-email-error' : undefined}
                      />
                      {errors.email && (
                        <p id="contact-email-error" className="form-error">
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-field">
                      <label htmlFor="contact-organization" className="form-label">
                        Organización o institución
                      </label>
                      <input
                        id="contact-organization"
                        name="organization"
                        type="text"
                        className="form-input"
                        autoComplete="organization"
                        placeholder="Ej. Universidad Tecnológica de Tijuana"
                        value={values.organization}
                        onChange={handleFieldChange('organization')}
                        aria-invalid={Boolean(errors.organization)}
                        aria-describedby={
                          errors.organization ? 'contact-organization-error' : undefined
                        }
                      />
                      {errors.organization && (
                        <p id="contact-organization-error" className="form-error">
                          {errors.organization}
                        </p>
                      )}
                    </div>

                    <div className="form-field">
                      <label htmlFor="contact-reason" className="form-label">
                        Motivo de contacto
                      </label>
                      <select
                        id="contact-reason"
                        name="reason"
                        className="form-select"
                        value={values.reason}
                        onChange={handleFieldChange('reason')}
                        aria-invalid={Boolean(errors.reason)}
                        aria-describedby={errors.reason ? 'contact-reason-error' : undefined}
                      >
                        <option value="">Selecciona una opción</option>
                        {CONTACT_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                      {errors.reason && (
                        <p id="contact-reason-error" className="form-error">
                          {errors.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="contact-doors" className="form-label">
                      Puertas o áreas estimadas (opcional)
                    </label>
                    <select
                      id="contact-doors"
                      name="doors"
                      className="form-select"
                      value={values.doors}
                      onChange={handleFieldChange('doors')}
                    >
                      <option value="">Selecciona una escala aproximada</option>
                      {DOOR_SCALE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="contact-message" className="form-label">
                      Mensaje
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      className="form-textarea"
                      placeholder="Describe las áreas, puertas o requerimientos de tu instalación."
                      value={values.message}
                      onChange={handleFieldChange('message')}
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={errors.message ? 'contact-message-error' : undefined}
                    />
                    {errors.message && (
                      <p id="contact-message-error" className="form-error">
                        {errors.message}
                      </p>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg">
                    Solicitar demostración
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
