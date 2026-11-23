import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/lib/api'
import { buildAccessEventsPdf, type AccessEventReportRow } from '../src/lib/pdfReport'
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
    expect(screen.getByRole('columnheader', { name: 'Ocurrió (lector)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Recibido (servidor)' })).toBeInTheDocument()
    expect(within(table).getByText('Ana Torres')).toBeInTheDocument()
    expect(
      within(table).getByText('Tarjeta desconocida / sin empleado'),
    ).toBeInTheDocument()
    expect(within(table).getByText('DEADBEEF1234')).toBeInTheDocument()
    expect(within(table).getByText('Tarjeta no registrada')).toBeInTheDocument()
    expect(screen.getByText('2 eventos en total')).toBeInTheDocument()
  })

  it('uses singular grammar when only one event matches (H11)', async () => {
    vi.mocked(api.listAccessEvents).mockResolvedValueOnce(paginated([EVENT_GRANTED]))
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    await screen.findByRole('table')
    expect(screen.getByText('1 evento en total')).toBeInTheDocument()
  })

  it('opens the immutable event detail by clicking a row and keeps technical metadata collapsible', async () => {
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('04A1B2C3D4E5F6').closest('tr')
    if (!row) throw new Error('No se encontro la fila del evento concedido')

    fireEvent.click(row)

    const dialog = await screen.findByRole('dialog', { name: /Detalle del evento/i })
    const summary = within(dialog).getByText('Información técnica y trazabilidad')
    const detailsEl = summary.closest('details')
    expect(detailsEl).not.toBeNull()
    expect(detailsEl).not.toHaveAttribute('open')

    fireEvent.click(summary)
    expect(detailsEl).toHaveAttribute('open')
    expect(await within(dialog).findByText('client-evt-1')).toBeInTheDocument()
    expect(within(dialog).getByText('epoch-3')).toBeInTheDocument()
    expect(within(dialog).getByText('1042')).toBeInTheDocument()
    expect(within(dialog).getByText(/"reader": "PN532"/)).toBeInTheDocument()
    expect(within(dialog).getByText(/"offline": true/)).toBeInTheDocument()
    expect(api.getAccessEvent).toHaveBeenCalledWith('event-1')
  })

  it('applies decision filter immediately and normalized UID filter on search submit', async () => {
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'denied' } })

    await waitFor(() => {
      expect(api.listAccessEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          decision: 'denied',
        }),
      )
    })

    fireEvent.change(screen.getByLabelText('UID de tarjeta'), {
      target: { value: 'deadbeef1234' },
    })
    fireEvent.submit(screen.getByRole('search'))

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

  it('validates the UID, inverted range and future dates before querying the API', async () => {
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    await screen.findByRole('table')
    const callsAfterInitialLoad = vi.mocked(api.listAccessEvents).mock.calls.length

    fireEvent.change(screen.getByLabelText('UID de tarjeta'), {
      target: { value: 'not-a-uid' },
    })
    fireEvent.submit(screen.getByRole('search'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/hexadecimal par de 8 a 32/i)
    expect(api.listAccessEvents).toHaveBeenCalledTimes(callsAfterInitialLoad)

    fireEvent.change(screen.getByLabelText('UID de tarjeta'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2099-01-01T12:00' },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No puedes buscar eventos en fechas futuras.',
    )
    expect(api.listAccessEvents).toHaveBeenCalledTimes(callsAfterInitialLoad)

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-11-10T12:00' },
    })
    await waitFor(() => {
      expect(api.listAccessEvents).toHaveBeenCalledTimes(callsAfterInitialLoad + 1)
    })
    const callsBeforeInverted = vi.mocked(api.listAccessEvents).mock.calls.length

    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-11-09T12:00' },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no puede ser anterior a la fecha de inicio/i,
    )
    expect(api.listAccessEvents).toHaveBeenCalledTimes(callsBeforeInverted)
  })

  it('shows an explicit empty state when the filters match no events', async () => {
    vi.mocked(api.listAccessEvents).mockResolvedValueOnce(paginated([]))
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    expect(await screen.findByText('Sin eventos que coincidan')).toBeInTheDocument()
    expect(
      screen.getByText(/Ajusta los filtros para ampliar el rango de búsqueda/),
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

  it('disables the PDF export button when there are no events', async () => {
    vi.mocked(api.listAccessEvents).mockResolvedValueOnce(paginated([]))
    renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

    expect(await screen.findByText('Sin eventos que coincidan')).toBeInTheDocument()
    const exportButton = screen.getByRole('button', { name: 'Exportar reporte PDF' })
    expect(exportButton).toBeDisabled()
  })

  it('enables PDF export with events, generates a PDF blob and shows a success notice', async () => {
    const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:mock-pdf-report')
    const revokeObjectUrlMock = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    })

    try {
      renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

      await screen.findByRole('table')
      const exportButton = screen.getByRole('button', { name: 'Exportar reporte PDF' })
      expect(exportButton).toBeEnabled()

      vi.useFakeTimers()
      fireEvent.click(exportButton)

      expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
      const generatedBlob = createObjectUrlMock.mock.calls[0]?.[0]
      expect(generatedBlob).toBeInstanceOf(Blob)
      expect((generatedBlob as Blob).type).toBe('application/pdf')
      expect((generatedBlob as Blob).size).toBeGreaterThan(200)

      expect(screen.getByText(/Reporte PDF generado correctamente/)).toBeInTheDocument()

      vi.advanceTimersByTime(1000)
      expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:mock-pdf-report')

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
      expect(screen.queryByText(/Reporte PDF generado correctamente/)).not.toBeInTheDocument()

      vi.useRealTimers()
      const blobBytes = await readBlobBytes(generatedBlob as Blob)
      const blobText = decodeLatin1(blobBytes)
      expect(blobText.startsWith('%PDF-1.4\n')).toBe(true)
      expect(blobText.endsWith('%%EOF')).toBe(true)
      expect(blobText).toContain('Ana Torres')
      expect(blobText).toContain('04A1B2C3D4E5F6')
    } finally {
      vi.useRealTimers()
      clickSpy.mockRestore()
      if (originalCreateObjectUrl) {
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl)
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL')
      }
      if (originalRevokeObjectUrl) {
        Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl)
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL')
      }
    }
  })

  it('includes active applied filters in the exported PDF report', async () => {
    const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
    const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:mock-filtered-pdf')
    const revokeObjectUrlMock = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    })

    try {
      renderWithAuth(<AccessEventsPage />, makeAuth(['auditor']))

      await screen.findByRole('table')
      fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'denied' } })

      await waitFor(() => {
        expect(api.listAccessEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({ decision: 'denied' }),
        )
      })

      fireEvent.click(screen.getByRole('button', { name: 'Exportar reporte PDF' }))

      expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
      const generatedBlob = createObjectUrlMock.mock.calls[0]?.[0] as Blob
      const blobText = decodeLatin1(await readBlobBytes(generatedBlob))
      expect(blobText).toContain('Resultado: Denegado')
    } finally {
      clickSpy.mockRestore()
      if (originalCreateObjectUrl) {
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl)
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL')
      }
      if (originalRevokeObjectUrl) {
        Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl)
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL')
      }
    }
  })
})

