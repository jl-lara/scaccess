import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('Accesa promotional landing page', () => {
  it('renders all rich landing sections on / without embedding the contact form', () => {
    render(<App initialPath="/" />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /control de acceso que nunca se detiene\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /arquitectura offline-first pensada para la puerta física\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /un ecosistema coordinado para quienes administran y quienes ingresan\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /permisos granulares para cada perfil operativo\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /diseñado para espacios donde cada puerta importa\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /del registro de credenciales a la auditoría continua\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /ingeniería nacida en la universidad tecnológica de tijuana\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /preguntas frecuentes sobre implementación y operación\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /lleva accesa a tus laboratorios, edificios o instalaciones\./i,
      }),
    ).toBeInTheDocument()

    expect(screen.getByText('< 20 ms')).toBeInTheDocument()
    expect(screen.queryByLabelText(/nombre completo/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(/desarrollado en la universidad tecnológica de tijuana \(utt\)\./i),
    ).toBeInTheDocument()
  })

  it('switches interactive RFID reader states and triggers simulated scan', () => {
    render(<App initialPath="/" />)

    const stage = screen.getByRole('region', {
      name: /simulador interactivo del lector rfid/i,
    })

    const authButton = within(stage).getByRole('button', { name: /tarjeta autorizada/i })
    const unknownButton = within(stage).getByRole('button', { name: /tarjeta desconocida/i })
    const offlineButton = within(stage).getByRole('button', { name: /modo sin conexión/i })
    const scanButton = within(stage).getByRole('button', { name: /simular lectura/i })

    expect(authButton).toHaveAttribute('aria-pressed', 'true')
    expect(within(stage).getByText('Relevador liberado (3 s)')).toBeInTheDocument()
    expect(within(stage).getByText('Sincronizado en línea')).toBeInTheDocument()

    fireEvent.click(scanButton)
    expect(within(stage).getByText(/1 lectura/i)).toBeInTheDocument()

    fireEvent.click(unknownButton)
    expect(unknownButton).toHaveAttribute('aria-pressed', 'true')
    expect(authButton).toHaveAttribute('aria-pressed', 'false')
    expect(within(stage).getByText('Cerradura bloqueada')).toBeInTheDocument()
    expect(within(stage).getByText('Evento conservado para auditoría')).toBeInTheDocument()

    fireEvent.click(offlineButton)
    expect(offlineButton).toHaveAttribute('aria-pressed', 'true')
    expect(within(stage).getByText('Relevador liberado (caché local)')).toBeInTheDocument()
    expect(within(stage).getByText('Cola NVS · 1 evento pendiente')).toBeInTheDocument()
    expect(within(stage).getByText('En espera de enlace')).toBeInTheDocument()
  })

  it('updates interactive floorplan zone, RBAC role matrix, and FAQ accordion', () => {
    render(<App initialPath="/" />)

    const ecosystem = document.getElementById('ecosistema')!
    const dataCenterBtn = within(ecosystem).getByRole('button', {
      name: /centro de datos norte.*esp32-02/i,
    })
    fireEvent.click(dataCenterBtn)
    expect(dataCenterBtn).toHaveAttribute('aria-pressed', 'true')
    expect(within(ecosystem).getByText('DC-NORTE')).toBeInTheDocument()

    const mobileLogBtn = within(ecosystem).getByRole('button', {
      name: /centro de datos norte.*19 nov/i,
    })
    fireEvent.click(mobileLogBtn)
    expect(mobileLogBtn).toHaveAttribute('aria-pressed', 'true')
    expect(within(ecosystem).getByText(/área sin permiso vigente/i)).toBeInTheDocument()

    const roles = document.getElementById('roles')!
    const employeeBtn = within(roles).getByRole('button', { name: /^empleado$/i })
    fireEvent.click(employeeBtn)
    expect(employeeBtn).toHaveAttribute('aria-pressed', 'true')
    expect(within(roles).getByText(/app móvil accesa \(expo\)/i)).toBeInTheDocument()
    expect(
      within(roles).getByText(/aislamiento estricto: nunca visualiza datos ni eventos de otros colaboradores\./i),
    ).toBeInTheDocument()

    const faq = document.getElementById('preguntas')!
    const firstFaqBtn = within(faq).getByRole('button', {
      name: /qué ocurre si se pierde la conexión wi-fi/i,
    })
    const secondFaqBtn = within(faq).getByRole('button', {
      name: /cómo evita accesa eventos duplicados/i,
    })

    expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'true')
    expect(secondFaqBtn).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(secondFaqBtn)
    expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'false')
    expect(secondFaqBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('navigates from landing page to standalone /contacto page and validates form', () => {
    render(<App initialPath="/" />)

    const hero = document.getElementById('producto')!
    const demoLink = within(hero).getByRole('link', { name: /solicitar demostración/i })
    fireEvent.click(demoLink)

    expect(window.location.pathname).toBe('/contacto')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /agenda una demostración para tu institución\./i,
      }),
    ).toBeInTheDocument()

    const contactSection = document.getElementById('contacto')!
    const scoped = within(contactSection)

    const submitButton = scoped.getByRole('button', { name: /solicitar demostración/i })
    fireEvent.click(submitButton)

    const nameInput = scoped.getByLabelText(/nombre completo/i)
    const emailInput = scoped.getByLabelText(/correo electrónico/i)
    const orgInput = scoped.getByLabelText(/organización o institución/i)
    const reasonSelect = scoped.getByLabelText(/motivo de contacto/i)
    const doorsSelect = scoped.getByLabelText(/puertas o áreas estimadas/i)
    const messageInput = scoped.getByLabelText(/mensaje/i)

    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    expect(orgInput).toHaveAttribute('aria-invalid', 'true')
    expect(reasonSelect).toHaveAttribute('aria-invalid', 'true')
    expect(messageInput).toHaveAttribute('aria-invalid', 'true')

    expect(scoped.getByText('Ingresa tu nombre completo.')).toBeInTheDocument()
    expect(scoped.getByText('Ingresa un correo electrónico de contacto.')).toBeInTheDocument()
    expect(scoped.getByText('Indica tu organización o institución.')).toBeInTheDocument()
    expect(scoped.getByText('Selecciona un motivo de contacto.')).toBeInTheDocument()
    expect(
      scoped.getByText('Escribe un mensaje con los detalles de tu solicitud.'),
    ).toBeInTheDocument()

    fireEvent.change(nameInput, { target: { value: 'Carlos Ramírez' } })
    fireEvent.change(emailInput, { target: { value: 'correo-invalido' } })
    fireEvent.change(orgInput, { target: { value: 'UTT Campus Tijuana' } })
    fireEvent.click(
      scoped.getByRole('button', { name: /piloto en campus o laboratorio/i }),
    )
    fireEvent.change(doorsSelect, { target: { value: '5 a 15 puertas' } })
    fireEvent.change(messageInput, {
      target: { value: 'Queremos evaluar seis puertas en el edificio de ingeniería.' },
    })

    fireEvent.click(submitButton)
    expect(scoped.getByText('Ingresa un correo electrónico válido.')).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(emailInput, { target: { value: 'carlos.ramirez@utt.edu.mx' } })
    fireEvent.click(submitButton)

    const confirmation = scoped.getByRole('status')
    expect(
      within(confirmation).getByRole('heading', {
        level: 3,
        name: /solicitud registrada correctamente/i,
      }),
    ).toBeInTheDocument()
    expect(within(confirmation).getByText('carlos.ramirez@utt.edu.mx')).toBeInTheDocument()
    expect(within(confirmation).getByText('UTT Campus Tijuana')).toBeInTheDocument()
    expect(within(confirmation).getByText('Piloto en campus o laboratorio')).toBeInTheDocument()
    expect(within(confirmation).getByText('5 a 15 puertas')).toBeInTheDocument()

    const resetButton = within(confirmation).getByRole('button', {
      name: /enviar otro mensaje/i,
    })
    fireEvent.click(resetButton)

    expect(scoped.getByLabelText(/nombre completo/i)).toHaveValue('')
    expect(scoped.getByLabelText(/correo electrónico/i)).toHaveValue('')

    const backLink = scoped.getByRole('link', { name: /volver a la página principal/i })
    fireEvent.click(backLink)
    expect(window.location.pathname).toBe('/')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /control de acceso que nunca se detiene\./i,
      }),
    ).toBeInTheDocument()
  })

  it('toggles mobile navigation drawer aria-expanded state', () => {
    render(<App initialPath="/" />)

    const toggleButton = screen.getByRole('button', { name: /abrir menú de navegación/i })
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    expect(toggleButton).toHaveAccessibleName(/cerrar menú de navegación/i)
  })
})
