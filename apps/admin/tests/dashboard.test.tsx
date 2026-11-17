import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, hasAllowedAdminRole, type AuthContextValue } from '../src/context/AuthContext'
import {
  CREDENTIAL_STATUS_LABELS,
  DECISION_LABELS,
  EMPLOYEE_STATUS_LABELS,
  REASON_LABELS,
  formatDateTime,
} from '../src/lib/formatters'
import { api } from '../src/lib/api'
import { DashboardPage } from '../src/pages/DashboardPage'
import { paginated } from './fixtures'

vi.mock('../src/lib/api', () => ({
  api: {
    getDashboardSummary: vi.fn().mockResolvedValue({
      employees: { total: 4, active: 3 },
      credentials: { total: 3, active: 2, blockedOrLost: 1 },
      areas: { total: 3, active: 3 },
      devices: { total: 2, active: 2, outOfSync: 1 },
      recentEvents24h: { granted: 18, denied: 2 },
    }),
    listAccessEvents: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'ev-1',
          deviceId: 'dev-1',
          clientEventId: 'cli-1',
          deviceEpoch: null,
          cardUid: '04A1B2C3D4E5F6',
          employeeId: 'emp-1',
          credentialId: 'cred-1',
          areaId: 'area-1',
          decision: 'granted',
          reasonCode: 'allowed',
          occurredAt: '2026-11-10T12:00:00.000Z',
          receivedAt: '2026-11-10T12:00:02.000Z',
          deviceSequence: '1',
          metadata: { direction: 'entry' },
          createdAt: '2026-11-10T12:00:02.000Z',
        },
        {
          id: 'ev-2',
          deviceId: 'dev-1',
          clientEventId: 'cli-2',
          deviceEpoch: null,
          cardUid: 'DEADBEEF1234',
          employeeId: null,
          credentialId: null,
          areaId: 'area-1',
          decision: 'denied',
          reasonCode: 'card_unknown',
          occurredAt: '2026-11-10T12:05:00.000Z',
          receivedAt: '2026-11-10T12:05:01.000Z',
          deviceSequence: '2',
          metadata: { direction: 'exit' },
          createdAt: '2026-11-10T12:05:01.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 8, total: 2, totalPages: 1 },
    }),
    listAccessDevices: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'dev-1',
          deviceCode: 'ESP32-QA-01',
          name: 'Lector Entrada Principal',
          location: 'Edificio A',
          status: 'active',
          hardwareModel: 'ESP32-S3',
          firmwareVersion: '1.0.0',
          configVersion: '3',
          lastSeenAt: '2026-11-10T12:00:00.000Z',
          provisionedAt: '2026-11-01T00:00:00.000Z',
          areaIds: ['area-1'],
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-10T12:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }),
    listAreas: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'area-1',
          code: 'MAIN_ENTRANCE',
          name: 'Entrada Principal',
          description: 'Entrada general',
          isActive: true,
          timezone: 'America/Tijuana',
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    }),
    listEmployees: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'emp-1',
          employeeCode: 'EMP-QA-001',
          firstName: 'Empleado',
          lastName: 'QA Movil',
          email: 'employee.qa@scaccess.local',
          department: 'Ingenieria',
          position: 'Analista',
          status: 'active',
          hiredAt: null,
          deactivatedAt: null,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    }),
  },
}))

