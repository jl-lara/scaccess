import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { AppShell } from '../src/components/layout/AppShell'
import { AuthContext } from '../src/context/AuthContext'
import { ThemeProvider } from '../src/context/ThemeContext'
import { api } from '../src/lib/api'
import { resolveWebPermissions } from '../src/lib/permissions'
import { AccessEventsPage } from '../src/pages/AccessEventsPage'
import { AreasPage } from '../src/pages/AreasPage'
import { DashboardPage } from '../src/pages/DashboardPage'
import {
  AREAS,
  DEVICES,
  EMPLOYEES,
  EVENTS,
  ROLES,
  USERS,
  makeAuth,
  paginated,
} from './fixtures'
import { renderWithAuth } from './renderWithAuth'

vi.mock('../src/lib/api', () => ({
  api: {
    getHealth: vi.fn(),
    getDashboardSummary: vi.fn(),
    listAccessEvents: vi.fn(),
    getAccessEvent: vi.fn(),
    listAccessDevices: vi.fn(),
    listAreas: vi.fn(),
    listEmployees: vi.fn(),
    listUsers: vi.fn(),
    listRoles: vi.fn(),
  },
}))

describe('RBAC permissions and role-adaptive UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.getHealth).mockResolvedValue({
      status: 'ok',
      service: 'scaccess-api',
      timestamp: '2026-11-10T12:00:00.000Z',
      uptimeSeconds: 120,
    })
    vi.mocked(api.getDashboardSummary).mockResolvedValue({
      employees: { total: 4, active: 3 },
      credentials: { total: 3, active: 2, blockedOrLost: 1 },
      areas: { total: 2, active: 2 },
      devices: { total: 1, active: 1, outOfSync: 1 },
      recentEvents24h: { granted: 18, denied: 2 },
    })
    vi.mocked(api.listAccessEvents).mockResolvedValue(paginated(EVENTS))
    vi.mocked(api.listAccessDevices).mockResolvedValue(paginated(DEVICES))
    vi.mocked(api.listAreas).mockResolvedValue(paginated(AREAS, 1, 100))
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES, 1, 100))
    vi.mocked(api.listUsers).mockResolvedValue(paginated(USERS))
    vi.mocked(api.listRoles).mockResolvedValue(ROLES)
  })

  describe('resolveWebPermissions', () => {
    it('resolves exact capability matrices for admin, operator, auditor and viewer', () => {
      expect(resolveWebPermissions(['admin'])).toMatchObject({
        profile: 'admin',
        profileLabel: 'Administrador',
        isAdmin: true,
        canWriteCatalog: true,
        canManageInfrastructure: true,
        canManageUsers: true,
        canViewCatalogs: true,
        canExportReports: true,
        canUseSimulator: true,
      })

      expect(resolveWebPermissions(['operator'])).toMatchObject({
        profile: 'operator',
        profileLabel: 'Operador',
        isAdmin: false,
        canWriteCatalog: true,
        canManageInfrastructure: false,
        canManageUsers: false,
        canViewCatalogs: true,
        canExportReports: true,
        canUseSimulator: true,
      })

      expect(resolveWebPermissions(['auditor'])).toMatchObject({
        profile: 'auditor',
        profileLabel: 'Auditor',
        isAdmin: false,
        canWriteCatalog: false,
        canManageInfrastructure: false,
        canManageUsers: false,
        canViewCatalogs: true,
        canExportReports: true,
        canUseSimulator: false,
      })

      expect(resolveWebPermissions(['viewer'])).toMatchObject({
        profile: 'viewer',
        profileLabel: 'Monitor',
        isAdmin: false,
        canWriteCatalog: false,
        canManageInfrastructure: false,
        canManageUsers: false,
        canViewCatalogs: false,
        canExportReports: false,
        canUseSimulator: false,
      })
    })

    it('applies role priority and falls back safely to viewer when roles are missing', () => {
      expect(resolveWebPermissions(['viewer', 'operator']).profile).toBe('operator')
      expect(resolveWebPermissions(['auditor', 'admin']).profile).toBe('admin')
      expect(resolveWebPermissions([]).profile).toBe('viewer')
      expect(resolveWebPermissions(undefined).profile).toBe('viewer')
    })
  })

  describe('DashboardPage', () => {
    it('adapts DashboardPage for viewer without requesting restricted catalog endpoints', async () => {
      const { container } = renderWithAuth(<DashboardPage />, makeAuth(['viewer']))

      expect(await screen.findByText('Centro de Monitoreo Operativo')).toBeInTheDocument()
      expect(
        screen.getByText('Monitoreo en vivo de accesos recientes y estado por área.'),
      ).toBeInTheDocument()
      expect(screen.getByText('Perfil: Monitor')).toBeInTheDocument()

      expect(api.getDashboardSummary).toHaveBeenCalledTimes(1)
      expect(api.listAccessEvents).toHaveBeenCalledWith({ page: 1, pageSize: 8 })
      expect(api.listAreas).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
      expect(api.listAccessDevices).not.toHaveBeenCalled()
      expect(api.listEmployees).not.toHaveBeenCalled()

      expect(screen.getByText('Áreas protegidas')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Ver croquis/i })).toHaveAttribute('href', '/areas')
      expect(screen.getByText('Accesos concedidos (24h)')).toBeInTheDocument()
      expect(screen.getByText('Accesos denegados (24h)')).toBeInTheDocument()

      expect(screen.queryByText('Empleados activos')).not.toBeInTheDocument()
      expect(screen.queryByText('Tarjetas RFID activas')).not.toBeInTheDocument()
      expect(screen.queryByText('Controladores ESP32')).not.toBeInTheDocument()
      expect(
        screen.queryByText(/tienen cambios de configuración/i),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('region', { name: 'Estado de sincronización de dispositivos' }),
      ).not.toBeInTheDocument()

      const splitContainer = container.querySelector('.dashboard-split')
      expect(splitContainer).toHaveClass('dashboard-split--single')
    })

    it('uses read-only labels and operational copy on DashboardPage for auditor', async () => {
      renderWithAuth(<DashboardPage />, makeAuth(['auditor']))

      expect(
        await screen.findByText(
          'Consulta operativa de indicadores, actividad reciente y estado de controladores.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ver empleados' })).toHaveAttribute(
        'href',
        '/employees',
      )
      expect(screen.getByRole('link', { name: 'Ver tarjetas RFID' })).toHaveTextContent(
        'Ver tarjetas',
      )
      expect(api.listAccessDevices).toHaveBeenCalled()
      expect(api.listEmployees).toHaveBeenCalled()
    })
  })

  describe('AccessEventsPage', () => {
    it('hides employee/device catalogs, filters and PDF export for viewer', async () => {
      renderWithAuth(<AccessEventsPage />, makeAuth(['viewer']))

      await screen.findByRole('table')
      expect(api.listAreas).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
      expect(api.listAccessEvents).toHaveBeenCalled()
      expect(api.listEmployees).not.toHaveBeenCalled()
      expect(api.listAccessDevices).not.toHaveBeenCalled()

      expect(screen.getByLabelText('Área')).toBeInTheDocument()
      expect(screen.queryByLabelText('Controlador')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Empleado')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Exportar reporte PDF' }),
      ).not.toBeInTheDocument()
    })

    it('shows employee/device filters and PDF export for auditor', async () => {
      renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

      await screen.findByRole('table')
      expect(api.listEmployees).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
      expect(api.listAccessDevices).toHaveBeenCalledWith({ page: 1, pageSize: 100 })

      expect(screen.getByLabelText('Controlador')).toBeInTheDocument()
      expect(screen.getByLabelText('Empleado')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Exportar reporte PDF' })).toBeEnabled()
    })
  })

  describe('AreasPage', () => {
    it('renders only the live floor plan without tabs or listEmployees calls for viewer', async () => {
      renderWithAuth(<AreasPage />, makeAuth(['viewer']))

      expect(await screen.findByRole('heading', { level: 1, name: 'Croquis en vivo' })).toBeInTheDocument()
      expect(await screen.findByRole('region', { name: /Croquis de las áreas/i })).toBeInTheDocument()

      expect(api.listAreas).toHaveBeenCalled()
      expect(api.listAccessEvents).toHaveBeenCalled()
      expect(api.listEmployees).not.toHaveBeenCalled()

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /Catálogo de áreas/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /Simulador de accesos/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nueva área' })).not.toBeInTheDocument()
      expect(
        screen.queryByText(/solo un administrador puede crear o modificar áreas/i),
      ).not.toBeInTheDocument()
    })

    it('keeps catalog and floor plan tabs while hiding simulator for auditor', async () => {
      renderWithAuth(<AreasPage />, makeAuth(['auditor']))

      await screen.findByRole('table')
      expect(screen.getByRole('tab', { name: /Catálogo de áreas/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Croquis en vivo/i })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /Simulador de accesos/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nueva área' })).not.toBeInTheDocument()
    })

    it('shows all 3 tabs without creation controls for operator', async () => {
      renderWithAuth(<AreasPage />, makeAuth(['operator']))

      await screen.findByRole('table')
      expect(screen.getByRole('tab', { name: /Catálogo de áreas/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Croquis en vivo/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Simulador de accesos/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nueva área' })).not.toBeInTheDocument()
    })

    it('shows all 3 tabs and area creation controls for admin', async () => {
      renderWithAuth(<AreasPage />, makeAuth(['admin']))

      await screen.findByRole('table')
      expect(screen.getByRole('button', { name: 'Nueva área' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Catálogo de áreas/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Croquis en vivo/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Simulador de accesos/i })).toBeInTheDocument()
    })
  })

  describe('AppShell and RoleGuard routing', () => {
    it.each([
      {
        role: 'admin',
        expectedPill: 'Administrador · Control total',
        expectedLinks: [
          'Panel de control',
          'Bitácora de accesos',
          'Empleados',
          'Tarjetas RFID',
          'Controladores ESP32',
          'Permisos de acceso',
          'Áreas físicas',
          'Cuentas y roles',
        ],
        hiddenLinks: [] as string[],
      },
      {
        role: 'operator',
        expectedPill: 'Operador · Operación diaria',
        expectedLinks: [
          'Panel de control',
          'Bitácora de accesos',
          'Empleados',
          'Tarjetas RFID',
          'Controladores ESP32',
          'Permisos de acceso',
          'Áreas físicas',
        ],
        hiddenLinks: ['Cuentas y roles'],
      },
      {
        role: 'auditor',
        expectedPill: 'Auditor · Solo lectura y reportes',
        expectedLinks: [
          'Panel de control',
          'Bitácora de accesos',
          'Empleados',
          'Tarjetas RFID',
          'Controladores ESP32',
          'Permisos de acceso',
          'Áreas físicas',
        ],
        hiddenLinks: ['Cuentas y roles'],
      },
      {
        role: 'viewer',
        expectedPill: 'Monitor · Monitoreo en vivo',
        expectedLinks: ['Panel de control', 'Bitácora de accesos', 'Croquis en vivo'],
        hiddenLinks: [
          'Empleados',
          'Tarjetas RFID',
          'Controladores ESP32',
          'Permisos de acceso',
          'Áreas físicas',
          'Cuentas y roles',
        ],
      },
    ])(
      'adapts sidebar navigation and active profile pill in AppShell for $role',
      async ({ role, expectedPill, expectedLinks, hiddenLinks }) => {
        render(
          <MemoryRouter>
            <AuthContext.Provider value={makeAuth([role])}>
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

        expect(await screen.findByText(expectedPill)).toBeInTheDocument()
        const nav = screen.getByRole('navigation', { name: 'Menú administrativo' })

        for (const label of expectedLinks) {
          expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
        }
        for (const label of hiddenLinks) {
          expect(within(nav).queryByRole('link', { name: label })).not.toBeInTheDocument()
        }
      },
    )

    it('blocks /employees for viewer via RoleGuard without calling api.listEmployees', async () => {
      render(
        <MemoryRouter initialEntries={['/employees']}>
          <AuthContext.Provider value={makeAuth(['viewer'])}>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </AuthContext.Provider>
        </MemoryRouter>,
      )

      const alert = await screen.findByRole('alert')
      expect(within(alert).getByRole('heading', { name: 'Módulo restringido para tu perfil' })).toBeInTheDocument()
      expect(within(alert).getByText(/Perfil activo: Monitor/)).toBeInTheDocument()
      expect(within(alert).getByRole('link', { name: 'Volver al panel de control' })).toHaveAttribute(
        'href',
        '/',
      )
      expect(api.listEmployees).not.toHaveBeenCalled()
    })

    it.each(['viewer', 'operator', 'auditor'])(
      'blocks /users for %s via RoleGuard without calling api.listUsers',
      async (role) => {
        render(
          <MemoryRouter initialEntries={['/users']}>
            <AuthContext.Provider value={makeAuth([role])}>
              <ThemeProvider>
                <App />
              </ThemeProvider>
            </AuthContext.Provider>
          </MemoryRouter>,
        )

        const alert = await screen.findByRole('alert')
        expect(
          within(alert).getByRole('heading', { name: 'Módulo restringido para tu perfil' }),
        ).toBeInTheDocument()
        expect(api.listUsers).not.toHaveBeenCalled()
      },
    )
  })
})
