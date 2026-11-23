import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { AppShell } from '../src/components/layout/AppShell'
import { Modal } from '../src/components/ui/Modal'
import { AuthContext } from '../src/context/AuthContext'
import { ThemeProvider } from '../src/context/ThemeContext'
import { api } from '../src/lib/api'
import { LoginPage } from '../src/pages/LoginPage'
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
      screen.getByRole('navigation', { name: 'Menú administrativo' }),
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
    expect(screen.getByRole('link', { name: 'Bitácora de accesos' })).toBeInTheDocument()
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

  it('collapses and restores the administrative sidebar from inside the sidebar', async () => {
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

    const sidebar = document.getElementById('app-sidebar')
    const hideButton = screen.getByRole('button', { name: 'Ocultar barra lateral' })
    expect(sidebar).toContainElement(hideButton)
    expect(hideButton).toHaveAttribute('aria-expanded', 'true')
    expect(hideButton).toHaveAttribute('aria-controls', 'app-sidebar')
    expect(
      screen.getByRole('navigation', { name: 'Menú administrativo' }),
    ).toBeInTheDocument()

    fireEvent.click(hideButton)

    expect(document.querySelector('.app-shell')).toHaveClass('is-sidebar-collapsed')
    expect(hideButton).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('navigation', { name: 'Menú administrativo' }),
    ).not.toBeInTheDocument()
    expect(localStorage.getItem('scaccess-sidebar-collapsed')).toBe('true')

    const showButton = screen.getByRole('button', { name: 'Mostrar barra lateral' })
    expect(sidebar).toContainElement(showButton)
    expect(showButton).toHaveAttribute('aria-controls', 'app-sidebar')
    fireEvent.click(showButton)

    expect(document.querySelector('.app-shell')).not.toHaveClass('is-sidebar-collapsed')
    expect(showButton).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('navigation', { name: 'Menú administrativo' }),
    ).toBeInTheDocument()
    expect(localStorage.getItem('scaccess-sidebar-collapsed')).toBe('false')
  })

  it('toggles the Catálogos y equipos submenu with Empleados, Tarjetas RFID and Controladores ESP32', async () => {
    localStorage.clear()

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={makeAuth(['admin'])}>
          <Routes>
            <Route element={<AppShell />}>
              <Route
                index
                element={
                  <div>
                    <h1>Panel</h1>
                    <Link to="/employees">Ir a empleados</Link>
                  </div>
                }
              />
              <Route path="employees" element={<h1>Empleados</h1>} />
            </Route>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/API conectada/)).toBeInTheDocument()
    })

    const submenuToggle = screen.getByRole('button', { name: 'Catálogos y equipos' })
    const submenu = document.getElementById('nav-catalog-submenu')

    expect(submenuToggle).toHaveAttribute('aria-expanded', 'true')
    expect(submenuToggle).toHaveAttribute('aria-controls', 'nav-catalog-submenu')
    expect(submenuToggle).not.toHaveClass('is-active-parent')
    expect(submenu).toBeInTheDocument()
    expect(submenu).not.toHaveAttribute('hidden')

    const employeesLink = screen.getByRole('link', { name: 'Empleados' })
    const credentialsLink = screen.getByRole('link', { name: 'Tarjetas RFID' })
    const devicesLink = screen.getByRole('link', { name: 'Controladores ESP32' })

    expect(submenu).toContainElement(employeesLink)
    expect(submenu).toContainElement(credentialsLink)
    expect(submenu).toContainElement(devicesLink)

    fireEvent.click(submenuToggle)

    expect(submenuToggle).toHaveAttribute('aria-expanded', 'false')
    expect(submenu).toHaveAttribute('hidden')
    expect(screen.queryByRole('link', { name: 'Empleados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tarjetas RFID' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Controladores ESP32' })).not.toBeInTheDocument()

    fireEvent.click(submenuToggle)

    expect(submenuToggle).toHaveAttribute('aria-expanded', 'true')
    expect(submenu).not.toHaveAttribute('hidden')
    expect(screen.getByRole('link', { name: 'Empleados' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tarjetas RFID' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Controladores ESP32' })).toBeInTheDocument()

    fireEvent.click(submenuToggle)
    expect(submenuToggle).toHaveAttribute('aria-expanded', 'false')
    expect(submenu).toHaveAttribute('hidden')

    fireEvent.click(screen.getByRole('link', { name: 'Ir a empleados' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Empleados' })).toBeInTheDocument()
    expect(submenuToggle).toHaveClass('is-active-parent')
    expect(submenuToggle).toHaveAttribute('aria-expanded', 'true')
    expect(submenu).not.toHaveAttribute('hidden')
  })

  it('switches the AppShell brand logo and isotipo for dark and light themes', async () => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    document.documentElement.style.colorScheme = ''

    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(['admin'])}>
          <ThemeProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<h1>Panel</h1>} />
              </Route>
            </Routes>
          </ThemeProvider>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/API conectada/)).toBeInTheDocument()
    })

    expect(screen.getByRole('img', { name: 'Accesa' })).toHaveAttribute(
      'src',
      '/brand/logo_accesa_fondo_blanco.png',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('img', { name: 'Accesa' })).toHaveAttribute(
      'src',
      '/brand/logo_accesa_fondo_blanco_oscuro_transparente.png',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar barra lateral' }))

    expect(screen.getByRole('img', { name: 'Accesa' })).toHaveAttribute(
      'src',
      '/brand/isotipo_oscuro_transparente.png',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(screen.getByRole('img', { name: 'Accesa' })).toHaveAttribute('src', '/brand/isotipo.png')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar barra lateral' }))

    expect(screen.getByRole('img', { name: 'Accesa' })).toHaveAttribute(
      'src',
      '/brand/logo_accesa_fondo_blanco.png',
    )
  })

  it('switches the LoginPage brand logo for dark and light themes', () => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    document.documentElement.style.colorScheme = ''

    const signedOutAuth = {
      ...makeAuth(['admin']),
      user: null,
      isAdmin: false,
      canWriteCatalog: false,
    }

    render(
      <MemoryRouter>
        <AuthContext.Provider value={signedOutAuth}>
          <ThemeProvider>
            <LoginPage />
          </ThemeProvider>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Accesa' })).toHaveAttribute(
      'src',
      '/brand/logo_accesa_fondo_blanco.png',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }))

    expect(screen.getByRole('img', { name: 'Accesa' })).toHaveAttribute(
      'src',
      '/brand/logo_accesa_fondo_blanco_oscuro_transparente.png',
    )
  })
})