const mockAuthValue: AuthContextValue = {
  user: {
    id: 'user-admin',
    authUserId: 'auth-admin',
    employeeId: null,
    email: 'admin.qa@scaccess.local',
    status: 'active',
    roles: ['admin'],
    lastLoginAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  loading: false,
  error: null,
  isAdmin: true,
  canWriteCatalog: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
}

describe('Admin formatters and role guards', () => {
  it('maps domain statuses and reasons to Spanish labels', () => {
    expect(EMPLOYEE_STATUS_LABELS.active).toBe('Activo')
    expect(CREDENTIAL_STATUS_LABELS.lost).toBe('Extraviada')
    expect(DECISION_LABELS.granted).toBe('Concedido')
    expect(REASON_LABELS.card_unknown).toBe('Tarjeta no registrada')
    expect(formatDateTime(null)).toBe('—')
  })

  it('validates allowed admin console roles', () => {
    expect(hasAllowedAdminRole(['admin'])).toBe(true)
    expect(hasAllowedAdminRole(['operator'])).toBe(true)
    expect(hasAllowedAdminRole(['auditor'])).toBe(true)
    expect(hasAllowedAdminRole(['employee'])).toBe(false)
  })
})

describe('DashboardPage', () => {
  it('renders KPI cards, out-of-sync alert, recent activity chart and device health', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthValue}>
          <DashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Centro de Monitoreo Operativo')).toBeInTheDocument()
    expect(screen.getByText('Empleados activos')).toBeInTheDocument()
    expect(screen.getByText('Tarjetas RFID activas')).toBeInTheDocument()
    expect(screen.getByText('Areas protegidas')).toBeInTheDocument()
    expect(screen.getByText('Accesos concedidos (24h)')).toBeInTheDocument()
    expect(screen.getByText('Accesos denegados (24h)')).toBeInTheDocument()
    expect(screen.getByText('Lector Entrada Principal')).toBeInTheDocument()
    expect(screen.getByText(/controlador\(es\) activo\(s\) tienen cambios/i)).toBeInTheDocument()

    expect(
      await screen.findByRole('img', { name: 'Gráfica de últimos eventos de acceso' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Últimos eventos de acceso registrados')).toBeInTheDocument()
    expect(screen.getByText('Entrada Principal')).toBeInTheDocument()
    expect(screen.getByText('Acceso permitido')).toBeInTheDocument()
    expect(screen.getByText('Tarjeta desconocida')).toBeInTheDocument()
    expect(screen.getByText('Permitido')).toBeInTheDocument()
    expect(screen.getByText('Denegado')).toBeInTheDocument()
    expect(screen.getByText('Entrada')).toBeInTheDocument()
    expect(screen.getByText('Salida')).toBeInTheDocument()
    expect(screen.getByTitle(/Empleado QA Movil · 04A1B2C3D4E5F6/)).toBeInTheDocument()
    expect(screen.getByTitle(/DEADBEEF1234/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver bitácora completa/i })).toHaveAttribute(
      'href',
      '/access-events',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a retryable error when the telemetry request fails', async () => {
    vi.mocked(api.getDashboardSummary).mockRejectedValueOnce(
      new Error('Sin conexion con el panel'),
    )

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthValue}>
          <DashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexion con el panel')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(
      await screen.findByRole('img', { name: 'Gráfica de últimos eventos de acceso' }),
    ).toBeInTheDocument()
    expect(screen.getByTitle(/Empleado QA Movil · 04A1B2C3D4E5F6/)).toBeInTheDocument()
  })

  it('renders explicit empty states when there is no recent activity', async () => {
    vi.mocked(api.getDashboardSummary).mockResolvedValueOnce({
      employees: { total: 0, active: 0 },
      credentials: { total: 0, active: 0, blockedOrLost: 0 },
      areas: { total: 0, active: 0 },
      devices: { total: 0, active: 0, outOfSync: 0 },
      recentEvents24h: { granted: 0, denied: 0 },
    })
    vi.mocked(api.listAccessEvents).mockResolvedValueOnce(paginated([]))
    vi.mocked(api.listAccessDevices).mockResolvedValueOnce(paginated([]))

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthValue}>
          <DashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('Sin eventos de acceso en las ultimas 24 horas.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sin eventos registrados')).toBeInTheDocument()
    expect(
      screen.getByText('Aún no existen lecturas enviadas por los controladores ESP32-S3.'),
    ).toBeInTheDocument()
    expect(screen.getByText('No hay controladores registrados.')).toBeInTheDocument()
    expect(screen.getByText('Sin actividad reciente')).toBeInTheDocument()
    expect(screen.getByText('Sin rechazos recientes')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Gráfica de últimos eventos de acceso' })).toBeNull()
  })

  it('shows the chart loading state while recent events are pending', () => {
    vi.mocked(api.getDashboardSummary).mockReturnValueOnce(new Promise<never>(() => {}))

    render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthValue}>
          <DashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Cargando eventos recientes...')).toBeInTheDocument()
  })
})
