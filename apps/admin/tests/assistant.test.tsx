import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../src/components/layout/AppShell'
import { AuthContext } from '../src/context/AuthContext'
import { ThemeProvider } from '../src/context/ThemeContext'
import { api } from '../src/lib/api'
import { getContextualSuggestions } from '../src/lib/assistant/knowledgeBase'
import {
  explainAccessEvent,
  extractJsonFromText,
  interpretMetadataObject,
} from '../src/lib/assistant/metadataInterpreter'
import { resolveWebPermissions } from '../src/lib/permissions'
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

vi.mock('../src/lib/api', () => ({
  api: {
    getHealth: vi.fn(),
    listAccessEvents: vi.fn(),
    getAccessEvent: vi.fn(),
    listEmployees: vi.fn(),
    listAreas: vi.fn(),
    listAccessDevices: vi.fn(),
  },
}))

function renderShellRoute(initialPath: string, roles: string[]) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={makeAuth(roles)}>
        <ThemeProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<h1>Panel</h1>} />
              <Route path="access-events" element={<AccessEventsPage />} />
              <Route path="areas" element={<h1>Áreas</h1>} />
              <Route path="users" element={<h1>Cuentas</h1>} />
            </Route>
          </Routes>
        </ThemeProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('metadataInterpreter', () => {
  it('classifies RSSI signal bands and interprets offline, direction and custom keys', () => {
    const items = interpretMetadataObject({
      rssi: -48,
      offline: true,
      direction: 'in',
      doorSensorState: 'closed',
      retry_count: 2,
    })

    expect(items).toEqual([
      expect.objectContaining({
        key: 'rssi',
        label: 'Señal Wi-Fi (RSSI)',
        value: '-48 dBm (Excelente)',
        tone: 'success',
      }),
      expect.objectContaining({
        key: 'offline',
        label: 'Modo sin conexión',
        value: 'Sí (validación offline)',
        tone: 'warning',
      }),
      expect.objectContaining({
        key: 'direction',
        label: 'Sentido del movimiento',
        value: 'Entrada',
        tone: 'success',
      }),
      expect.objectContaining({
        key: 'doorSensorState',
        label: 'Door sensor state',
        value: 'closed',
      }),
      expect.objectContaining({
        key: 'retry_count',
        label: 'Retry count',
        value: '2',
      }),
    ])

    expect(interpretMetadataObject({ rssi: -64 })[0]?.value).toBe('-64 dBm (Buena)')
    expect(interpretMetadataObject({ rssi: -79 })[0]?.value).toBe('-79 dBm (Regular)')
    expect(interpretMetadataObject({ rssi: -92 })[0]).toMatchObject({
      value: '-92 dBm (Débil)',
      tone: 'danger',
    })
    expect(interpretMetadataObject({ offline: false, action: 'exit' })).toEqual([
      expect.objectContaining({ value: 'No (en línea)', tone: 'success' }),
      expect.objectContaining({ value: 'Salida', tone: 'neutral' }),
    ])
  })

  it('extracts inline JSON metadata from mixed user messages', () => {
    const extracted = extractJsonFromText(
      'Por favor revisa este payload: {"reader":"PN532","rssi":-75,"offline":false} gracias',
    )
    expect(extracted).toEqual({
      reader: 'PN532',
      rssi: -75,
      offline: false,
    })

    expect(extractJsonFromText('Texto normal sin objetos')).toBeNull()
    expect(extractJsonFromText('Solo un arreglo [1, 2, 3]')).toBeNull()
  })

  it('builds a plain-Spanish operational explanation for an access event', () => {
    const explanation = explainAccessEvent({
      id: 'event-1',
      decision: 'denied',
      reasonCode: 'permission_outside_schedule',
      cardUid: '04A1B2C3D4E5F6',
      employeeLabel: 'Ana Torres (EMP-001)',
      areaLabel: 'Laboratorio de Redes (NETWORK_LAB)',
      deviceLabel: 'Lector Entrada Principal (ESP32-QA-01)',
      occurredAt: '2026-11-10T12:00:00.000Z',
      receivedAt: '2026-11-10T12:03:00.000Z',
      clientEventId: 'client-evt-1',
      deviceEpoch: 'epoch-3',
      deviceSequence: '1042',
      metadata: { reader: 'PN532', rssi: -62, offline: true },
    })

    expect(explanation.content).toContain('Denegado — Fuera de horario permitido')
    expect(explanation.content).toContain('3 min en sincronizarse')
    expect(explanation.content).toContain('clientEventId (client-evt-1)')
    expect(explanation.content).toContain('deviceEpoch (epoch-3)')
    expect(explanation.content).toContain('deviceSequence (1042)')
    expect(explanation.metadataItems).toHaveLength(3)
    expect(explanation.metadataItems[0]?.label).toBe('Lector RFID')
    expect(explanation.metadataItems[1]?.value).toBe('-62 dBm (Buena)')
  })
})

