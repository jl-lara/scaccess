import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/lib/api'
import { DevicesPage } from '../src/pages/DevicesPage'
import {
  AREAS,
  DEVICE_MAIN,
  DEVICES,
  ISSUED_TOKEN,
  SYNC_STATE_OUTDATED,
  makeAuth,
  paginated,
} from './fixtures'
import { renderWithAuth } from './renderWithAuth'

vi.mock('../src/lib/api', () => ({
  api: {
    listAccessDevices: vi.fn(),
    listAreas: vi.fn(),
    getDeviceSyncState: vi.fn(),
    issueDeviceCredential: vi.fn(),
    createAccessDevice: vi.fn(),
    updateAccessDevice: vi.fn(),
  },
}))

describe('DevicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listAccessDevices).mockResolvedValue(paginated(DEVICES))
    vi.mocked(api.listAreas).mockResolvedValue(paginated(AREAS, 1, 100))
    vi.mocked(api.getDeviceSyncState).mockResolvedValue(SYNC_STATE_OUTDATED)
    vi.mocked(api.issueDeviceCredential).mockResolvedValue(ISSUED_TOKEN)
    vi.mocked(api.createAccessDevice).mockResolvedValue(DEVICE_MAIN)
    vi.mocked(api.updateAccessDevice).mockResolvedValue(DEVICE_MAIN)
  })

  it('renders device metadata, assigned areas and separates connectivity from admin status (H6)', async () => {
    vi.mocked(api.listAccessDevices).mockResolvedValueOnce(
      paginated([
        DEVICE_MAIN,
        {
          ...DEVICE_MAIN,
          id: 'device-2',
          deviceCode: 'ESP32-QA-02',
          name: 'Lector Reciente',
          lastSeenAt: new Date().toISOString(),
        },
      ]),
    )
    renderWithAuth(<DevicesPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Lector Entrada Principal')).toBeInTheDocument()
    expect(within(table).getByText('ESP32-QA-01')).toBeInTheDocument()
    expect(within(table).getAllByText('Acceso Principal, Laboratorio de Redes')).toHaveLength(2)
    expect(within(table).getByText('Sin conexión')).toBeInTheDocument()
    expect(within(table).getByText('En línea')).toBeInTheDocument()
    expect(within(table).getAllByText('Activo')).toHaveLength(2)
    expect(within(table).getAllByText(/config v4/)).toHaveLength(2)
  })

  it('shows a clear outdated synchronization verdict', async () => {
    renderWithAuth(<DevicesPage />, makeAuth(['operator']))

    await screen.findByRole('table')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Consultar sincronización de Lector Entrada Principal',
      }),
    )

    expect(await screen.findByText('Desactualizado')).toBeInTheDocument()
    expect(screen.getByText(/Reportada por el equipo: v3/)).toBeInTheDocument()
    expect(screen.getByText(/Versión actual del servidor: v4/)).toBeInTheDocument()
    expect(screen.getByText('7 eventos sin sincronizar')).toBeInTheDocument()
    expect(screen.getByText('Sin errores reportados')).toBeInTheDocument()
    expect(api.getDeviceSyncState).toHaveBeenCalledWith('device-1')
  })

  it('issues a device credential and warns that the token is shown only once', async () => {
    renderWithAuth(<DevicesPage />, makeAuth(['admin']))

    await screen.findByRole('table')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Emitir credencial de Lector Entrada Principal',
      }),
    )

    expect(await screen.findByText('token-abc.secret-123')).toBeInTheDocument()
    expect(screen.getByText(/solo se muestra una vez/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar token' })).toBeInTheDocument()
    expect(api.issueDeviceCredential).toHaveBeenCalledWith('device-1')
  })

  it('creates a device with multiple assigned areas', async () => {
    renderWithAuth(<DevicesPage />, makeAuth(['admin']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo controlador' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Código del controlador'), {
      target: { value: 'ESP32-B-02' },
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre del controlador'), {
      target: { value: 'Lector Laboratorio' },
    })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Laboratorio de Redes/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar controlador' }))

    await waitFor(() => {
      expect(api.createAccessDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceCode: 'ESP32-B-02',
          name: 'Lector Laboratorio',
          areaIds: ['area-2'],
          status: 'active',
        }),
      )
    })
    expect(await screen.findByText('Controlador registrado correctamente.')).toBeInTheDocument()
  })

  it('keeps administrative actions hidden from auditors', async () => {
    renderWithAuth(<DevicesPage />, makeAuth(['auditor']))

    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Nuevo controlador' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Editar Lector Entrada Principal/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Consultar sincronización de Lector Entrada Principal',
      }),
    ).toBeInTheDocument()
  })

  it('shows an empty inventory state with the correct permission guidance', async () => {
    vi.mocked(api.listAccessDevices).mockResolvedValueOnce(paginated([]))
    renderWithAuth(<DevicesPage />, makeAuth(['auditor']))

    expect(await screen.findByText('Sin controladores registrados')).toBeInTheDocument()
    expect(
      screen.getByText(/Solicita a un administrador que registre el primer lector/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Registrar controlador' }),
    ).not.toBeInTheDocument()
  })

  it('reports an inventory load error and retries it', async () => {
    vi.mocked(api.listAccessDevices).mockRejectedValueOnce(
      new Error('Sin conexion con el inventario'),
    )
    renderWithAuth(<DevicesPage />, makeAuth(['admin']))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexion con el inventario')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(api.listAccessDevices).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Lector Entrada Principal')).toBeInTheDocument()
  })

  it('reports a synchronization lookup error and retries it', async () => {
    vi.mocked(api.getDeviceSyncState)
      .mockRejectedValueOnce(new Error('El controlador no respondio'))
      .mockResolvedValueOnce(SYNC_STATE_OUTDATED)
    renderWithAuth(<DevicesPage />, makeAuth(['operator']))

    await screen.findByRole('table')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Consultar sincronización de Lector Entrada Principal',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('El controlador no respondio')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Desactualizado')).toBeInTheDocument()
  })
})
