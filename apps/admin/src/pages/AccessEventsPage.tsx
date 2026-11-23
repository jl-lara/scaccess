import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CheckCircle2, ChevronDown, Eye, FileDown, RefreshCw, XCircle } from 'lucide-react'
import type {
  AccessDecision,
  AccessDeviceDto,
  AccessEventDto,
  AccessReason,
  AreaDto,
  EmployeeDto,
  PaginationMeta,
} from '@scaccess/shared'
import { Modal } from '../components/ui/Modal'
import { NoticeBanner } from '../components/ui/NoticeBanner'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT, TableMessage } from '../components/ui/TableMessage'
import { api } from '../lib/api'
import {
  DECISION_LABELS,
  REASON_LABELS,
  formatCount,
  formatDateTimeWithSeconds,
} from '../lib/formatters'
import { downloadAccessEventsPdf, type AccessEventReportRow } from '../lib/pdfReport'
import { usePermissions } from '../lib/permissions'
import {
  formatMetadata,
  getErrorMessage,
  isValidCardUid,
  normalizeCardUid,
  toIsoDateTime,
  toLocalDateTimeInputValue,
} from '../lib/validation'

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const REASON_CODES: AccessReason[] = [
  'allowed',
  'card_unknown',
  'card_blocked',
  'card_lost',
  'card_retired',
  'employee_inactive',
  'permission_missing',
  'permission_expired',
  'permission_outside_schedule',
  'area_not_allowed',
  'area_inactive',
  'device_error',
]
const DECISIONS: AccessDecision[] = ['granted', 'denied']

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
}

interface EventFilters {
  decision: AccessDecision | ''
  reasonCode: AccessReason | ''
  areaId: string
  deviceId: string
  employeeId: string
  cardUid: string
  from: string
  to: string
}

const EMPTY_FILTERS: EventFilters = {
  decision: '',
  reasonCode: '',
  areaId: '',
  deviceId: '',
  employeeId: '',
  cardUid: '',
  from: '',
  to: '',
}

function getReceivedLagSeconds(occurredAt: string, receivedAt: string): number | null {
  const occurred = new Date(occurredAt).getTime()
  const received = new Date(receivedAt).getTime()
  if (!Number.isFinite(occurred) || !Number.isFinite(received)) {
    return null
  }
  return Math.round((received - occurred) / 1000)
}

function formatReceivedLag(occurredAt: string, receivedAt: string): string {
  const seconds = getReceivedLagSeconds(occurredAt, receivedAt)
  if (seconds === null) {
    return 'Sin cálculo'
  }
  if (seconds === 0) {
    return 'Sin diferencia'
  }
  const direction = seconds > 0 ? 'después' : 'antes'
  const absolute = Math.abs(seconds)
  if (absolute < 60) {
    return `${absolute} s ${direction}`
  }
  const minutes = Math.round(absolute / 60)
  if (minutes < 60) {
    return `${minutes} min ${direction}`
  }
  return `${Math.round(minutes / 60)} h ${direction}`
}

function formatReceivedLagShort(occurredAt: string, receivedAt: string): string | null {
  const seconds = getReceivedLagSeconds(occurredAt, receivedAt)
  if (seconds === null || seconds === 0) {
    return null
  }
  const absolute = Math.abs(seconds)
  const sign = seconds > 0 ? '+' : '-'
  if (absolute < 60) {
    return `${sign}${absolute} s`
  }
  const minutes = Math.round(absolute / 60)
  if (minutes < 60) {
    return `${sign}${minutes} min`
  }
  return `${sign}${Math.round(minutes / 60)} h`
}

function validateEventFilters(candidate: EventFilters): { error: string | null; normalizedUid: string } {
  const normalizedUid = normalizeCardUid(candidate.cardUid)
  if (normalizedUid && !isValidCardUid(normalizedUid)) {
    return {
      error: 'El UID debe ser hexadecimal par de 8 a 32 caracteres.',
      normalizedUid,
    }
  }

  const nowMs = Date.now() + 60_000
  const fromIso = toIsoDateTime(candidate.from)
  const toIso = toIsoDateTime(candidate.to)

  if (fromIso && new Date(fromIso).getTime() > nowMs) {
    return {
      error: 'No puedes buscar eventos en fechas futuras.',
      normalizedUid,
    }
  }

  if (toIso && new Date(toIso).getTime() > nowMs) {
    return {
      error: 'No puedes buscar eventos en fechas futuras.',
      normalizedUid,
    }
  }

  if (fromIso && toIso && new Date(toIso).getTime() < new Date(fromIso).getTime()) {
    return {
      error: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
      normalizedUid,
    }
  }

  return { error: null, normalizedUid }
}

