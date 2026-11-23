import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccessEventDto } from '@scaccess/shared'
import { api } from '../src/lib/api'
import { AreasPage } from '../src/pages/AreasPage'
import {
  AREA_LAB,
  AREA_MAIN,
  AREAS,
  CREDENTIAL_ACTIVE,
  EMPLOYEE_ANA,
  EMPLOYEE_LUIS,
  EMPLOYEES,
  EVENT_GRANTED,
  PERMISSION_ACTIVE,
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
    listAccessPermissions: vi.fn(),
    listCredentials: vi.fn(),
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
    vi.mocked(api.listAccessPermissions).mockResolvedValue(paginated([PERMISSION_ACTIVE], 1, 200))
    vi.mocked(api.listCredentials).mockResolvedValue(paginated([CREDENTIAL_ACTIVE], 1, 200))
  })

  it('shows the catalog in read-only mode for auditors', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['auditor']))

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Acceso Principal')).toBeInTheDocument()
    expect(within(table).getByText('MAIN_ENTRANCE')).toBeInTheDocument()
    expect(within(table).getAllByText('America/Tijuana')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Nueva área' })).not.toBeInTheDocument()
    expect(
      screen.getByText(/solo un administrador puede crear o modificar áreas/i),
    ).toBeInTheDocument()
  })

  it('creates an area from the admin modal and rejects numeric-only names/codes (H4)', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva área' }))

    const dialog = screen.getByRole('dialog', { name: 'Nueva área' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    fireEvent.change(within(dialog).getByLabelText('Código del área'), {
      target: { value: '12345' },
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre del área'), {
      target: { value: 'Laboratorio Norte' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar área' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/letras/i)
    expect(api.createArea).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText('Código del área'), {
      target: { value: 'lab_north' },
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre del área'), {
      target: { value: 'Laboratorio Norte' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descripción'), {
      target: { value: 'Zona restringida de investigación' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar área' }))

    await waitFor(() => {
      expect(api.createArea).toHaveBeenCalledWith({
        code: 'LAB_NORTH',
        name: 'Laboratorio Norte',
        description: 'Zona restringida de investigación',
        timezone: 'America/Tijuana',
        isActive: true,
      })
    })
    expect(await screen.findByText('Área creada correctamente.')).toBeInTheDocument()
  })

  it('rejects an invalid IANA timezone before calling the API', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva área' }))

    const dialog = screen.getByRole('dialog', { name: 'Nueva área' })
    fireEvent.change(within(dialog).getByLabelText('Código del área'), {
      target: { value: 'QA_ZONE' },
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre del área'), {
      target: { value: 'Zona QA' },
    })
    fireEvent.change(within(dialog).getByLabelText('Zona horaria'), {
      target: { value: 'Not/AZone' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar área' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /La zona horaria no es válida/i,
    )
    expect(api.createArea).not.toHaveBeenCalled()
  })

  it('edits an area and can deactivate it', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('Acceso Principal').closest('tr')
    if (!row) throw new Error('No se encontro la fila del area principal')

    fireEvent.click(within(row).getByRole('button', { name: 'Editar área Acceso Principal' }))

    const dialog = screen.getByRole('dialog', { name: 'Editar área' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('Nombre del área'), {
      target: { value: 'Acceso Principal Norte' },
    })
    fireEvent.click(within(dialog).getByLabelText('Área activa y disponible para permisos'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar área' }))

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
    expect(await screen.findByText('Área actualizada correctamente.')).toBeInTheDocument()
  })

  it('shows an actionable empty state for administrators', async () => {
    vi.mocked(api.listAreas).mockResolvedValue(paginated([]))
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    expect(await screen.findByText('Sin áreas registradas')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Crear área' })).toBeInTheDocument()
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

  it('sections catalog, live floor plan, and simulator into separate tabs', async () => {
    renderWithAuth(<AreasPage />, makeAuth(['admin']))

    const catalogTab = screen.getByRole('tab', { name: /Catálogo de áreas/i })
    const floorPlanTab = screen.getByRole('tab', { name: /Croquis en vivo/i })
    const simulatorTab = screen.getByRole('tab', { name: /Simulador de accesos/i })

    expect(catalogTab).toHaveAttribute('aria-selected', 'true')
    expect(floorPlanTab).toHaveAttribute('aria-selected', 'false')
    expect(simulatorTab).toHaveAttribute('aria-selected', 'false')
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Croquis de las áreas/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Empleado a mover')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
    ).not.toBeInTheDocument()

    fireEvent.click(floorPlanTab)

    expect(floorPlanTab).toHaveAttribute('aria-selected', 'true')
    expect(catalogTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: /Croquis de las áreas/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar empleado en el croquis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualizar eventos' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Empleado a mover')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Movimiento')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Área de destino')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Simular ronda de accesos' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Restablecer con datos del servidor' }),
    ).not.toBeInTheDocument()

    fireEvent.click(simulatorTab)

    expect(simulatorTab).toHaveAttribute('aria-selected', 'true')
    expect(floorPlanTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: /Croquis de las áreas/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Empleado a mover')).toBeInTheDocument()
    expect(screen.getByLabelText('Movimiento')).toBeInTheDocument()
    expect(screen.getByLabelText('Área de destino')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular ronda de accesos' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Restablecer con datos del servidor' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualizar eventos' })).toBeInTheDocument()

    fireEvent.click(catalogTab)

    expect(catalogTab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Croquis de las áreas/i })).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('tab', { name: /Croquis en vivo/i }))

    const floorPlan = await screen.findByRole('region', { name: /Croquis de las áreas/i })
    expect(
      within(floorPlan).getByRole('heading', {
        name: 'Croquis de las áreas y ubicación en tiempo real (Simulación)',
      }),
    ).toBeInTheDocument()
    expect(await within(floorPlan).findByText('MAIN_ENTRANCE')).toBeInTheDocument()
    expect(within(floorPlan).getByText('NETWORK_LAB')).toBeInTheDocument()

    const mainZone = screen.getByTestId(`floor-zone-${AREA_MAIN.id}`)
    expect(await within(mainZone).findByText('Ana Torres')).toBeInTheDocument()
    expect(within(mainZone).getByText(/EMP-001/)).toBeInTheDocument()
    expect(within(mainZone).getByText('1 persona en zona')).toBeInTheDocument()

    const labZone = screen.getByTestId(`floor-zone-${AREA_LAB.id}`)
    expect(within(labZone).queryByText('Luis Ramos')).not.toBeInTheDocument()

    const exteriorZone = screen.getByTestId('floor-zone-exterior')
    expect(within(exteriorZone).getByText('Exterior / Salida registrada')).toBeInTheDocument()
    expect(within(exteriorZone).getByText('Fuera de instalaciones / En tránsito')).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('tab', { name: /Croquis en vivo/i }))

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

    const floorPlan = screen.getByRole('region', { name: /Croquis de las áreas/i })
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

    fireEvent.click(screen.getByRole('tab', { name: /Simulador de accesos/i }))

    const mainZone = await screen.findByTestId(`floor-zone-${AREA_MAIN.id}`)
    const employeeSelect = await screen.findByLabelText('Empleado a mover')

    await waitFor(() => {
      expect(within(employeeSelect).getByRole('option', { name: /Ana Torres/ })).toBeInTheDocument()
    })

    fireEvent.change(employeeSelect, { target: { value: EMPLOYEE_ANA.id } })
    fireEvent.change(screen.getByLabelText('Movimiento'), { target: { value: 'entry' } })
    fireEvent.change(screen.getByLabelText('Área de destino'), {
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

    fireEvent.click(screen.getByRole('tab', { name: /Croquis en vivo/i }))

    const mainZone = await screen.findByTestId(`floor-zone-${AREA_MAIN.id}`)
    await within(mainZone).findByText('Ana Torres')

    const searchInput = screen.getByLabelText('Buscar empleado en el croquis')
    fireEvent.change(searchInput, { target: { value: 'Ana' } })

    expect(
      await screen.findByText('Ubicación: Ana Torres: Acceso Principal'),
    ).toBeInTheDocument()
    expect(mainZone).toHaveClass('is-match')
    expect(screen.getByTestId('floor-zone-exterior')).not.toHaveClass('is-match')

    fireEvent.change(searchInput, { target: { value: 'sin-coincidencias' } })
    expect(
      await screen.findByText('Sin empleados que coincidan con la búsqueda.'),
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

    fireEvent.click(screen.getByRole('tab', { name: /Croquis en vivo/i }))

    const exteriorZone = await screen.findByTestId('floor-zone-exterior')
    expect(await within(exteriorZone).findByText('Ana Torres')).toBeInTheDocument()
    const mainZone = await screen.findByTestId(`floor-zone-${AREA_MAIN.id}`)
    expect(within(mainZone).queryByText('Ana Torres')).not.toBeInTheDocument()
  })

  it('excludes inactive employees from simulator by default and enforces permission, credential and capacity rules (H1, H2, H5)', async () => {
    const serverRoom = {
      ...AREA_LAB,
      id: 'area-srv',
      code: 'SERVER_ROOM',
      name: 'Cuarto de Servidores',
      isActive: true,
    }
    const extraEmployees = [
      EMPLOYEE_ANA,
      { ...EMPLOYEE_LUIS, id: 'emp-2', status: 'suspended' as const },
      { ...EMPLOYEE_ANA, id: 'emp-3', employeeCode: 'EMP-003', firstName: 'Carlos', lastName: 'Ruiz' },
      { ...EMPLOYEE_ANA, id: 'emp-4', employeeCode: 'EMP-004', firstName: 'Elena', lastName: 'Diaz' },
      { ...EMPLOYEE_ANA, id: 'emp-5', employeeCode: 'EMP-005', firstName: 'Marco', lastName: 'Solis' },
    ]
    const allAreas = [AREA_MAIN, serverRoom]

    vi.mocked(api.listAreas).mockResolvedValue(paginated(allAreas))
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(extraEmployees))
    vi.mocked(api.listCredentials).mockResolvedValue(
      paginated(
        ['emp-1', 'emp-3', 'emp-4', 'emp-5'].map((employeeId, idx) => ({
          ...CREDENTIAL_ACTIVE,
          id: `cred-${idx + 1}`,
          employeeId,
          cardUid: `04A1B2C3D4000${idx + 1}`,
        })),
        1,
        200,
      ),
    )
    vi.mocked(api.listAccessPermissions).mockResolvedValue(
      paginated(
        ['emp-3', 'emp-4', 'emp-5'].map((employeeId, idx) => ({
          ...PERMISSION_ACTIVE,
          id: `perm-${idx + 1}`,
          employeeId,
          areaId: serverRoom.id,
          validFrom: null,
          validTo: null,
          revokedAt: null,
        })),
        1,
        200,
      ),
    )

    renderWithAuth(<AreasPage />, makeAuth(['admin']))
    fireEvent.click(screen.getByRole('tab', { name: /Simulador de accesos/i }))

    const employeeSelect = await screen.findByLabelText('Empleado a mover')
    await waitFor(() => {
      expect(within(employeeSelect).getByRole('option', { name: /Ana Torres/ })).toBeInTheDocument()
    })
    // H5: suspended Luis Ramos is hidden unless checkbox is enabled
    expect(within(employeeSelect).queryByRole('option', { name: /Luis Ramos/ })).not.toBeInTheDocument()

    // H1: Ana lacks permission in SERVER_ROOM -> denied
    fireEvent.change(employeeSelect, { target: { value: 'emp-1' } })
    fireEvent.change(screen.getByLabelText('Movimiento'), { target: { value: 'entry' } })
    fireEvent.change(screen.getByLabelText('Área de destino'), { target: { value: serverRoom.id } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
    )
    expect(
      await screen.findByText(/Acceso denegado: Ana Torres no tiene permiso asignado para Cuarto de Servidores/),
    ).toBeInTheDocument()

    // H1: Including suspended employee -> denied due to employee status
    fireEvent.click(
      screen.getByLabelText('Incluir inactivos/suspendidos (para probar rechazos)'),
    )
    expect(within(employeeSelect).getByRole('option', { name: /Luis Ramos/ })).toBeInTheDocument()
    fireEvent.change(employeeSelect, { target: { value: 'emp-2' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
    )
    expect(
      await screen.findByText(/Acceso denegado: Luis Ramos tiene estado suspendido/),
    ).toBeInTheDocument()

    // H2: Fill SERVER_ROOM (capacity 3) and block 4th entry (Marco -> actually Ana lacks perm, use emp-5 after emp-1/emp-3/emp-4)
    vi.mocked(api.listAccessPermissions).mockResolvedValueOnce(
      paginated(
        ['emp-1', 'emp-3', 'emp-4', 'emp-5'].map((employeeId, idx) => ({
          ...PERMISSION_ACTIVE,
          id: `perm-all-${idx + 1}`,
          employeeId,
          areaId: serverRoom.id,
          validFrom: null,
          validTo: null,
          revokedAt: null,
        })),
        1,
        200,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar eventos' }))
    await waitFor(() => {
      expect(api.listAccessPermissions).toHaveBeenCalledTimes(2)
    })

    for (const employeeId of ['emp-1', 'emp-3', 'emp-4']) {
      fireEvent.change(employeeSelect, { target: { value: employeeId } })
      fireEvent.change(screen.getByLabelText('Movimiento'), { target: { value: 'entry' } })
      fireEvent.change(screen.getByLabelText('Área de destino'), {
        target: { value: serverRoom.id },
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
      )
    }

    const serverZone = screen.getByTestId(`floor-zone-${serverRoom.id}`)
    expect(within(serverZone).getByText('3 personas en zona')).toBeInTheDocument()
    expect(within(serverZone).getByText(/Aforo completo/)).toBeInTheDocument()

    fireEvent.change(employeeSelect, { target: { value: 'emp-5' } })
    fireEvent.change(screen.getByLabelText('Movimiento'), { target: { value: 'entry' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Simular movimiento (Entrada / Salida)' }),
    )
    expect(
      await screen.findByText(/Capacidad máxima alcanzada en Cuarto de Servidores \(3\/3 personas\)/),
    ).toBeInTheDocument()
    expect(within(serverZone).queryByText('Marco Solis')).not.toBeInTheDocument()
  })
})
