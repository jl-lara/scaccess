import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/lib/api'
import { AccessEventsPage } from '../src/pages/AccessEventsPage'
import {
  AREAS,
  DEVICES,
  EMPLOYEES,
  EVENT_GRANTED,
  EVENTS,
  makeAuth,
  paginated,
} from './fixtures'
import { renderWithAuth } from './renderWithAuth'

vi.mock('../src/lib/api', () => ({
  api: {
    listAccessEvents: vi.fn(),
    getAccessEvent: vi.fn(),
    listEmployees: vi.fn(),
    listAreas: vi.fn(),
    listAccessDevices: vi.fn(),
  },
}))

describe('AccessEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listAccessEvents).mockResolvedValue(paginated(EVENTS))
    vi.mocked(api.getAccessEvent).mockResolvedValue(EVENT_GRANTED)
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES, 1, 100))
    vi.mocked(api.listAreas).mockResolvedValue(paginated(AREAS, 1, 100))
    vi.mocked(api.listAccessDevices).mockResolvedValue(paginated(DEVICES, 1, 100))
  })

  it('distinguishes reader time, server reception time and unknown cards', async () => {
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    const table = await screen.findByRole('table')
    expect(screen.getByRole('columnheader', { name: 'Ocurrio (lector)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Recibido (servidor)' })).toBeInTheDocument()
    expect(within(table).getByText('Ana Torres')).toBeInTheDocument()
    expect(
      within(table).getByText('Tarjeta desconocida / sin empleado'),
    ).toBeInTheDocument()
    expect(within(table).getByText('DEADBEEF1234')).toBeInTheDocument()
    expect(within(table).getByText('Tarjeta no registrada')).toBeInTheDocument()
  })

  it('opens the immutable event detail with client identifiers and formatted metadata', async () => {
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('04A1B2C3D4E5F6').closest('tr')
    if (!row) throw new Error('No se encontro la fila del evento concedido')

    fireEvent.click(within(row).getByRole('button', { name: /Ver detalle/ }))

    expect(await screen.findByText('client-evt-1')).toBeInTheDocument()
    expect(screen.getByText('epoch-3')).toBeInTheDocument()
    expect(screen.getByText('1042')).toBeInTheDocument()
    expect(screen.getByText(/"reader": "PN532"/)).toBeInTheDocument()
    expect(screen.getByText(/"offline": true/)).toBeInTheDocument()
    expect(api.getAccessEvent).toHaveBeenCalledWith('event-1')
  })

  it('applies decision, normalized UID and date filters', async () => {
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'denied' } })
    fireEvent.change(screen.getByLabelText('UID de tarjeta'), {
      target: { value: 'deadbeef1234' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() => {
      expect(api.listAccessEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          decision: 'denied',
          cardUid: 'DEADBEEF1234',
        }),
      )
    })
  })

  it('validates the UID and the date range before querying the API', async () => {
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    await screen.findByRole('table')
    const callsAfterInitialLoad = vi.mocked(api.listAccessEvents).mock.calls.length

    fireEvent.change(screen.getByLabelText('UID de tarjeta'), {
      target: { value: 'not-a-uid' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/hexadecimal par de 8 a 32/i)
    expect(api.listAccessEvents).toHaveBeenCalledTimes(callsAfterInitialLoad)

    fireEvent.change(screen.getByLabelText('UID de tarjeta'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-11-10T12:00' },
    })
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-11-09T12:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no puede ser anterior a la fecha de inicio/i,
    )
    expect(api.listAccessEvents).toHaveBeenCalledTimes(callsAfterInitialLoad)
  })

  it('shows an explicit empty state when the filters match no events', async () => {
    vi.mocked(api.listAccessEvents).mockResolvedValueOnce(paginated([]))
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    expect(await screen.findByText('Sin eventos que coincidan')).toBeInTheDocument()
    expect(
      screen.getByText(/Ajusta los filtros para ampliar el rango de busqueda/),
    ).toBeInTheDocument()
  })

  it('reports a bitacora load error and retries it', async () => {
    vi.mocked(api.listAccessEvents).mockRejectedValueOnce(
      new Error('Sin conexion con la bitacora'),
    )
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexion con la bitacora')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(api.listAccessEvents).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument()
  })
})
