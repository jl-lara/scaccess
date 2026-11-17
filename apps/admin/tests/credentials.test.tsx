import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/lib/api'
import { CredentialsPage } from '../src/pages/CredentialsPage'
import {
  CREDENTIAL_ACTIVE,
  CREDENTIAL_BLOCKED,
  CREDENTIALS,
  EMPLOYEES,
  makeAuth,
  paginated,
} from './fixtures'
import { renderWithAuth } from './renderWithAuth'

vi.mock('../src/lib/api', () => ({
  api: {
    listCredentials: vi.fn(),
    listEmployees: vi.fn(),
    createCredential: vi.fn(),
    updateCredential: vi.fn(),
  },
}))

describe('CredentialsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listCredentials).mockResolvedValue(paginated(CREDENTIALS))
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES, 1, 100))
    vi.mocked(api.createCredential).mockResolvedValue(CREDENTIAL_ACTIVE)
    vi.mocked(api.updateCredential).mockResolvedValue({
      ...CREDENTIAL_ACTIVE,
      status: 'blocked',
      deactivationReason: 'Reporte del empleado',
    })
  })

  it('renders card UIDs and resolves the employee holder name', async () => {
    renderWithAuth(<CredentialsPage />, makeAuth(['operator']))

    const table = await screen.findByRole('table')
    expect(within(table).getByText('04A1B2C3D4E5F6')).toBeInTheDocument()
    expect(within(table).getByText('Ana Torres')).toBeInTheDocument()
    expect(within(table).getByText('EMP-001')).toBeInTheDocument()
    expect(within(table).queryByText('Extraviada')).not.toBeInTheDocument()
    expect(within(table).getByText('Bloqueada')).toBeInTheDocument()
  })

  it('rejects an invalid UID before calling the API and registers a valid one', async () => {
    renderWithAuth(<CredentialsPage />, makeAuth(['operator']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar tarjeta' }))

    const dialog = screen.getByRole('dialog', { name: 'Registrar tarjeta RFID' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('Empleado titular'), {
      target: { value: 'emp-1' },
    })
    fireEvent.change(within(dialog).getByLabelText('UID de la tarjeta'), {
      target: { value: 'XYZ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar tarjeta' }))

    const validationAlert = await within(dialog).findByRole('alert')
    expect(validationAlert).toHaveTextContent(/hexadecimal par de 8 a 32/i)
    expect(api.createCredential).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText('UID de la tarjeta'), {
      target: { value: '04a1b2c3d4e5f6' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar tarjeta' }))

    await waitFor(() => {
      expect(api.createCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-1',
          cardUid: '04A1B2C3D4E5F6',
          status: 'active',
        }),
      )
    })
    expect(await screen.findByText('Tarjeta RFID registrada correctamente.')).toBeInTheDocument()
  })

  it('updates a card status with a deactivation reason', async () => {
    renderWithAuth(<CredentialsPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('04A1B2C3D4E5F6').closest('tr')
    if (!row) throw new Error('No se encontro la fila de la tarjeta activa')

    fireEvent.click(within(row).getByRole('button', { name: 'Editar tarjeta 04A1B2C3D4E5F6' }))

    const dialog = screen.getByRole('dialog', { name: 'Editar tarjeta RFID' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('Estado de la tarjeta'), {
      target: { value: 'blocked' },
    })
    fireEvent.change(within(dialog).getByLabelText('Motivo de desactivacion'), {
      target: { value: 'Reporte del empleado' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar tarjeta' }))

    await waitFor(() => {
      expect(api.updateCredential).toHaveBeenCalledWith(
        'cred-1',
        expect.objectContaining({
          status: 'blocked',
          deactivationReason: 'Reporte del empleado',
          label: CREDENTIAL_ACTIVE.label,
        }),
      )
    })
    expect(await screen.findByText('Estado de la tarjeta RFID actualizado.')).toBeInTheDocument()
  })

  it('does not expose write actions to auditors', async () => {
    renderWithAuth(<CredentialsPage />, makeAuth(['auditor']))

    const table = await screen.findByRole('table')
    expect(within(table).getByText(CREDENTIAL_BLOCKED.cardUid)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar tarjeta' })).not.toBeInTheDocument()
  })

  it('shows an actionable empty state for an empty inventory', async () => {
    vi.mocked(api.listCredentials).mockResolvedValue(paginated([]))
    renderWithAuth(<CredentialsPage />, makeAuth(['operator']))

    const table = await screen.findByRole('table')
    expect(await screen.findByText('Sin tarjetas registradas')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Registrar tarjeta' })).toBeInTheDocument()
  })

  it('reports an inventory load error and retries the card list', async () => {
    vi.mocked(api.listCredentials).mockRejectedValueOnce(
      new Error('Sin conexion con el inventario'),
    )
    renderWithAuth(<CredentialsPage />, makeAuth(['operator']))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexion con el inventario')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(api.listCredentials).toHaveBeenCalledTimes(2)
    })
    expect(
      within(await screen.findByRole('table')).getByText(CREDENTIAL_ACTIVE.cardUid),
    ).toBeInTheDocument()
  })

  it('warns when the employee catalog fails and retries it', async () => {
    vi.mocked(api.listEmployees).mockRejectedValueOnce(
      new Error('Sin conexion con el directorio'),
    )
    renderWithAuth(<CredentialsPage />, makeAuth(['operator']))

    expect(await screen.findByText(/Sin conexion con el directorio/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(api.listEmployees).toHaveBeenCalledTimes(2)
    })
    expect(within(await screen.findByRole('table')).getByText('Ana Torres')).toBeInTheDocument()
  })
})
