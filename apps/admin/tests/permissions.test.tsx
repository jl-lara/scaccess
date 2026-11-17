import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/lib/api'
import { PermissionsPage } from '../src/pages/PermissionsPage'
import {
  AREAS,
  EMPLOYEES,
  PERMISSION_ACTIVE,
  PERMISSIONS,
  makeAuth,
  paginated,
} from './fixtures'
import { renderWithAuth } from './renderWithAuth'

vi.mock('../src/lib/api', () => ({
  api: {
    listAccessPermissions: vi.fn(),
    listEmployees: vi.fn(),
    listAreas: vi.fn(),
    createAccessPermission: vi.fn(),
    revokeAccessPermission: vi.fn(),
  },
}))

describe('PermissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listAccessPermissions).mockResolvedValue(paginated(PERMISSIONS))
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES, 1, 100))
    vi.mocked(api.listAreas).mockResolvedValue(paginated(AREAS, 1, 100))
    vi.mocked(api.createAccessPermission).mockResolvedValue(PERMISSION_ACTIVE)
    vi.mocked(api.revokeAccessPermission).mockResolvedValue({
      ...PERMISSION_ACTIVE,
      revokedAt: '2026-11-10T12:00:00.000Z',
    })
  })

  it('joins permissions with employee and area names loaded in parallel', async () => {
    renderWithAuth(<PermissionsPage />, makeAuth(['operator']))

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Ana Torres')).toBeInTheDocument()
    expect(within(table).getByText('Acceso Principal')).toBeInTheDocument()
    expect(within(table).getByText('Vigente')).toBeInTheDocument()
    expect(within(table).getByText('Revocado')).toBeInTheDocument()
    expect(api.listEmployees).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
    expect(api.listAreas).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
  })

  it('grants a permission from the modal form', async () => {
    renderWithAuth(<PermissionsPage />, makeAuth(['operator']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Otorgar permiso' }))

    const dialog = screen.getByRole('dialog', { name: 'Otorgar permiso de acceso' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('Empleado beneficiario'), {
      target: { value: 'emp-1' },
    })
    fireEvent.change(within(dialog).getByLabelText('Area protegida'), {
      target: { value: 'area-1' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar permiso' }))

    await waitFor(() => {
      expect(api.createAccessPermission).toHaveBeenCalledWith({
        employeeId: 'emp-1',
        areaId: 'area-1',
        validFrom: null,
        validTo: null,
      })
    })
    expect(await screen.findByText('Permiso de acceso otorgado correctamente.')).toBeInTheDocument()
  })

  it('revokes an active permission after confirmation', async () => {
    renderWithAuth(<PermissionsPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('Ana Torres').closest('tr')
    if (!row) throw new Error('No se encontro la fila del permiso activo')

    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Revocar permiso de Ana Torres en Acceso Principal',
      }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Revocar permiso de acceso' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText(/no elimina el registro del permiso/i)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar revocacion' }))

    await waitFor(() => {
      expect(api.revokeAccessPermission).toHaveBeenCalledWith('permission-1')
    })
    expect(
      await screen.findByText(/Permiso revocado. El historial de accesos se conserva intacto./),
    ).toBeInTheDocument()
  })

  it('shows an actionable empty state and clears active filters', async () => {
    vi.mocked(api.listAccessPermissions).mockResolvedValue(paginated([]))
    renderWithAuth(<PermissionsPage />, makeAuth(['operator']))

    const table = await screen.findByRole('table')
    expect(await screen.findByText('Sin permisos otorgados')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Otorgar permiso' })).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Solo permisos sin revocar'))
    expect(await screen.findByText('Sin permisos que coincidan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => {
      expect(api.listAccessPermissions).toHaveBeenLastCalledWith(
        expect.objectContaining({ activeOnly: undefined, page: 1 }),
      )
    })
    expect(await screen.findByText('Sin permisos otorgados')).toBeInTheDocument()
  })

  it('reports a load error and retries the matrix', async () => {
    vi.mocked(api.listAccessPermissions).mockRejectedValueOnce(
      new Error('Sin conexion con el servidor'),
    )
    renderWithAuth(<PermissionsPage />, makeAuth(['operator']))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexion con el servidor')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(api.listAccessPermissions).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Vigente')).toBeInTheDocument()
  })
})
