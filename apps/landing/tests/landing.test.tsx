import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('Accesa promotional landing page', () => {
  it('renders all core promotional sections and institutional attribution', () => {
    render(<App />)

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
        name: /agenda una demostración para tu institución\./i,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { level: 3, name: /consola web administrativa/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: /app móvil para empleados/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: /seguridad y auditoría inmutable/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/desarrollado en la universidad tecnológica de tijuana \(utt\)\./i),
    ).toBeInTheDocument()
  })

  it('switches interactive RFID reader states between authorized, unknown and offline modes', () => {
    render(<App />)

    const stage = screen.getByRole('region', {
      name: /simulador interactivo del lector rfid/i,
    })

    const authButton = within(stage).getByRole('button', { name: /tarjeta autorizada/i })
    const unknownButton = within(stage).getByRole('button', { name: /tarjeta desconocida/i })
    const offlineButton = within(stage).getByRole('button', { name: /modo sin conexión/i })

    expect(authButton).toHaveAttribute('aria-pressed', 'true')
    expect(within(stage).getByText('Relevador liberado (3 s)')).toBeInTheDocument()
    expect(within(stage).getByText('Sincronizado en línea')).toBeInTheDocument()

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

  it('validates the contact form in Spanish and supports accessible confirmation and reset', () => {
    render(<App />)

    const contactSection = document.getElementById('contacto')
    expect(contactSection).not.toBeNull()
    const scoped = within(contactSection!)

    const submitButton = scoped.getByRole('button', { name: /solicitar demostración/i })
    fireEvent.click(submitButton)

    const nameInput = scoped.getByLabelText(/nombre completo/i)
    const emailInput = scoped.getByLabelText(/correo electrónico/i)
    const orgInput = scoped.getByLabelText(/organización o institución/i)
    const reasonSelect = scoped.getByLabelText(/motivo de contacto/i)
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
    fireEvent.change(reasonSelect, { target: { value: 'Piloto en campus o laboratorio' } })
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

    const resetButton = within(confirmation).getByRole('button', {
      name: /enviar otro mensaje/i,
    })
    fireEvent.click(resetButton)

    expect(scoped.getByLabelText(/nombre completo/i)).toHaveValue('')
    expect(scoped.getByLabelText(/correo electrónico/i)).toHaveValue('')
  })

  it('toggles mobile navigation drawer aria-expanded state', () => {
    render(<App />)

    const toggleButton = screen.getByRole('button', { name: /abrir menú de navegación/i })
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    expect(toggleButton).toHaveAccessibleName(/cerrar menú de navegación/i)
  })
})
