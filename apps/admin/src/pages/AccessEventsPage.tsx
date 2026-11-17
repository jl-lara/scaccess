import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, RefreshCw, Search, XCircle } from 'lucide-react'
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
import { DECISION_LABELS, REASON_LABELS, formatDateTimeWithSeconds } from '../lib/formatters'
import {
  formatMetadata,
  getErrorMessage,
  isValidCardUid,
  normalizeCardUid,
  toIsoDateTime,
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
    return 'Sin calculo'
  }
  if (seconds === 0) {
    return 'Sin diferencia'
  }
  const direction = seconds > 0 ? 'despues' : 'antes'
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

export function AccessEventsPage() {
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

  useEffect(() => {
    let active = true

    async function loadSupportCatalogs() {
      try {
        const [employeeResponse, areaResponse, deviceResponse] = await Promise.all([
          api.listEmployees({ page: 1, pageSize: 100 }),
          api.listAreas({ page: 1, pageSize: 100 }),
          api.listAccessDevices({ page: 1, pageSize: 100 }),
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
              'No se pudieron cargar los catalogos auxiliares. Los filtros mostraran identificadores.',
            ),
          )
        }
      }
    }

    void loadSupportCatalogs()

    return () => {
      active = false
    }
  }, [supportReloadKey])

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
        deviceId: appliedFilters.deviceId || undefined,
        employeeId: appliedFilters.employeeId || undefined,
        cardUid: appliedFilters.cardUid || undefined,
        from: toIsoDateTime(appliedFilters.from) ?? undefined,
        to: toIsoDateTime(appliedFilters.to) ?? undefined,
      })
      setEvents(response.data)
      setPagination(response.pagination)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo consultar la bitacora de accesos.'))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, appliedFilters])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  )
  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas])
  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices])

  function updateDraft<K extends keyof EventFilters>(field: K, value: EventFilters[K]) {
    setDraftFilters((current) => ({ ...current, [field]: value }))
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedUid = normalizeCardUid(draftFilters.cardUid)
    if (normalizedUid && !isValidCardUid(normalizedUid)) {
      setFilterError('El UID debe ser hexadecimal par de 8 a 32 caracteres.')
      return
    }

    const fromIso = toIsoDateTime(draftFilters.from)
    const toIso = toIsoDateTime(draftFilters.to)

    if (fromIso && toIso && new Date(toIso).getTime() < new Date(fromIso).getTime()) {
      setFilterError('La fecha de fin no puede ser anterior a la fecha de inicio.')
      return
    }

    setFilterError(null)
    setPage(1)
    setAppliedFilters({ ...draftFilters, cardUid: normalizedUid })
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setFilterError(null)
    setPage(1)
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bitacora de accesos</h1>
          <p className="page-description">
            Registro inmutable de cada lectura en los controladores. La hora del lector y la hora de
            recepcion en el servidor se conservan por separado para auditar eventos offline.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadEvents()}
          disabled={loading}
          aria-busy={loading}
        >
          <RefreshCw size={15} aria-hidden="true" />
          <span>{loading ? 'Actualizando…' : 'Actualizar bitacora'}</span>
        </button>
      </div>

      {supportError ? (
        <NoticeBanner
          variant="warning"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSupportReloadKey((current) => current + 1)}
            >
              Reintentar catalogos
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
          aria-label="Filtros de la bitacora de accesos"
          autoComplete="off"
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
                  updateDraft('decision', event.target.value as AccessDecision | '')
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
                  updateDraft('reasonCode', event.target.value as AccessReason | '')
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
                Area
              </label>
              <select
                id="event-area-filter"
                name="areaId"
                className="select-control"
                value={draftFilters.areaId}
                onChange={(event) => updateDraft('areaId', event.target.value)}
              >
                <option value="">Todas las areas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="event-device-filter">
                Controlador
              </label>
              <select
                id="event-device-filter"
                name="deviceId"
                className="select-control"
                value={draftFilters.deviceId}
                onChange={(event) => updateDraft('deviceId', event.target.value)}
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
                onChange={(event) => updateDraft('employeeId', event.target.value)}
              >
                <option value="">Todos los empleados</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="event-uid-filter">
                UID de tarjeta
              </label>
              <input
                id="event-uid-filter"
                name="cardUid"
                className="input-control mono-text"
                value={draftFilters.cardUid}
                onChange={(event) => updateDraft('cardUid', event.target.value)}
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
                Hexadecimal de 8 a 32 caracteres. Se normaliza a mayusculas al aplicar el filtro.
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
                value={draftFilters.from}
                onChange={(event) => updateDraft('from', event.target.value)}
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
                value={draftFilters.to}
                onChange={(event) => updateDraft('to', event.target.value)}
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
            <button type="submit" className="btn btn-primary btn-sm">
              <Search size={14} aria-hidden="true" />
              Aplicar filtros
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </form>

        <div className="table-toolbar">
          <span className="table-meta" role="status" aria-live="polite">
            {loading ? 'Consultando bitacora…' : `${pagination.total} eventos en total`}
          </span>
          <div className="toolbar-field">
            <label className="form-label" htmlFor="event-page-size">
              Filas por pagina
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
            className="data-table"
            aria-label="Eventos de acceso registrados"
            aria-busy={loading}
          >
            <thead>
              <tr>
                <th scope="col">Resultado</th>
                <th scope="col">Empleado / Tarjeta</th>
                <th scope="col">Area y controlador</th>
                <th scope="col">Motivo</th>
                <th scope="col">Ocurrio (lector)</th>
                <th
                  scope="col"
                  title="Hora de recepcion en el servidor. Puede ser posterior a la hora del lector si el controlador estaba sin conexion."
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
                  description="Ajusta los filtros para ampliar el rango de busqueda."
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
                    <tr key={event.id}>
                      <td>
                        <StatusBadge variant={event.decision === 'granted' ? 'success' : 'danger'}>
                          {event.decision === 'granted' ? (
                            <CheckCircle2 size={13} aria-hidden="true" />
                          ) : (
                            <XCircle size={13} aria-hidden="true" />
                          )}
                          <span>{DECISION_LABELS[event.decision]}</span>
                        </StatusBadge>
                      </td>
                      <td>
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
                      <td>
                        <div className="cell-stack">
                          <span>{area?.name ?? 'Area no disponible'}</span>
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
                              <>
                                Controlador{' '}
                                <span className="mono-text" translate="no">
                                  {event.deviceId.slice(0, 8)}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="cell-secondary">
                        {REASON_LABELS[event.reasonCode] ?? event.reasonCode}
                      </td>
                      <td>
                        <time className="mono-text" dateTime={event.occurredAt}>
                          {formatDateTimeWithSeconds(event.occurredAt)}
                        </time>
                      </td>
                      <td>
                        <time className="mono-text" dateTime={event.receivedAt}>
                          {formatDateTimeWithSeconds(event.receivedAt)}
                        </time>
                        {receivedLag ? (
                          <span
                            className="cell-secondary mono-text"
                            style={{ display: 'block' }}
                            title={`Recepcion en el servidor: ${formatReceivedLag(event.occurredAt, event.receivedAt)} de la hora del lector.`}
                          >
                            {receivedLag}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDetailTarget(event)}
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
              'No se pudo actualizar el detalle. Se muestran los datos recibidos en la bitacora.',
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
      description="Registro inmutable con la identidad de la tarjeta, la decision y las marcas de tiempo del lector y del servidor."
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
          <div className="detail-label">Decision</div>
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
          <div className="detail-label">Area</div>
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
              'Area no disponible'
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
              <span className="mono-text" translate="no">
                {detail.deviceId}
              </span>
            )}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Ocurrio en el lector</div>
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
        <div className="detail-item">
          <div className="detail-label">Identificador del cliente</div>
          <div className="detail-value mono-text" translate="no">
            {detail.clientEventId}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Epoca del dispositivo</div>
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

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