export function AccessEventsPage() {
  const { canViewCatalogs, canExportReports } = usePermissions()
  const [events, setEvents] = useState<AccessEventDto[]>([])
  const [employees, setEmployees] = useState<EmployeeDto[]>([])
  const [areas, setAreas] = useState<AreaDto[]>([])
  const [devices, setDevices] = useState<AccessDeviceDto[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [draftFilters, setDraftFilters] = useState<EventFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<EventFilters>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [supportError, setSupportError] = useState<string | null>(null)
  const [supportReloadKey, setSupportReloadKey] = useState(0)
  const [detailTarget, setDetailTarget] = useState<AccessEventDto | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const maxDateTimeLocal = toLocalDateTimeInputValue()

  useEffect(() => {
    let active = true

    async function loadSupportCatalogs() {
      try {
        const [employeeResponse, areaResponse, deviceResponse] = await Promise.all([
          canViewCatalogs
            ? api.listEmployees({ page: 1, pageSize: 100 })
            : Promise.resolve({ data: [] as EmployeeDto[] }),
          api.listAreas({ page: 1, pageSize: 100 }),
          canViewCatalogs
            ? api.listAccessDevices({ page: 1, pageSize: 100 })
            : Promise.resolve({ data: [] as AccessDeviceDto[] }),
        ])
        if (active) {
          setEmployees(employeeResponse.data)
          setAreas(areaResponse.data)
          setDevices(deviceResponse.data)
        }
      } catch (err) {
        if (active) {
          setSupportError(
            getErrorMessage(
              err,
              'No se pudieron cargar los catálogos auxiliares. Los filtros mostrarán identificadores.',
            ),
          )
        }
      }
    }

    void loadSupportCatalogs()

    return () => {
      active = false
    }
  }, [supportReloadKey, canViewCatalogs])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listAccessEvents({
        page,
        pageSize,
        decision: appliedFilters.decision || undefined,
        reasonCode: appliedFilters.reasonCode || undefined,
        areaId: appliedFilters.areaId || undefined,
        deviceId: canViewCatalogs ? appliedFilters.deviceId || undefined : undefined,
        employeeId: canViewCatalogs ? appliedFilters.employeeId || undefined : undefined,
        cardUid: appliedFilters.cardUid || undefined,
        from: toIsoDateTime(appliedFilters.from) ?? undefined,
        to: toIsoDateTime(appliedFilters.to) ?? undefined,
      })
      setEvents(response.data)
      setPagination(response.pagination)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo consultar la bitácora de accesos.'))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, appliedFilters, canViewCatalogs])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  // Debounce free-text UID filter while keeping instant feedback for selects and valid dates.
  useEffect(() => {
    const normalizedDraftUid = normalizeCardUid(draftFilters.cardUid)
    if (normalizedDraftUid === appliedFilters.cardUid) {
      return
    }
    const timer = setTimeout(() => {
      const validation = validateEventFilters(draftFilters)
      if (validation.error) {
        setFilterError(validation.error)
        return
      }
      setFilterError(null)
      setPage(1)
      setAppliedFilters({ ...draftFilters, cardUid: validation.normalizedUid })
    }, 350)

    return () => clearTimeout(timer)
  }, [draftFilters, appliedFilters.cardUid])

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  )
  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas])
  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices])

  function applyInstantFilter<K extends keyof EventFilters>(field: K, value: EventFilters[K]) {
    const nextFilters = { ...draftFilters, [field]: value }
    setDraftFilters(nextFilters)

    const validation = validateEventFilters(nextFilters)
    if (validation.error) {
      setFilterError(validation.error)
      return
    }

    setFilterError(null)
    setPage(1)
    setAppliedFilters({ ...nextFilters, cardUid: validation.normalizedUid })
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateEventFilters(draftFilters)
    if (validation.error) {
      setFilterError(validation.error)
      return
    }

    setFilterError(null)
    setPage(1)
    setAppliedFilters({ ...draftFilters, cardUid: validation.normalizedUid })
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setFilterError(null)
    setPage(1)
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, target: AccessEventDto) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setDetailTarget(target)
    }
  }

  function handleExportPdf() {
    if (events.length === 0) {
      return
    }

    setExportNotice(null)
    setExportError(null)

    try {
      const filterSummary: string[] = []
      if (appliedFilters.decision) {
        filterSummary.push(`Resultado: ${DECISION_LABELS[appliedFilters.decision]}`)
      }
      if (appliedFilters.reasonCode) {
        filterSummary.push(
          `Motivo: ${REASON_LABELS[appliedFilters.reasonCode] ?? appliedFilters.reasonCode}`,
        )
      }
      if (appliedFilters.areaId) {
        const area = areaById.get(appliedFilters.areaId)
        filterSummary.push(
          `Área: ${area ? `${area.name} (${area.code})` : appliedFilters.areaId}`,
        )
      }
      if (appliedFilters.deviceId) {
        const device = deviceById.get(appliedFilters.deviceId)
        filterSummary.push(
          `Controlador: ${device ? `${device.name} (${device.deviceCode})` : appliedFilters.deviceId}`,
        )
      }
      if (appliedFilters.employeeId) {
        const employee = employeeById.get(appliedFilters.employeeId)
        filterSummary.push(
          `Empleado: ${employee ? `${employee.firstName} ${employee.lastName} (${employee.employeeCode})` : appliedFilters.employeeId}`,
        )
      }
      if (appliedFilters.cardUid) {
        filterSummary.push(`UID: ${appliedFilters.cardUid}`)
      }
      if (appliedFilters.from) {
        filterSummary.push(
          `Desde: ${formatDateTimeWithSeconds(toIsoDateTime(appliedFilters.from) ?? appliedFilters.from)}`,
        )
      }
      if (appliedFilters.to) {
        filterSummary.push(
          `Hasta: ${formatDateTimeWithSeconds(toIsoDateTime(appliedFilters.to) ?? appliedFilters.to)}`,
        )
      }

      const rows: AccessEventReportRow[] = events.map((event) => {
        const employee = event.employeeId ? employeeById.get(event.employeeId) : undefined
        const area = areaById.get(event.areaId)
        const device = deviceById.get(event.deviceId)

        return {
          decisionLabel: DECISION_LABELS[event.decision],
          employeeLabel: employee
            ? `${employee.firstName} ${employee.lastName} (${employee.employeeCode})`
            : 'Tarjeta desconocida / sin empleado',
          cardUid: event.cardUid,
          areaLabel: area ? `${area.name} (${area.code})` : 'Área no disponible',
          deviceLabel: device
            ? `${device.name} (${device.deviceCode})`
            : `Controlador ${event.deviceId.slice(0, 8)}`,
          reasonLabel: REASON_LABELS[event.reasonCode] ?? event.reasonCode,
          occurredAtLabel: formatDateTimeWithSeconds(event.occurredAt),
          receivedAtLabel: formatDateTimeWithSeconds(event.receivedAt),
        }
      })

      const filename = downloadAccessEventsPdf({
        generatedAtLabel: formatDateTimeWithSeconds(new Date().toISOString()),
        totalInQuery: pagination.total,
        filterSummary:
          filterSummary.length > 0 ? filterSummary : ['Sin filtros aplicados (vista general)'],
        rows,
      })

      setExportNotice(`Reporte PDF generado correctamente (${filename}).`)
    } catch (err) {
      setExportError(getErrorMessage(err, 'No se pudo generar el reporte PDF.'))
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bitácora de accesos</h1>
          <p className="page-description">
            Registro inmutable de lecturas RFID con hora del lector y recepción en servidor.
          </p>
        </div>
        <div className="header-actions-group">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadEvents()}
            disabled={loading}
            aria-busy={loading}
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>{loading ? 'Actualizando…' : 'Actualizar bitácora'}</span>
          </button>
          {canExportReports ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportPdf}
              disabled={loading || events.length === 0}
            >
              <FileDown size={15} aria-hidden="true" />
              <span>Exportar reporte PDF</span>
            </button>
          ) : null}
        </div>
      </div>

      {exportNotice ? (
        <NoticeBanner
          variant="success"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setExportNotice(null)}
            >
              Cerrar
            </button>
          }
        >
          {exportNotice}
        </NoticeBanner>
      ) : null}

      {exportError ? (
        <NoticeBanner
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setExportError(null)}
            >
              Cerrar
            </button>
          }
        >
          {exportError}
        </NoticeBanner>
      ) : null}

      {supportError ? (
        <NoticeBanner
          variant="warning"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSupportReloadKey((current) => current + 1)}
            >
              Reintentar catálogos
            </button>
          }
        >
          {supportError}
        </NoticeBanner>
      ) : null}

      {error ? (
        <NoticeBanner
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadEvents()}
            >
              Reintentar
            </button>
          }
        >
          {error}
        </NoticeBanner>
      ) : null}

      <section
        className="surface-card"
        aria-label="Historial general de accesos"
        aria-busy={loading}
      >
        <form
          className="event-filters"
          onSubmit={handleFilterSubmit}
          role="search"
          aria-label="Filtros de la bitácora de accesos"
          autoComplete="off"
          noValidate
        >
          <div className="form-grid filter-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="event-decision-filter">
                Resultado
              </label>
              <select
                id="event-decision-filter"
                name="decision"
                className="select-control"
                value={draftFilters.decision}
                onChange={(event) =>
                  applyInstantFilter('decision', event.target.value as AccessDecision | '')
                }
              >
                <option value="">Todas las decisiones</option>
                {DECISIONS.map((decision) => (
                  <option key={decision} value={decision}>
                    {DECISION_LABELS[decision]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="event-reason-filter">
                Motivo
              </label>
              <select
                id="event-reason-filter"
                name="reasonCode"
                className="select-control"
                value={draftFilters.reasonCode}
                onChange={(event) =>
                  applyInstantFilter('reasonCode', event.target.value as AccessReason | '')
                }
              >
                <option value="">Todos los motivos</option>
                {REASON_CODES.map((reason) => (
                  <option key={reason} value={reason}>
                    {REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="event-area-filter">
                Área
              </label>
              <select
                id="event-area-filter"
                name="areaId"
                className="select-control"
                value={draftFilters.areaId}
                onChange={(event) => applyInstantFilter('areaId', event.target.value)}
              >
                <option value="">Todas las áreas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.code})
                  </option>
                ))}
              </select>
            </div>

            {canViewCatalogs ? (
              <>
                <div className="form-field">
                  <label className="form-label" htmlFor="event-device-filter">
                    Controlador
                  </label>
                  <select
                    id="event-device-filter"
                    name="deviceId"
                    className="select-control"
                    value={draftFilters.deviceId}
                    onChange={(event) => applyInstantFilter('deviceId', event.target.value)}
                  >
                    <option value="">Todos los controladores</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.deviceCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="event-employee-filter">
                    Empleado
                  </label>
                  <select
                    id="event-employee-filter"
                    name="employeeId"
                    className="select-control"
                    value={draftFilters.employeeId}
                    onChange={(event) => applyInstantFilter('employeeId', event.target.value)}
                  >
                    <option value="">Todos los empleados</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} ({employee.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            <div className="form-field">
              <label className="form-label" htmlFor="event-uid-filter">
                UID de tarjeta
              </label>
              <input
                id="event-uid-filter"
                name="cardUid"
                className="input-control mono-text"
                value={draftFilters.cardUid}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, cardUid: event.target.value }))
                }
                placeholder="04A1B2C3D4E5F6"
                maxLength={40}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? 'event-uid-filter-hint event-filter-error' : 'event-uid-filter-hint'
                }
              />
              <span className="form-hint" id="event-uid-filter-hint">
                Hexadecimal par de 8 a 32 caracteres. Se aplica automáticamente.
              </span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="event-from-filter">
                Desde
              </label>
              <input
                id="event-from-filter"
                name="from"
                className="input-control"
                type="datetime-local"
                max={maxDateTimeLocal}
                value={draftFilters.from}
                onChange={(event) => applyInstantFilter('from', event.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="event-to-filter">
                Hasta
              </label>
              <input
                id="event-to-filter"
                name="to"
                className="input-control"
                type="datetime-local"
                max={maxDateTimeLocal}
                value={draftFilters.to}
                onChange={(event) => applyInstantFilter('to', event.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          {filterError ? (
            <p className="form-error" id="event-filter-error" role="alert">
              {filterError}
            </p>
          ) : null}

          <div className="filter-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </form>

        <div className="table-toolbar">
          <span className="table-meta" role="status" aria-live="polite">
            {loading
              ? 'Consultando bitácora…'
              : `${formatCount(pagination.total, 'evento', 'eventos')} en total`}
          </span>
          <div className="toolbar-field">
            <label className="form-label" htmlFor="event-page-size">
              Filas por página
            </label>
            <select
              id="event-page-size"
              name="pageSize"
              className="select-control"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table
            className="data-table responsive-table"
            aria-label="Eventos de acceso registrados"
            aria-busy={loading}
          >
            <thead>
              <tr>
                <th scope="col">Resultado</th>
                <th scope="col">Empleado / Tarjeta</th>
                <th scope="col">Área y controlador</th>
                <th scope="col">Motivo</th>
                <th scope="col">Ocurrió (lector)</th>
                <th
                  scope="col"
                  title="Hora de recepción en el servidor. Puede ser posterior a la hora del lector si el controlador estaba sin conexión."
                >
                  Recibido (servidor)
                </th>
                <th scope="col" className="align-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableMessage
                  colSpan={7}
                  title="Cargando eventos de acceso…"
                  description={COLD_START_HINT}
                />
              ) : events.length === 0 ? (
                <TableMessage
                  colSpan={7}
                  title="Sin eventos que coincidan"
                  description="Ajusta los filtros para ampliar el rango de búsqueda."
                />
              ) : (
                events.map((event) => {
                  const employee = event.employeeId
                    ? employeeById.get(event.employeeId)
                    : undefined
                  const area = areaById.get(event.areaId)
                  const device = deviceById.get(event.deviceId)
                  const receivedLag = formatReceivedLagShort(event.occurredAt, event.receivedAt)

                  return (
                    <tr
                      key={event.id}
                      className="is-clickable"
                      tabIndex={0}
                      onClick={() => setDetailTarget(event)}
                      onKeyDown={(keyEvent) => handleRowKeyDown(keyEvent, event)}
                    >
                      <td data-label="Resultado">
                        <StatusBadge variant={event.decision === 'granted' ? 'success' : 'danger'}>
                          {event.decision === 'granted' ? (
                            <CheckCircle2 size={13} aria-hidden="true" />
                          ) : (
                            <XCircle size={13} aria-hidden="true" />
                          )}
                          <span>{DECISION_LABELS[event.decision]}</span>
                        </StatusBadge>
                      </td>
                      <td data-label="Empleado / Tarjeta">
                        <div className="cell-stack">
                          <span className="cell-primary">
                            {employee
                              ? `${employee.firstName} ${employee.lastName}`
                              : 'Tarjeta desconocida / sin empleado'}
                          </span>
                          <span>
                            <span className="mono-code" translate="no">
                              {event.cardUid}
                            </span>
                          </span>
                          {employee ? (
                            <span className="cell-secondary mono-text" translate="no">
                              {employee.employeeCode}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Área y controlador">
                        <div className="cell-stack">
                          <span>{area?.name ?? 'Área no disponible'}</span>
                          <span className="cell-secondary">
                            {device ? (
                              <>
                                {device.name} (
                                <span className="mono-text" translate="no">
                                  {device.deviceCode}
                                </span>
                                )
                              </>
                            ) : (
                              'Controlador asignado al área'
                            )}
                          </span>
                        </div>
                      </td>
                      <td data-label="Motivo" className="cell-secondary">
                        {REASON_LABELS[event.reasonCode] ?? event.reasonCode}
                      </td>
                      <td data-label="Ocurrió (lector)">
                        <time className="mono-text" dateTime={event.occurredAt}>
                          {formatDateTimeWithSeconds(event.occurredAt)}
                        </time>
                      </td>
                      <td data-label="Recibido (servidor)">
                        <time className="mono-text" dateTime={event.receivedAt}>
                          {formatDateTimeWithSeconds(event.receivedAt)}
                        </time>
                        {receivedLag ? (
                          <span
                            className="cell-secondary mono-text"
                            style={{ display: 'block' }}
                            title={`Recepción en el servidor: ${formatReceivedLag(event.occurredAt, event.receivedAt)} de la hora del lector.`}
                          >
                            {receivedLag}
                          </span>
                        ) : null}
                      </td>
                      <td data-label="Acciones">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              setDetailTarget(event)
                            }}
                            aria-label={`Ver detalle del evento de ${employee ? `${employee.firstName} ${employee.lastName}` : 'tarjeta desconocida'} del ${formatDateTimeWithSeconds(event.occurredAt)}`}
                          >
                            <Eye size={14} aria-hidden="true" />
                            Detalle
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && events.length > 0 ? (
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {detailTarget ? (
        <EventDetailModal
          event={detailTarget}
          employeeById={employeeById}
          areaById={areaById}
          deviceById={deviceById}
          onClose={() => setDetailTarget(null)}
        />
      ) : null}
    </div>
  )
}

interface EventDetailModalProps {
  event: AccessEventDto
  employeeById: Map<string, EmployeeDto>
  areaById: Map<string, AreaDto>
  deviceById: Map<string, AccessDeviceDto>
  onClose: () => void
}

function EventDetailModal({
  event,
  employeeById,
  areaById,
  deviceById,
  onClose,
}: EventDetailModalProps) {
  const [detail, setDetail] = useState<AccessEventDto>(event)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadDetail() {
      setLoading(true)
      setError(null)
      try {
        const response = await api.getAccessEvent(event.id)
        if (active) {
          setDetail(response)
        }
      } catch (err) {
        if (active) {
          setError(
            getErrorMessage(
              err,
              'No se pudo actualizar el detalle. Se muestran los datos recibidos en la bitácora.',
            ),
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      active = false
    }
  }, [event.id, reloadKey])

  const employee = detail.employeeId ? employeeById.get(detail.employeeId) : undefined
  const area = areaById.get(detail.areaId)
  const device = deviceById.get(detail.deviceId)

  return (
    <Modal
      title="Detalle del evento de acceso"
      description="Resumen operativo del intento de lectura RFID registrado en el área."
      size="wide"
      onClose={onClose}
    >
      {loading ? (
        <p className="table-meta" role="status">
          Actualizando detalle desde el servidor… {COLD_START_HINT}
        </p>
      ) : null}

      {error ? (
        <NoticeBanner
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Reintentar
            </button>
          }
        >
          {error}
        </NoticeBanner>
      ) : null}

      <div className="detail-grid">
        <div className="detail-item">
          <div className="detail-label">Decisión</div>
          <div className="detail-value">
            <StatusBadge variant={detail.decision === 'granted' ? 'success' : 'danger'}>
              {detail.decision === 'granted' ? (
                <CheckCircle2 size={13} aria-hidden="true" />
              ) : (
                <XCircle size={13} aria-hidden="true" />
              )}
              <span>{DECISION_LABELS[detail.decision]}</span>
            </StatusBadge>
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Motivo</div>
          <div className="detail-value">
            {REASON_LABELS[detail.reasonCode] ?? detail.reasonCode}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Empleado</div>
          <div className="detail-value">
            {employee
              ? `${employee.firstName} ${employee.lastName} (${employee.employeeCode})`
              : 'Tarjeta desconocida / sin empleado'}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Tarjeta RFID</div>
          <div className="detail-value mono-text" translate="no">
            {detail.cardUid}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Área</div>
          <div className="detail-value">
            {area ? (
              <>
                {area.name} (
                <span className="mono-text" translate="no">
                  {area.code}
                </span>
                )
              </>
            ) : (
              'Área no disponible'
            )}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Controlador</div>
          <div className="detail-value">
            {device ? (
              <>
                {device.name} (
                <span className="mono-text" translate="no">
                  {device.deviceCode}
                </span>
                )
              </>
            ) : (
              'Controlador asignado al área'
            )}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Ocurrió en el lector</div>
          <div className="detail-value mono-text">
            <time dateTime={detail.occurredAt}>
              {formatDateTimeWithSeconds(detail.occurredAt)}
            </time>
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Recibido en el servidor</div>
          <div className="detail-value mono-text">
            <time dateTime={detail.receivedAt}>
              {formatDateTimeWithSeconds(detail.receivedAt)}
            </time>
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Diferencia lector / servidor</div>
          <div className="detail-value mono-text">
            {formatReceivedLag(detail.occurredAt, detail.receivedAt)}
          </div>
        </div>
      </div>

      <details className="tech-details">
        <summary className="tech-details-summary">
          <span>Información técnica y trazabilidad</span>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div className="tech-details-body">
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Identificador del cliente</div>
              <div className="detail-value mono-text" translate="no">
                {detail.clientEventId}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Época del dispositivo</div>
              <div className="detail-value mono-text" translate="no">
                {detail.deviceEpoch ?? 'Sin reportar'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Secuencia del dispositivo</div>
              <div className="detail-value mono-text" translate="no">
                {detail.deviceSequence ?? 'Sin reportar'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Identificador del evento</div>
              <div className="detail-value mono-text" translate="no">
                {detail.id}
              </div>
            </div>
          </div>

          <div>
            <div className="detail-label">Metadatos del evento</div>
            <pre
              className="code-block"
              aria-label="Metadatos del evento en formato JSON"
              translate="no"
            >
              {formatMetadata(detail.metadata)}
            </pre>
          </div>
        </div>
      </details>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