function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result))
      } else {
        reject(new Error('No se pudo leer el Blob como ArrayBuffer'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Error leyendo Blob'))
    reader.readAsArrayBuffer(blob)
  })
}

function decodeLatin1(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i] ?? 0)
  }
  return out
}

describe('buildAccessEventsPdf', () => {
  it('builds a valid PDF 1.4 structure with accurate xref offsets and report text', () => {
    const rows: AccessEventReportRow[] = [
      {
        decisionLabel: 'Concedido',
        employeeLabel: 'Ana Torres (EMP-001)',
        cardUid: '04A1B2C3D4E5F6',
        areaLabel: 'Acceso Principal (MAIN_ENTRANCE)',
        deviceLabel: 'Lector Entrada Principal (ESP32-QA-01)',
        reasonLabel: 'Acceso autorizado',
        occurredAtLabel: '10 nov 2026, 12:00:00',
        receivedAtLabel: '10 nov 2026, 12:00:02',
      },
      {
        decisionLabel: 'Denegado',
        employeeLabel: 'Tarjeta desconocida / sin empleado',
        cardUid: 'DEADBEEF1234',
        areaLabel: 'Laboratorio de Redes (NETWORK_LAB)',
        deviceLabel: 'Lector Entrada Principal (ESP32-QA-01)',
        reasonLabel: 'Tarjeta no registrada',
        occurredAtLabel: '10 nov 2026, 12:05:00',
        receivedAtLabel: '10 nov 2026, 12:05:01',
      },
    ]

    const pdfBytes = buildAccessEventsPdf({
      generatedAtLabel: '17 nov 2026, 21:00:00',
      totalInQuery: 2,
      filterSummary: ['Sin filtros aplicados (vista general)'],
      rows,
    })

    const raw = decodeLatin1(pdfBytes)
    expect(raw.startsWith('%PDF-1.4\n')).toBe(true)
    expect(raw.endsWith('%%EOF')).toBe(true)
    expect(raw).toContain('/Type /Catalog')
    expect(raw).toContain('/Type /Pages')
    expect(raw).toContain('/Type /Page')
    expect(raw).toContain('/Encoding /WinAnsiEncoding')
    expect(raw).toContain('0.118 0.078 0.153 rg')
    expect(raw).toContain('Accesa - Reporte de Bitácora de Accesos')
    expect(raw).toContain('Ana Torres')
    expect(raw).toContain('04A1B2C3D4E5F6')
    expect(raw).toContain('Página 1 de 1')

    // Validate xref offsets against exact byte positions
    const startxrefMatch = raw.match(/startxref\n(\d+)\n%%EOF$/)
    expect(startxrefMatch).not.toBeNull()
    const xrefStart = Number(startxrefMatch?.[1])
    expect(raw.slice(xrefStart, xrefStart + 5)).toBe('xref\n')

    const xrefSection = raw.slice(xrefStart, raw.indexOf('\ntrailer\n'))
    const xrefLines = xrefSection.split('\n')
    expect(xrefLines[2]).toBe('0000000000 65535 f ')

    const entryLines = xrefLines.slice(3)
    expect(entryLines.length).toBeGreaterThanOrEqual(7)
    entryLines.forEach((line, idx) => {
      const match = line.match(/^(\d{10}) 00000 n $/)
      expect(match).not.toBeNull()
      const offset = Number(match?.[1])
      const objId = idx + 1
      expect(raw.startsWith(`${objId} 0 obj\n`, offset)).toBe(true)
    })
  })

  it('encodes WinAnsi characters, escapes PDF literals and paginates multi-page reports', () => {
    const sampleRows: AccessEventReportRow[] = Array.from({ length: 24 }, (_, idx) => ({
      decisionLabel: idx % 2 === 0 ? 'Concedido' : 'Denegado',
      employeeLabel:
        idx === 0
          ? 'Raúl Núñez (Planta\\Norte) 🚀'
          : `Empleado Prueba ${idx + 1} (EMP-${String(idx + 1).padStart(3, '0')})`,
      cardUid: `04A1B2C3D4E5${String(idx).padStart(2, '0')}`,
      areaLabel: 'Área Crítica Ñandú Ü',
      deviceLabel: 'Controlador Principal (ESP32-S3)',
      reasonLabel: idx % 2 === 0 ? 'Acceso autorizado' : 'Sin permiso para esta area',
      occurredAtLabel: '10 nov 2026, 12:00:00',
      receivedAtLabel: '10 nov 2026, 12:00:02',
    }))

    const pdfBytes = buildAccessEventsPdf({
      generatedAtLabel: '17 nov 2026, 21:15:00',
      totalInQuery: 24,
      filterSummary: ['Resultado: Concedido', 'Area: Laboratorio'],
      rows: sampleRows,
    })

    const raw = decodeLatin1(pdfBytes)
    expect(raw).toContain('Ra\xFAl N\xFA\xF1ez \\(Planta\\\\Norte\\) ?')
    expect(raw).toContain('\xC1rea Cr\xEDtica \xD1and\xFA \xDC')
    expect(raw).toContain('Página 1 de 2')
    expect(raw).toContain('Página 2 de 2')
  })
})
