import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/lib/api'
import { UsersPage } from '../src/pages/UsersPage'
import {
  EMPLOYEES,
  ROLES,
  USER_ADMIN,
  USER_AUDITOR,
  USERS,
  makeAuth,
  paginated,
} from './fixtures'
import { renderWithAuth } from './renderWithAuth'

vi.mock('../src/lib/api', () => ({
  api: {
    listUsers: vi.fn(),
    listRoles: vi.fn(),
    listEmployees: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listUsers).mockResolvedValue(paginated(USERS))
    vi.mocked(api.listRoles).mockResolvedValue(ROLES)
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES, 1, 100))
    vi.mocked(api.createUser).mockResolvedValue(USER_ADMIN)
    vi.mocked(api.updateUser).mockResolvedValue({ ...USER_AUDITOR, status: 'active' })
  })

  it('shows an explicit permissions notice to non-admin accounts without fetching users', async () => {
    renderWithAuth(<UsersPage />, makeAuth(['auditor']))

    expect(await screen.findByText('Permisos insuficientes')).toBeInTheDocument()
    expect(screen.getByText(/solo una cuenta con rol Administrador/i)).toBeInTheDocument()
    expect(api.listUsers).not.toHaveBeenCalled()
  })

  it('renders accounts with linked employees and role badges', async () => {
    renderWithAuth(<UsersPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    expect(within(table).getByText('admin.qa@scaccess.local')).toBeInTheDocument()
    expect(within(table).getByText('auditor.qa@scaccess.local')).toBeInTheDocument()
    expect(within(table).getByText('Administrador')).toBeInTheDocument()
    expect(within(table).getByText('Auditor')).toBeInTheDocument()
    expect(within(table).getByText('Deshabilitada')).toBeInTheDocument()
    expect(within(table).getByText('Ana Torres')).toBeInTheDocument()
    expect(api.listRoles).toHaveBeenCalledTimes(1)
  })

  it('creates an account linked to Supabase Auth with an explicit role', async () => {
    renderWithAuth(<UsersPage />, makeAuth(['admin']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva cuenta' }))

    const dialog = screen.getByRole('dialog', { name: 'Nueva cuenta' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('UUID de Supabase Auth'), {
      target: { value: '22222222-2222-4222-8222-222222222222' },
    })
    fireEvent.change(within(dialog).getByLabelText('Correo electronico'), {
      target: { value: 'nuevo.auditor@scaccess.local' },
    })
    expect(within(dialog).getByRole('checkbox', { name: /Auditor/ })).toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cuenta' }))

    await waitFor(() => {
      expect(api.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          authUserId: '22222222-2222-4222-8222-222222222222',
          email: 'nuevo.auditor@scaccess.local',
          status: 'active',
          employeeId: null,
          roleCodes: ['auditor'],
        }),
      )
    })
    expect(await screen.findByText('Cuenta creada correctamente.')).toBeInTheDocument()
  })

  it('updates the status and roles of an existing account', async () => {
    renderWithAuth(<UsersPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('auditor.qa@scaccess.local').closest('tr')
    if (!row) throw new Error('No se encontro la fila de la cuenta auditora')

    fireEvent.click(
      within(row).getByRole('button', { name: 'Editar cuenta auditor.qa@scaccess.local' }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Editar cuenta' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('Estado de la cuenta'), {
      target: { value: 'active' },
    })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Operador/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cuenta' }))

    await waitFor(() => {
      expect(api.updateUser).toHaveBeenCalledWith(
        'user-2',
        expect.objectContaining({ status: 'active', roleCodes: ['auditor', 'operator'] }),
      )
    })
    expect(await screen.findByText('Cuenta actualizada correctamente.')).toBeInTheDocument()
  })

  it('shows an actionable empty state for administrators', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(paginated([]))
    renderWithAuth(<UsersPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    expect(await screen.findByText('Sin cuentas registradas')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
  })

  it('reports an account load error and retries it', async () => {
    vi.mocked(api.listUsers).mockRejectedValueOnce(new Error('Sin conexion con el servidor'))
    renderWithAuth(<UsersPage />, makeAuth(['admin']))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexion con el servidor')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(api.listUsers).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('admin.qa@scaccess.local')).toBeInTheDocument()
  })
})