describe('AssistantWidget inside AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getHealth).mockResolvedValue({
      status: 'ok',
      service: 'scaccess-api',
      timestamp: '2026-11-10T12:00:00.000Z',
      uptimeSeconds: 120,
    })
    vi.mocked(api.listAccessEvents).mockResolvedValue(paginated(EVENTS))
    vi.mocked(api.getAccessEvent).mockResolvedValue(EVENT_GRANTED)
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES, 1, 100))
    vi.mocked(api.listAreas).mockResolvedValue(paginated(AREAS, 1, 100))
    vi.mocked(api.listAccessDevices).mockResolvedValue(paginated(DEVICES, 1, 100))
  })

  it('toggles open/closed and closes when Escape is pressed', async () => {
    renderShellRoute('/', ['admin'])

    const fab = screen.getByRole('button', { name: 'Abrir asistente de Accesa' })
    expect(fab).toHaveAttribute('aria-expanded', 'false')
    expect(fab).toHaveAttribute('aria-controls', 'accesa-assistant-panel')

    fireEvent.click(fab)
    const dialog = await screen.findByRole('dialog', { name: 'Asistente operativo Accesa' })
    expect(dialog).toBeInTheDocument()
    expect(fab).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Asistente operativo Accesa' }),
      ).not.toBeInTheDocument()
    })
    expect(fab).toHaveAttribute('aria-expanded', 'false')
  })

  it('adapts contextual suggestions by RBAC so viewer never sees admin or catalog prompts', async () => {
    const viewerSuggestions = getContextualSuggestions('/', resolveWebPermissions(['viewer']))
    expect(viewerSuggestions.some((s) => /\b(cuenta|cuentas|rol|roles|usuario|usuarios)\b/i.test(s))).toBe(
      false,
    )
    expect(viewerSuggestions.some((s) => /simulador|empleados|tarjetas|controladores/i.test(s))).toBe(
      false,
    )

    const operatorSuggestions = getContextualSuggestions('/', resolveWebPermissions(['operator']))
    expect(operatorSuggestions.some((s) => /\b(cuenta|cuentas|rol|roles)\b/i.test(s))).toBe(false)

    renderShellRoute('/', ['viewer'])
    fireEvent.click(screen.getByRole('button', { name: 'Abrir asistente de Accesa' }))

    const dialog = await screen.findByRole('dialog', { name: 'Asistente operativo Accesa' })
    expect(within(dialog).getByText(/Perfil Monitor/)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: '¿Qué puede consultar el perfil Monitor?' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: /rol en la consola/i }),
    ).not.toBeInTheDocument()
  })

  it('answers operational questions, parses pasted JSON metadata and clears conversation', async () => {
    renderShellRoute('/access-events', ['auditor'])

    fireEvent.click(screen.getByRole('button', { name: 'Abrir asistente de Accesa' }))
    const dialog = await screen.findByRole('dialog', { name: 'Asistente operativo Accesa' })

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: '¿Cuál es la diferencia entre Ocurrió (lector) y Recibido (servidor)?',
      }),
    )

    expect(await within(dialog).findByText(/clientEventId/i)).toBeInTheDocument()

    const input = within(dialog).getByLabelText('Escribe tu consulta o pega metadatos JSON')
    fireEvent.change(input, {
      target: { value: '{"reader":"PN532","rssi":-88,"offline":true,"customFlag":1}' },
    })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    expect(await within(dialog).findByText('-88 dBm (Débil)')).toBeInTheDocument()
    expect(within(dialog).getByText('Sí (validación offline)')).toBeInTheDocument()
    expect(within(dialog).getByText('Custom flag')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Limpiar conversación' }))
    expect(
      await within(dialog).findByRole('group', { name: 'Consultas sugeridas' }),
    ).toBeInTheDocument()
  })

  it('opens the assistant with translated metadata from AccessEventsPage EventDetailModal', async () => {
    renderShellRoute('/access-events', ['auditor'])

    const table = await screen.findByRole('table')
    const row = within(table).getByText('04A1B2C3D4E5F6').closest('tr')
    if (!row) throw new Error('No se encontró la fila del evento concedido')

    fireEvent.click(row)

    const eventModal = await screen.findByRole('dialog', { name: /Detalle del evento/i })
    const explainBtn = await within(eventModal).findByRole('button', {
      name: 'Explicar metadatos con el asistente',
    })
    fireEvent.click(explainBtn)

    const assistantDialog = await screen.findByRole('dialog', {
      name: 'Asistente operativo Accesa',
    })
    expect(
      within(assistantDialog).getByText('Resultado: Concedido — Acceso autorizado.'),
    ).toBeInTheDocument()
    expect(within(assistantDialog).getByText('Lector RFID')).toBeInTheDocument()
    expect(within(assistantDialog).getByText('PN532')).toBeInTheDocument()
    expect(within(assistantDialog).getByText('-62 dBm (Buena)')).toBeInTheDocument()
    expect(within(assistantDialog).getByText('Sí (validación offline)')).toBeInTheDocument()
  })

  it('renders AccessEventsPage safely outside AppShell without AssistantProvider', async () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={makeAuth(['auditor'])}>
          <AccessEventsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    const table = await screen.findByRole('table')
    const row = within(table).getByText('04A1B2C3D4E5F6').closest('tr')
    if (!row) throw new Error('No se encontró la fila del evento concedido')
    fireEvent.click(row)

    const eventModal = await screen.findByRole('dialog', { name: /Detalle del evento/i })
    expect(
      within(eventModal).queryByRole('button', { name: 'Explicar metadatos con el asistente' }),
    ).not.toBeInTheDocument()
  })
})
