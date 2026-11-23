import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react'
import type {
  AccessDeviceDto,
  AreaDto,
  DeviceCredentialIssuedDto,
  DeviceStatus,
  DeviceSyncStateDto,
  PaginationMeta,
} from '@scaccess/shared'
import { Modal } from '../components/ui/Modal'
import { NoticeBanner } from '../components/ui/NoticeBanner'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT, TableMessage } from '../components/ui/TableMessage'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import {
  DEVICE_STATUS_LABELS,
  formatCount,
  formatDateTime,
  formatRelativeMinutes,
  getDeviceConnectivity,
} from '../lib/formatters'
import { getErrorMessage, hasLetters, isValidAreaCode } from '../lib/validation'

const PAGE_SIZE = 20
const DEVICE_STATUSES: DeviceStatus[] = ['active', 'inactive', 'maintenance']

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

type DeviceModalState = { mode: 'create' } | { mode: 'edit'; device: AccessDeviceDto } | null

interface IssuedTokenState {
  device: AccessDeviceDto
  issued: DeviceCredentialIssuedDto
}

function deviceBadgeVariant(status: DeviceStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'maintenance') return 'warning'
  return 'neutral'
}

export function DevicesPage() {
  const { isAdmin } = useAuth()
  const [devices, setDevices] = useState<AccessDeviceDto[]>([])
  const [areas, setAreas] = useState<AreaDto[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deviceModal, setDeviceModal] = useState<DeviceModalState>(null)
  const [syncTarget, setSyncTarget] = useState<AccessDeviceDto | null>(null)
  const [issuedToken, setIssuedToken] = useState<IssuedTokenState | null>(null)
  const [issuingDeviceId, setIssuingDeviceId] = useState<string | null>(null)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [deviceResponse, areaResponse] = await Promise.all([
        api.listAccessDevices({ page, pageSize: PAGE_SIZE }),
        api.listAreas({ page: 1, pageSize: 100 }),
      ])
      setDevices(deviceResponse.data)
      setPagination(deviceResponse.pagination)
      setAreas(areaResponse.data)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cargar el inventario de controladores.'))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas])

  function areaNames(device: AccessDeviceDto): string {
    if (device.areaIds.length === 0) {
      return 'Sin áreas asignadas'
    }
    return device.areaIds
      .map((areaId) => areaById.get(areaId)?.name ?? `Área ${areaId.slice(0, 8)}`)
      .join(', ')
  }

  function handleSaved(message: string) {
    const wasCreate = deviceModal?.mode === 'create'
    setDeviceModal(null)
    setNotice(message)
    if (wasCreate && page !== 1) {
      setPage(1)
    } else {
      void loadDevices()
    }
  }

  async function handleIssueCredential(device: AccessDeviceDto) {
    setActionError(null)
    setIssuingDeviceId(device.id)
    try {
      const issued = await api.issueDeviceCredential(device.id)
      setIssuedToken({ device, issued })
    } catch (err) {
      setActionError(
        getErrorMessage(err, `No se pudo emitir la credencial de ${device.name}.`),
      )
    } finally {
      setIssuingDeviceId(null)
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Controladores ESP32-S3</h1>
          <p className="page-description">
            Controladores físicos ESP32-S3, áreas asignadas y estado de sincronización.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadDevices()}
            disabled={loading}
            aria-busy={loading}
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>{loading ? 'Actualizando…' : 'Actualizar inventario'}</span>
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setDeviceModal({ mode: 'create' })}
            >
              <Plus size={16} aria-hidden="true" />
              Nuevo controlador
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <NoticeBanner
          variant="success"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setNotice(null)}
            >
              Cerrar
            </button>
          }
        >
          {notice}
        </NoticeBanner>
      ) : null}

      {actionError ? (
        <NoticeBanner
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setActionError(null)}
            >
              Cerrar
            </button>
          }
        >
          {actionError}
        </NoticeBanner>
      ) : null}

      {error ? (
        <NoticeBanner
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadDevices()}
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
        aria-label="Inventario de controladores"
        aria-busy={loading}
      >
        <div className="table-toolbar">
          <span className="table-meta" role="status" aria-live="polite">
            {loading
              ? 'Consultando controladores…'
              : formatCount(
                  pagination.total,
                  'controlador registrado',
                  'controladores registrados',
                )}
          </span>
        </div>

        <div className="table-wrapper">
          <table
            className="data-table responsive-table"
            aria-label="Controladores ESP32-S3 registrados"
            aria-busy={loading}
          >
            <thead>
              <tr>
                <th scope="col">Controlador</th>
                <th scope="col">Ubicación</th>
                <th scope="col">Áreas asignadas</th>
                <th scope="col">Estado</th>
                <th scope="col">Última conexión</th>
                <th scope="col" className="align-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableMessage
                  colSpan={6}
                  title="Cargando controladores…"
                  description={COLD_START_HINT}
                />
              ) : devices.length === 0 ? (
                <TableMessage
                  colSpan={6}
                  title="Sin controladores registrados"
                  description={
                    isAdmin
                      ? 'Registra el primer lector ESP32-S3 para asignarle áreas y emitir su credencial.'
                      : 'Solicita a un administrador que registre el primer lector ESP32-S3.'
                  }
                >
                  {isAdmin ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setDeviceModal({ mode: 'create' })}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Registrar controlador
                    </button>
                  ) : null}
                </TableMessage>
              ) : (
                devices.map((device) => {
                  const connectivity = getDeviceConnectivity(device)
                  return (
                    <tr key={device.id}>
                      <td data-label="Controlador">
                        <div className="cell-stack">
                          <span className="cell-primary">{device.name}</span>
                          <span className="mono-code" translate="no">
                            {device.deviceCode}
                          </span>
                          <span className="cell-secondary">
                            {device.hardwareModel ?? 'Modelo sin definir'} / firmware{' '}
                            <span className="mono-text" translate="no">
                              {device.firmwareVersion ?? 'sin reportar'}
                            </span>{' '}
                            /{' '}
                            <span className="mono-text" translate="no">
                              config v{device.configVersion}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Ubicación" className="cell-secondary">
                        {device.location ?? 'Sin ubicación'}
                      </td>
                      <td data-label="Áreas asignadas">{areaNames(device)}</td>
                      <td data-label="Estado">
                        <div className="badge-list">
                          <StatusBadge variant={connectivity.variant}>
                            {connectivity.label}
                          </StatusBadge>
                          <StatusBadge variant={deviceBadgeVariant(device.status)}>
                            {DEVICE_STATUS_LABELS[device.status]}
                          </StatusBadge>
                        </div>
                      </td>
                      <td data-label="Última conexión">
                        <time
                          className="cell-secondary"
                          dateTime={device.lastSeenAt ?? undefined}
                          title={formatDateTime(device.lastSeenAt)}
                        >
                          {formatRelativeMinutes(device.lastSeenAt)}
                        </time>
                      </td>
                      <td data-label="Acciones">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSyncTarget(device)}
                            aria-label={`Consultar sincronización de ${device.name}`}
                          >
                            <RefreshCw size={14} aria-hidden="true" />
                            Sincronización
                          </button>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setDeviceModal({ mode: 'edit', device })}
                                aria-label={`Editar ${device.name}`}
                              >
                                <Pencil size={14} aria-hidden="true" />
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => void handleIssueCredential(device)}
                                disabled={issuingDeviceId === device.id}
                                aria-label={`Emitir credencial de ${device.name}`}
                              >
                                <KeyRound size={14} aria-hidden="true" />
                                {issuingDeviceId === device.id ? 'Emitiendo…' : 'Credencial'}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && devices.length > 0 ? (
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {deviceModal ? (
        <DeviceFormModal
          device={deviceModal.mode === 'edit' ? deviceModal.device : null}
          areas={areas}
          onClose={() => setDeviceModal(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {syncTarget ? (
        <SyncStateModal device={syncTarget} onClose={() => setSyncTarget(null)} />
      ) : null}

      {issuedToken ? (
        <IssuedTokenModal
          state={issuedToken}
          onClose={() => setIssuedToken(null)}
        />
      ) : null}
    </div>
  )
}

interface DeviceFormModalProps {
  device: AccessDeviceDto | null
  areas: AreaDto[]
  onClose: () => void
  onSaved: (message: string) => void
}

function DeviceFormModal({ device, areas, onClose, onSaved }: DeviceFormModalProps) {
  const [deviceCode, setDeviceCode] = useState(device?.deviceCode ?? '')
  const [name, setName] = useState(device?.name ?? '')
  const [location, setLocation] = useState(device?.location ?? '')
  const [hardwareModel, setHardwareModel] = useState(device?.hardwareModel ?? 'ESP32-S3')
  const [firmwareVersion, setFirmwareVersion] = useState(device?.firmwareVersion ?? '')
  const [status, setStatus] = useState<DeviceStatus>(device?.status ?? 'active')
  const [areaIds, setAreaIds] = useState<string[]>(device?.areaIds ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function toggleArea(areaId: string) {
    setAreaIds((current) =>
      current.includes(areaId)
        ? current.filter((value) => value !== areaId)
        : [...current, areaId],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedCode = deviceCode.trim()
    const trimmedName = name.trim()

    if (!device && !trimmedCode) {
      setFormError('El código del controlador es obligatorio.')
      return
    }
    if (!device && !isValidAreaCode(trimmedCode)) {
      setFormError(
        'El código del controlador debe incluir letras y solo usar letras, números, guiones o guion bajo.',
      )
      return
    }
    if (!trimmedName) {
      setFormError('El nombre del controlador es obligatorio.')
      return
    }
    if (!hasLetters(trimmedName)) {
      setFormError('El nombre del controlador debe contener al menos una letra.')
      return
    }

    const payload = {
      name: trimmedName,
      location: location.trim() || null,
      hardwareModel: hardwareModel.trim() || null,
      firmwareVersion: firmwareVersion.trim() || null,
      status,
      areaIds,
    }

    setSubmitting(true)
    setFormError(null)

    try {
      if (device) {
        await api.updateAccessDevice(device.id, payload)
        onSaved('Controlador actualizado correctamente.')
      } else {
        await api.createAccessDevice({
          deviceCode: trimmedCode,
          ...payload,
        })
        onSaved('Controlador registrado correctamente.')
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el controlador.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={device ? 'Editar controlador' : 'Nuevo controlador'}
      description={
        device
          ? 'Cambiar las áreas asignadas incrementa la versión de configuración y exige una nueva sincronización del equipo.'
          : 'Registra el lector y asigna las áreas donde puede validar accesos. La credencial se emite por separado.'
      }
      size="wide"
      onClose={onClose}
    >
      <form autoComplete="off" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="modal-body">
          {formError ? <NoticeBanner variant="error">{formError}</NoticeBanner> : null}

          {device ? (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">Código del controlador</div>
                <div className="detail-value mono-text" translate="no">
                  {device.deviceCode}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Versión de configuración actual</div>
                <div className="detail-value mono-text">
                  v<span translate="no">{device.configVersion}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="form-grid">
            {!device ? (
              <div className="form-field">
                <label className="form-label" htmlFor="device-form-code">
                  Código del controlador
                </label>
                <input
                  id="device-form-code"
                  name="deviceCode"
                  className="input-control mono-text"
                  value={deviceCode}
                  onChange={(event) => setDeviceCode(event.target.value)}
                  maxLength={64}
                  placeholder="ESP32-A-01"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-describedby="device-form-code-hint"
                  required
                />
                <span className="form-hint" id="device-form-code-hint">
                  Identificador único impreso en la etiqueta del equipo. No se puede cambiar después
                  del registro.
                </span>
              </div>
            ) : null}

            <div className="form-field">
              <label className="form-label" htmlFor="device-form-name">
                Nombre del controlador
              </label>
              <input
                id="device-form-name"
                name="name"
                className="input-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="Lector Entrada Principal"
                autoComplete="off"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="device-form-location">
                Ubicación física
              </label>
              <input
                id="device-form-location"
                name="location"
                className="input-control"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={128}
                placeholder="Edificio A, acceso norte"
                autoComplete="off"
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="device-form-hardware">
                Modelo de hardware
              </label>
              <input
                id="device-form-hardware"
                name="hardwareModel"
                className="input-control"
                value={hardwareModel}
                onChange={(event) => setHardwareModel(event.target.value)}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="device-form-firmware">
                Versión de firmware
              </label>
              <input
                id="device-form-firmware"
                name="firmwareVersion"
                className="input-control"
                value={firmwareVersion}
                onChange={(event) => setFirmwareVersion(event.target.value)}
                maxLength={32}
                placeholder="1.0.0"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="device-form-status">
                Estado del controlador
              </label>
              <select
                id="device-form-status"
                name="status"
                className="select-control"
                value={status}
                onChange={(event) => setStatus(event.target.value as DeviceStatus)}
              >
                {DEVICE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {DEVICE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="form-field form-field-full"
              role="group"
              aria-labelledby="device-form-areas-label"
            >
              <span className="form-label" id="device-form-areas-label">
                Áreas asignadas
              </span>
              {areas.length === 0 ? (
                <span className="form-error">
                  No hay áreas registradas. Crea una antes de asignarla al controlador.
                </span>
              ) : (
                <div className="checkbox-grid">
                  {areas.map((area) => (
                    <label key={area.id} className="checkbox-item" htmlFor={`device-area-${area.id}`}>
                      <input
                        id={`device-area-${area.id}`}
                        name={`deviceArea-${area.id}`}
                        type="checkbox"
                        checked={areaIds.includes(area.id)}
                        onChange={() => toggleArea(area.id)}
                      />
                      <span className="checkbox-copy">
                        <span>{area.name}</span>
                        <span className="cell-secondary mono-text" translate="no">
                          {area.code}
                          {area.isActive ? '' : ' / Inactiva'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <span className="form-hint">
                El controlador solo valida accesos en las áreas seleccionadas.
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar controlador'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface SyncStateModalProps {
  device: AccessDeviceDto
  onClose: () => void
}

function SyncStateModal({ device, onClose }: SyncStateModalProps) {
  const [state, setState] = useState<DeviceSyncStateDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadState() {
      setLoading(true)
      setError(null)
      try {
        const response = await api.getDeviceSyncState(device.id)
        if (active) {
          setState(response)
        }
      } catch (err) {
        if (active) {
          setError(
            getErrorMessage(err, 'No se pudo consultar el estado de sincronización.'),
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadState()

    return () => {
      active = false
    }
  }, [device.id, reloadKey])

  const synchronized = state ? state.configVersion === device.configVersion : false

  return (
    <Modal
      title={`Estado de sincronización de ${device.name}`}
      description="Comparación entre la configuración publicada por el servidor y la última versión reportada por el controlador."
      size="wide"
      onClose={onClose}
    >
      {loading && !state ? (
        <p className="table-meta" role="status">
          Consultando estado del controlador… {COLD_START_HINT}
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

      {state ? (
        <div className="page-stack">
          <div
            className={`sync-verdict ${synchronized ? 'ok' : 'warn'}`}
            role="status"
            aria-live="polite"
          >
            {synchronized ? (
              <CheckCircle2 size={20} aria-hidden="true" />
            ) : (
              <AlertTriangle size={20} aria-hidden="true" />
            )}
            <div>
              <div>{synchronized ? 'Sincronizado' : 'Desactualizado'}</div>
              <div className="sync-verdict-detail mono-text" translate="no">
                Reportada por el equipo: v{state.configVersion}. Versión actual del servidor: v
                {device.configVersion}.
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Última sincronización solicitada</div>
              <div className="detail-value">
                <time dateTime={state.lastSyncRequestedAt ?? undefined}>
                  {formatDateTime(state.lastSyncRequestedAt)}
                </time>
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Última sincronización completada</div>
              <div className="detail-value">
                <time dateTime={state.lastSyncCompletedAt ?? undefined}>
                  {formatDateTime(state.lastSyncCompletedAt)}
                </time>
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Último evento recibido</div>
              <div className="detail-value">
                <time dateTime={state.lastEventReceivedAt ?? undefined}>
                  {formatDateTime(state.lastEventReceivedAt)}
                </time>
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Último evento ocurrido en el lector</div>
              <div className="detail-value">
                <time dateTime={state.lastEventOccurredAt ?? undefined}>
                  {formatDateTime(state.lastEventOccurredAt)}
                </time>
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Eventos pendientes reportados</div>
              <div className="detail-value">
                {formatCount(
                  state.pendingEventCountReported ?? 0,
                  'evento sin sincronizar',
                  'eventos sin sincronizar',
                )}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Último código de error</div>
              <div className="detail-value mono-text" translate="no">
                {state.lastErrorCode ?? 'Sin errores reportados'}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Fecha del último error</div>
              <div className="detail-value">
                <time dateTime={state.lastErrorAt ?? undefined}>
                  {formatDateTime(state.lastErrorAt)}
                </time>
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Estado actualizado</div>
              <div className="detail-value">
                <time dateTime={state.updatedAt}>{formatDateTime(state.updatedAt)}</time>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

interface IssuedTokenModalProps {
  state: IssuedTokenState
  onClose: () => void
}

function IssuedTokenModal({ state, onClose }: IssuedTokenModalProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  async function handleCopy() {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard no disponible')
      }
      await navigator.clipboard.writeText(state.issued.token)
      setCopyStatus('Token copiado al portapapeles.')
    } catch {
      setCopyStatus(
        'No se pudo copiar automáticamente. Selecciona el token y cópialo manualmente.',
      )
    }
  }

  return (
    <Modal
      title="Credencial del dispositivo emitida"
      description={`Token de autenticación para ${state.device.name} (${state.device.deviceCode}).`}
      size="wide"
      onClose={onClose}
    >
      <NoticeBanner variant="warning">
        Este token solo se muestra una vez. Cópialo ahora y guárdalo en un lugar seguro; no volverá
        a aparecer completo.
      </NoticeBanner>

      <div className="token-display">
        <pre className="code-block" aria-label="Token del dispositivo" translate="no">
          {state.issued.token}
        </pre>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleCopy()}
        >
          <ClipboardCopy size={16} aria-hidden="true" />
          Copiar token
        </button>
      </div>

      {copyStatus ? (
        <p className="form-hint" role="status">
          {copyStatus}
        </p>
      ) : null}

      <div className="detail-grid">
        <div className="detail-item">
          <div className="detail-label">Identificador del token</div>
          <div className="detail-value mono-text" translate="no">
            {state.issued.tokenId}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Emitido</div>
          <div className="detail-value">
            <time dateTime={state.issued.createdAt}>
              {formatDateTime(state.issued.createdAt)}
            </time>
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Expira</div>
          <div className="detail-value">
            {state.issued.expiresAt ? (
              <time dateTime={state.issued.expiresAt}>
                {formatDateTime(state.issued.expiresAt)}
              </time>
            ) : (
              'Sin fecha de expiración'
            )}
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Entendido, cerrar
        </button>
      </div>
    </Modal>
  )
}
