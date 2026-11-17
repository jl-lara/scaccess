import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { AppShell } from '../src/components/layout/AppShell'
import { Modal } from '../src/components/ui/Modal'
import { AuthContext } from '../src/context/AuthContext'
import { api } from '../src/lib/api'
import { EMPLOYEES, makeAuth, paginated } from './fixtures'

vi.mock('../src/lib/api', () => ({
  api: {
    getHealth: vi.fn(),
    listEmployees: vi.fn(),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
  },
}))

function ModalHarness() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir modal
      </button>
      {open ? (
        <Modal
          title="Prueba de accesibilidad"
          description="Verifica foco, Escape y trampa de tabulacion."
          onClose={() => setOpen(false)}
        >
          <button type="button">Accion principal</button>
          <button type="button">Accion secundaria</button>
        </Modal>
      ) : null}
    </div>
  )
}

describe('Accessibility baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getHealth).mockResolvedValue({
      status: 'ok',
      service: 'scaccess-api',
      timestamp: '2026-11-10T12:00:00.000Z',
      uptimeSeconds: 120,
    })
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES))
  })

  it('provides a skip link, a single page h1 and a main landmark inside the shell', async () => {
    render(
      <MemoryRouter initialEntries={['/employees']}>
        <AuthContext.Provider value={makeAuth(['admin'])}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    const skipLink = screen.getByRole('link', { name: 'Saltar al contenido principal' })
    expect(skipLink).toHaveAttribute('href', '#main-content')

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveAttribute('tabindex', '-1')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Empleados' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Menu administrativo' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/API conectada/)).toBeInTheDocument()
  })

  it('hides the admin-only navigation entry from non-admin roles', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(['auditor'])}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<h1>Panel</h1>} />
            </Route>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/API conectada/)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Bitacora de accesos' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cuentas y roles' })).not.toBeInTheDocument()
  })

  it('traps focus in the modal, closes with Escape and restores the trigger focus', async () => {
    render(<ModalHarness />)

    const trigger = screen.getByRole('button', { name: 'Abrir modal' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Prueba de accesibilidad' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription(
      'Verifica foco, Escape y trampa de tabulacion.',
    )
    expect(document.body.style.overflow).toBe('hidden')

    const closeButton = screen.getByRole('button', { name: 'Cerrar ventana' })
    expect(closeButton).toHaveFocus()

    const lastButton = screen.getByRole('button', { name: 'Accion secundaria' })
    lastButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(lastButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(trigger).toHaveFocus()
  })

  it('collapses and restores the administrative sidebar from the topbar', async () => {
    localStorage.clear()

    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(['admin'])}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<h1>Panel</h1>} />
            </Route>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/API conectada/)).toBeInTheDocument()
    })

    const hideButton = screen.getByRole('button', { name: 'Ocultar barra lateral' })
    expect(hideButton).toHaveAttribute('aria-expanded', 'true')
    expect(hideButton).toHaveAttribute('aria-controls', 'app-sidebar')
    expect(
      screen.getByRole('navigation', { name: 'Menu administrativo' }),
    ).toBeInTheDocument()

    fireEvent.click(hideButton)

    expect(document.querySelector('.app-shell')).toHaveClass('is-sidebar-collapsed')
    expect(hideButton).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('navigation', { name: 'Menu administrativo' }),
    ).not.toBeInTheDocument()
    expect(localStorage.getItem('scaccess-sidebar-collapsed')).toBe('true')

    const showButton = screen.getByRole('button', { name: 'Mostrar barra lateral' })
    fireEvent.click(showButton)

    expect(document.querySelector('.app-shell')).not.toHaveClass('is-sidebar-collapsed')
    expect(showButton).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('navigation', { name: 'Menu administrativo' }),
    ).toBeInTheDocument()
    expect(localStorage.getItem('scaccess-sidebar-collapsed')).toBe('false')
  })
})
