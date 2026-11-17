import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccessEventDto } from '@scaccess/shared'
import { api } from '../src/lib/api'
import { AreasPage } from '../src/pages/AreasPage'
import {
  AREA_LAB,
  AREA_MAIN,
  AREAS,
  EMPLOYEE_ANA,
  EMPLOYEE_LUIS,
  EMPLOYEES,
  EVENT_GRANTED,
  makeAuth,
  paginated,
} from './fixtures'
import { renderWithAuth } from './renderWithAuth'

vi.mock('../src/lib/api', () => ({
  api: {
    listAreas: vi.fn(),
    createArea: vi.fn(),
    updateArea: vi.fn(),
    listAccessEvents: vi.fn(),
    listEmployees: vi.fn(),
  },
}))

function makeFloorEvent(
  overrides: Partial<AccessEventDto> &
    Pick<AccessEventDto, 'id' | 'employeeId' | 'areaId' | 'occurredAt'>,
): AccessEventDto {
  return {
    ...EVENT_GRANTED,
    decision: 'granted',
    reasonCode: 'allowed',
    metadata: null,
    ...overrides,
  }
}

describe('AreasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listAreas).mockResolvedValue(paginated(AREAS))
    vi.mocked(api.createArea).mockResolvedValue(AREA_LAB)
    vi.mocked(api.updateArea).mockResolvedValue(AREA_MAIN)
    vi.mocked(api.listAccessEvents).mockResolvedValue(paginated([]))
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES))
  })

  it('shows the catalog in read-only mode for auditors', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['auditor']))

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Acceso Principal')).toBeInTheDocument()
    expect(within(table).getByText('MAIN_ENTRANCE')).toBeInTheDocument()
    expect(within(table).getAllByText('America/Tijuana')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Nueva area' })).not.toBeInTheDocument()
    expect(
      screen.getByText(/solo un administrador puede crear o modificar areas/i),
    ).toBeInTheDocument()
  })

  it('creates an area from the admin modal', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva area' }))

    const dialog = screen.getByRole('dialog', { name: 'Nueva area' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('Codigo del area'), {
      target: { value: 'lab_north' },
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre del area'), {
      target: { value: 'Laboratorio Norte' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descripcion'), {
      target: { value: 'Zona restringida de investigacion' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar area' }))

    await waitFor(() => {
      expect(api.createArea).toHaveBeenCalledWith({
        code: 'LAB_NORTH',
        name: 'Laboratorio Norte',
        description: 'Zona restringida de investigacion',
        timezone: 'America/Tijuana',
        isActive: true,
      })
    })
    expect(await screen.findByText('Area creada correctamente.')).toBeInTheDocument()
  })

  it('rejects an invalid IANA timezone before calling the API', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva area' }))

    const dialog = screen.getByRole('dialog', { name: 'Nueva area' })
    fireEvent.change(within(dialog).getByLabelText('Codigo del area'), {
      target: { value: 'QA_ZONE' },
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre del area'), {
      target: { value: 'Zona QA' },
    })
    fireEvent.change(within(dialog).getByLabelText('Zona horaria'), {
      target: { value: 'Not/AZone' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar area' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /La zona horaria no es valida/i,
    )
    expect(api.createArea).not.toHaveBeenCalled()
  })

  it('edits an area and can deactivate it', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('Acceso Principal').closest('tr')
    if (!row) throw new Error('No se encontro la fila del area principal')

    fireEvent.click(within(row).getByRole('button', { name: 'Editar area Acceso Principal' }))

    const dialog = screen.getByRole('dialog', { name: 'Editar area' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('Nombre del area'), {
      target: { value: 'Acceso Principal Norte' },
    })
    fireEvent.click(within(dialog).getByLabelText('Area activa y disponible para permisos'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar area' }))

    await waitFor(() => {
      expect(api.updateArea).toHaveBeenCalledWith(
        'area-1',
        expect.objectContaining({
          name: 'Acceso Principal Norte',
          isActive: false,
          timezone: 'America/Tijuana',
        }),
      )
    })
    expect(await screen.findByText('Area actualizada correctamente.')).toBeInTheDocument()
  })

  it('shows an actionable empty state for administrators', async () => {
    vi.mocked(api.listAreas).mockResolvedValue(paginated([]))
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    expect(await screen.findByText('Sin areas registradas')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Crear area' })).toBeInTheDocument()
  })

  it('reports a catalog error and retries the load', async () => {
    vi.mocked(api.listAreas).mockRejectedValueOnce(new Error('Sin conexion con el servidor'))
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexion con el servidor')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(api.listAreas).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Acceso Principal')).toBeInTheDocument()
  })

  it('renders the floor plan and locates employees using granted entries and exits', async () => {
    vi.mocked(api.listAccessEvents).mockResolvedValue(
      paginated([
        makeFloorEvent({
          id: 'floor-entry-ana',
          employeeId: EMPLOYEE_ANA.id,
          areaId: AREA_MAIN.id,
          occurredAt: '2026-11-10T12:00:00.000Z',
        }),
        makeFloorEvent({
          id: 'floor-entry-luis',
          employeeId: EMPLOYEE_LUIS.id,
          areaId: AREA_LAB.id,
          occurredAt: '2026-11-10T11:45:00.000Z',
        }),
        makeFloorEvent({
          id: 'floor-exit-luis',
          employeeId: EMPLOYEE_LUIS.id,
          areaId: AREA_LAB.id,
          occurredAt: '2026-11-10T11:50:00.000Z',
          metadata: { direction: 'exit' },
        }),
      ]),
    )

    renderWithAuth(<AreasPage />, makeAuth(['auditor']))

    const floorPlan = await screen.findByRole('region', { name: /Croquis de las areas/i })
    expect(
      within(floorPlan).getByRole('heading', {
        name: 'Croquis de las areas y ubicacion en tiempo real (Simulacion)',
      }),
    ).toBeInTheDocument()
    expect(within(floorPlan).getByText('MAIN_ENTRANCE')).toBeInTheDocument()
    expect(within(floorPlan).getByText('NETWORK_LAB')).toBeInTheDocument()

    const mainZone = screen.getByTestId(`floor-zone-${AREA_MAIN.id}`)
    expect(await within(mainZone).findByText('Ana Torres')).toBeInTheDocument()
    expect(within(mainZone).getByText(/EMP-001/)).toBeInTheDocument()
    expect(within(mainZone).getByText('1 persona en zona')).toBeInTheDocument()

    const labZone = screen.getByTestId(`floor-zone-${AREA_LAB.id}`)
    expect(within(labZone).queryByText('Luis Ramos')).not.toBeInTheDocument()

    const exteriorZone = screen.getByTestId('floor-zone-exterior')
    expect(within(exteriorZone).getByText('Exterior / Salida registrada')).toBeInTheDocument()
    expect(within(exteriorZone).getByText('Fuera de instalaciones / En transito')).toBeInTheDocument()
    expect(await within(exteriorZone).findByText('Luis Ramos')).toBeInTheDocument()
    expect(within(exteriorZone).getByText(/EMP-002/)).toBeInTheDocument()
  })

  it('renders floor plan occupants as personitas with screen-reader-only labels', async () => {
    vi.mocked(api.listAccessEvents).mockResolvedValue(
      paginated([
        makeFloorEvent({
          id: 'personita-entry-ana',
          employeeId: EMPLOYEE_ANA.id,
          areaId: AREA_MAIN.id,
          occurredAt: '2026-11-10T12:00:00.000Z',
        }),
        makeFloorEvent({
          id: 'personita-entry-luis',
          employeeId: EMPLOYEE_LUIS.id,
          areaId: AREA_LAB.id,
          occurredAt: '2026-11-10T11:45:00.000Z',
        }),
        makeFloorEvent({
          id: 'personita-exit-luis',
          employeeId: EMPLOYEE_LUIS.id,
          areaId: AREA_LAB.id,
          occurredAt: '2026-11-10T11:50:00.000Z',
          metadata: { direction: 'exit' },
        }),
      ]),
    )

    renderWithAuth(<AreasPage />, makeAuth(['auditor']))

    const mainZone = await screen.findByTestId(`floor-zone-${AREA_MAIN.id}`)
    const anaChip = await within(mainZone).findByRole('button', { name: /Ana Torres, Entrada/ })
    const anaName = within(anaChip).getByText('Ana Torres')
    const anaCode = within(anaChip).getByText('EMP-001')
    const hiddenLabel = anaName.closest('.sr-only')

    if (!(hiddenLabel instanceof HTMLElement)) {
      throw new Error('No se encontro la etiqueta accesible de la personita')
    }

    expect(hiddenLabel).toContainElement(anaCode)
    expect(anaChip).toHaveClass('croquis__chip')
    expect(anaChip).not.toHaveClass('croquis__chip--exit')
    expect(anaChip.querySelector('.croquis__chip-copy')).toBeNull()
    expect(anaChip.querySelector('.croquis__chip-name')).toBeNull()
    expect(
      anaChip.querySelector('svg[data-personita-icon="true"] path[d^="M13.9 2.999"]'),
    ).not.toBeNull()
    expect(anaChip.getAttribute('title')).toContain('Ana Torres (EMP-001) — Entrada')

    fireEvent.click(anaChip)
    const closeButton = await screen.findByRole('button', { name: 'Cerrar detalle' })
    const detailPanel = closeButton.closest('.croquis__panel')
    if (!(detailPanel instanceof HTMLElement)) {
      throw new Error('No se encontro el detalle de la ubicacion seleccionada')
    }
    const locatedPeople = within(detailPanel).getByRole('region', {
      name: 'Personas ubicadas en la zona',
    })
    expect(within(locatedPeople).getByText('Ana Torres')).toBeInTheDocument()

    const exteriorZone = screen.getByTestId('floor-zone-exterior')
    const luisChip = await within(exteriorZone).findByRole('button', {
      name: /Luis Ramos, Salida/,
    })
    expect(luisChip).toHaveClass('croquis__chip--exit')
    expect(
      luisChip.querySelector('svg[data-personita-icon="true"] path[d^="M13.9 2.999"]'),
    ).not.toBeNull()
    expect(within(luisChip).getByText('Luis Ramos').closest('.sr-only')).not.toBeNull()

    const floorPlan = screen.getByRole('region', { name: /Croquis de las areas/i })
    const legendTitle = within(floorPlan).getByText('Simbología:')
    const legend = legendTitle.closest('.croquis__legend')
    if (!(legend instanceof HTMLElement)) {
      throw new Error('No se encontro la simbologia del croquis')
    }
    expect(legend.querySelectorAll('svg[data-personita-icon="true"]')).toHaveLength(2)
    expect(
      within(legend).getByText('Empleado en área (última lectura: entrada)'),
    ).toBeInTheDocument()
    expect(
      within(legend).getByText('Empleado en exterior (última lectura: salida)'),
    ).toBeInTheDocument()
  })

  it('simulates employee entry and exit movements in the floor plan', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    const mainZone = await screen.findByTestId(`floor-zone-${AREA_MAIN.id}`)
    const employeeSelect = await screen.findByLabelText('Empleado a mover')

    await waitFor(() => {
      expect(within(employeeSelect).getByRole('option', { name: /Ana Torres/ })).toBeInTheDocument()
    })

    fireEvent.change(employeeSelect, { target: { value: EMPLOYEE_ANA.id } })
    fireEvent.change(screen.getByLabelText('Movimiento'), { target: { value: 'entry' } })
    fireEvent.change(screen.getByLabelText('Area de destino'), {
      target: { value: AREA_MAIN.id },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
    )

    expect(await within(mainZone).findByText('Ana Torres')).toBeInTheDocument()
    expect(within(mainZone).getByText('1 persona en zona')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Movimiento'), { target: { value: 'exit' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
    )

    const exteriorZone = screen.getByTestId('floor-zone-exterior')
    expect(await within(exteriorZone).findByText('Ana Torres')).toBeInTheDocument()
    expect(within(mainZone).queryByText('Ana Torres')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Restablecer con datos del servidor' }))

    await waitFor(() => {
      expect(within(exteriorZone).queryByText('Ana Torres')).not.toBeInTheDocument()
    })
  })

  it('highlights the employee location with the floor plan search', async () => {
    vi.mocked(api.listAccessEvents).mockResolvedValue(
      paginated([
        makeFloorEvent({
          id: 'search-entry-ana',
          employeeId: EMPLOYEE_ANA.id,
          areaId: AREA_MAIN.id,
          occurredAt: '2026-11-10T12:00:00.000Z',
        }),
        makeFloorEvent({
          id: 'search-entry-luis',
          employeeId: EMPLOYEE_LUIS.id,
          areaId: AREA_LAB.id,
          occurredAt: '2026-11-10T11:40:00.000Z',
        }),
        makeFloorEvent({
          id: 'search-exit-luis',
          employeeId: EMPLOYEE_LUIS.id,
          areaId: AREA_LAB.id,
          occurredAt: '2026-11-10T11:50:00.000Z',
          metadata: { action: 'exit' },
        }),
      ]),
    )

    renderWithAuth(<AreasPage />, makeAuth(['auditor']))

    const mainZone = await screen.findByTestId(`floor-zone-${AREA_MAIN.id}`)
    await within(mainZone).findByText('Ana Torres')

    const searchInput = screen.getByLabelText('Buscar empleado en el croquis')
    fireEvent.change(searchInput, { target: { value: 'Ana' } })

    expect(
      await screen.findByText('Ubicacion: Ana Torres: Acceso Principal'),
    ).toBeInTheDocument()
    expect(mainZone).toHaveClass('is-match')
    expect(screen.getByTestId('floor-zone-exterior')).not.toHaveClass('is-match')

    fireEvent.change(searchInput, { target: { value: 'sin-coincidencias' } })
    expect(
      await screen.findByText('Sin empleados que coincidan con la busqueda.'),
    ).toBeInTheDocument()
  })

  it('moves an employee outside after two consecutive granted reads in the same area', async () => {
    vi.mocked(api.listAccessEvents).mockResolvedValue(
      paginated([
        makeFloorEvent({
          id: 'repeat-entry-ana',
          employeeId: EMPLOYEE_ANA.id,
          areaId: AREA_MAIN.id,
          occurredAt: '2026-11-10T12:00:00.000Z',
        }),
        makeFloorEvent({
          id: 'repeat-read-ana',
          employeeId: EMPLOYEE_ANA.id,
          areaId: AREA_MAIN.id,
          occurredAt: '2026-11-10T12:04:00.000Z',
        }),
      ]),
    )

    renderWithAuth(<AreasPage />, makeAuth(['auditor']))

    const exteriorZone = screen.getByTestId('floor-zone-exterior')
    expect(await within(exteriorZone).findByText('Ana Torres')).toBeInTheDocument()
    expect(
      within(screen.getByTestId(`floor-zone-${AREA_MAIN.id}`)).queryByText('Ana Torres'),
    ).not.toBeInTheDocument()
  })
})
