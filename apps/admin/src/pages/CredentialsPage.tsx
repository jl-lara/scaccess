import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import type {
  CredentialDto,
  CredentialStatus,
  EmployeeDto,
  PaginationMeta,
} from '@scaccess/shared'
import { Modal } from '../components/ui/Modal'
import { NoticeBanner } from '../components/ui/NoticeBanner'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT, TableMessage } from '../components/ui/TableMessage'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { CREDENTIAL_STATUS_LABELS, formatDateTime } from '../lib/formatters'
import {
  getErrorMessage,
  isValidCardUid,
  normalizeCardUid,
} from '../lib/validation'

const PAGE_SIZE = 20
const CREDENTIAL_STATUSES: CredentialStatus[] = ['active', 'blocked', 'lost', 'retired']
const CARD_UID_HINT = 'UID hexadecimal par de 8 a 32 caracteres, por ejemplo 04A1B2C3D4E5F6.'

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

const COUNT_FORMATTER = new Intl.NumberFormat('es-MX')

type CredentialModalState = { mode: 'create' } | { mode: 'edit'; credential: CredentialDto } | null

function credentialBadgeVariant(status: CredentialStatus): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'blocked') return 'danger'
  if (status === 'lost') return 'warning'
  return 'neutral'
}

export function CredentialsPage() {
  const { canWriteCatalog } = useAuth()
  const [credentials, setCredentials] = useState<CredentialDto[]>([])
  const [employees, setEmployees] = useState<EmployeeDto[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<CredentialStatus | ''>('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [cardUidInput, setCardUidInput] = useState('')
  const [appliedCardUid, setAppliedCardUid] = useState('')
  const [loading, setLoading] = useState(true)
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employeesError, setEmployeesError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [modal, setModal] = useState<CredentialModalState>(null)

  const loadEmployees = useCallback(async () => {
    setEmployeesLoading(true)
    setEmployeesError(null)
    try {
      const response = await api.listEmployees({ page: 1, pageSize: 100 })
      setEmployees(response.data)
    } catch (err) {
      setEmployeesError(
        getErrorMessage(
          err,
          'No se pudo cargar el directorio de empleados titulares. Revisa tu conexion y vuelve a intentarlo.',
        ),
      )
    } finally {
      setEmployeesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEmployees()
  }, [loadEmployees])

  const loadCredentials = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listCredentials({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        employeeId: employeeFilter || undefined,
        cardUid: appliedCardUid || undefined,
      })
      setCredentials(response.data)
      setPagination(response.pagination)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se pudo cargar el inventario de tarjetas RFID. Revisa tu conexion y vuelve a intentarlo.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, employeeFilter, appliedCardUid])

  useEffect(() => {
    void loadCredentials()
  }, [loadCredentials])

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  )

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedUid = normalizeCardUid(cardUidInput)
    if (normalizedUid && !isValidCardUid(normalizedUid)) {
      setFilterError(CARD_UID_HINT)
      return
    }
    setFilterError(null)
    setPage(1)
    setAppliedCardUid(normalizedUid)
  }

  function clearFilters() {
    setStatusFilter('')
    setEmployeeFilter('')
    setCardUidInput('')
    setAppliedCardUid('')
    setFilterError(null)
    setPage(1)
  }

  const hasActiveFilters = Boolean(statusFilter || employeeFilter || appliedCardUid)

  function handleSaved(message: string) {
    const wasCreate = modal?.mode === 'create'
    setModal(null)
    setNotice(message)
    if (wasCreate && page !== 1) {
      setPage(1)
    } else {
      void loadCredentials()
    }
  }

  function employeeName(employeeId: string): { name: string; code: string } {
    const employee = employeeById.get(employeeId)
    if (!employee) {
      return { name: 'Empleado no disponible', code: employeeId.slice(0, 8) }
    }
    return {
      name: `${employee.firstName} ${employee.lastName}`,
      code: employee.employeeCode,
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tarjetas RFID</h1>
          <p className="page-description">
            Inventario de tarjetas RFID vinculadas a empleados.
          </p>
        </div>
        {canWriteCatalog ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'create' })}
          >
            <Plus size={16} aria-hidden="true" />
            Registrar tarjeta
          </button>
        ) : null}
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

      {employeesError ? (
        <NoticeBanner
          variant="warning"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadEmployees()}
            >
              Reintentar
            </button>
          }
        >
          {employeesError} Las tarjetas se muestran con el identificador del titular.
        </NoticeBanner>
      ) : null}

      {error ? (
        <NoticeBanner
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadCredentials()}
            >
              Reintentar
            </button>
          }
        >
          {error}
        </NoticeBanner>
      ) : null}

      <section className="surface-card" aria-label="Inventario de tarjetas RFID">
        <form
          className="table-toolbar"
          role="search"
          aria-label="Filtros de tarjetas RFID"
          autoComplete="off"
          onSubmit={handleFilterSubmit}
        >
          <div className="filter-group">
            <div className="toolbar-field">
              <label className="form-label" htmlFor="credential-status-filter">
                Filtrar por estado
              </label>
              <select
                id="credential-status-filter"
                name="credentialStatus"
                className="select-control"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as CredentialStatus | '')
                  setPage(1)
                }}
              >
                <option value="">Todos los estados</option>
                {CREDENTIAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CREDENTIAL_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar-field">
              <label className="form-label" htmlFor="credential-employee-filter">
                Titular
              </label>
              <select
                id="credential-employee-filter"
                name="employeeId"
                className="select-control"
                value={employeeFilter}
                onChange={(event) => {
                  setEmployeeFilter(event.target.value)
                  setPage(1)
                }}
                disabled={employeesLoading}
              >
                <option value="">Todos los empleados</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar-field">
              <label className="form-label" htmlFor="credential-uid-filter">
                Buscar UID
              </label>
              <input
                id="credential-uid-filter"
                name="cardUid"
                className="input-control"
                value={cardUidInput}
                onChange={(event) => setCardUidInput(event.target.value)}
                placeholder="Ej. 04A1B2C3D4E5F6"
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="characters"
                aria-invalid={Boolean(filterError)}
                aria-describedby={filterError ? 'credential-filter-error' : undefined}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm">
              <Search size={14} aria-hidden="true" />
              Aplicar filtros
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Limpiar
            </button>
          </div>
          <span className="table-meta" role="status" aria-live="polite">
            {loading
              ? 'Actualizando…'
              : `${COUNT_FORMATTER.format(pagination.total)} tarjetas en total`}
          </span>
        </form>

        {filterError ? (
          <p className="form-error" id="credential-filter-error" role="alert">
            {filterError}
          </p>
        ) : null}

        <div className="table-wrapper">
          <table className="data-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Tarjeta</th>
                <th scope="col">Titular</th>
                <th scope="col">Estado</th>
                <th scope="col">Emitida</th>
                <th scope="col">Desactivacion</th>
                <th scope="col" className="align-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableMessage
                  colSpan={6}
                  title="Cargando tarjetas RFID…"
                  description={COLD_START_HINT}
                />
              ) : credentials.length === 0 ? (
                <TableMessage
                  colSpan={6}
                  title={
                    hasActiveFilters ? 'Sin tarjetas que coincidan' : 'Sin tarjetas registradas'
                  }
                  description={
                    hasActiveFilters
                      ? 'Ajusta o limpia los filtros para ver todo el inventario.'
                      : canWriteCatalog
                        ? 'Registra la primera tarjeta RFID y vincula la al empleado titular.'
                        : 'Solicita a un administrador que registre la primera tarjeta RFID.'
                  }
                >
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={clearFilters}
                    >
                      Limpiar filtros
                    </button>
                  ) : canWriteCatalog ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setModal({ mode: 'create' })}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Registrar tarjeta
                    </button>
                  ) : null}
                </TableMessage>
              ) : (
                credentials.map((credential) => {
                  const holder = employeeName(credential.employeeId)
                  return (
                    <tr key={credential.id}>
                      <td>
                        <div className="cell-stack">
                          <span className="mono-code" translate="no">
                            {credential.cardUid}
                          </span>
                          <span className="cell-secondary">
                            {credential.label ?? 'Sin etiqueta'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <span className="cell-primary">{holder.name}</span>
                          <span className="cell-secondary mono-text" translate="no">
                            {holder.code}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge variant={credentialBadgeVariant(credential.status)}>
                          {CREDENTIAL_STATUS_LABELS[credential.status]}
                        </StatusBadge>
                      </td>
                      <td className="cell-secondary">{formatDateTime(credential.issuedAt)}</td>
                      <td>
                        {credential.status === 'active' ? (
                          <span className="cell-secondary">Sin desactivacion</span>
                        ) : (
                          <div className="cell-stack">
                            <span>{credential.deactivationReason ?? 'Sin motivo registrado'}</span>
                            <span className="cell-secondary">
                              {formatDateTime(credential.deactivatedAt)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {canWriteCatalog ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setModal({ mode: 'edit', credential })}
                              aria-label={`Editar tarjeta ${credential.cardUid}`}
                            >
                              <Pencil size={14} aria-hidden="true" />
                              Editar
                            </button>
                          ) : (
                            <span className="cell-secondary">Solo lectura</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && credentials.length > 0 ? (
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {modal ? (
        <CredentialFormModal
          credential={modal.mode === 'edit' ? modal.credential : null}
          employees={employees}
          employeesLoading={employeesLoading}
          employeesError={employeesError}
          employeeById={employeeById}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}

interface CredentialFormModalProps {
  credential: CredentialDto | null
  employees: EmployeeDto[]
  employeesLoading: boolean
  employeesError: string | null
  employeeById: Map<string, EmployeeDto>
  onClose: () => void
  onSaved: (message: string) => void
}

function CredentialFormModal({
  credential,
  employees,
  employeesLoading,
  employeesError,
  employeeById,
  onClose,
  onSaved,
}: CredentialFormModalProps) {
  const [employeeId, setEmployeeId] = useState(credential?.employeeId ?? '')
  const [cardUid, setCardUid] = useState(credential?.cardUid ?? '')
  const [label, setLabel] = useState(credential?.label ?? '')
  const [status, setStatus] = useState<CredentialStatus>(credential?.status ?? 'active')
  const [deactivationReason, setDeactivationReason] = useState(
    credential?.deactivationReason ?? '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const requiresReason = status !== 'active'
  const canSubmit = credential !== null || (!employeesLoading && employees.length > 0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!credential) {
      const normalizedUid = normalizeCardUid(cardUid)
      if (!employeeId) {
        setFormError('Selecciona al empleado titular de la tarjeta.')
        return
      }
      if (!isValidCardUid(normalizedUid)) {
        setFormError(CARD_UID_HINT)
        return
      }
      setSubmitting(true)
      setFormError(null)
      try {
        await api.createCredential({
          employeeId,
          cardUid: normalizedUid,
          label: label.trim() || null,
          // New cards always start active; blocking requires an auditable
          // reason and is only available from the edit flow.
          status: 'active',
        })
        onSaved('Tarjeta RFID registrada correctamente.')
      } catch (err) {
        setFormError(getErrorMessage(err, 'No se pudo registrar la tarjeta RFID.'))
        setSubmitting(false)
      }
      return
    }

    if (requiresReason && !deactivationReason.trim()) {
      setFormError('Indica el motivo de la desactivacion para conservar la trazabilidad.')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await api.updateCredential(credential.id, {
        label: label.trim() || null,
        status,
        deactivationReason: requiresReason ? deactivationReason.trim() : null,
      })
      onSaved(
        status === 'active'
          ? 'Tarjeta RFID reactivada correctamente.'
          : 'Estado de la tarjeta RFID actualizado.',
      )
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo actualizar la tarjeta RFID.'))
      setSubmitting(false)
    }
  }

  const holder = credential ? employeeById.get(credential.employeeId) : undefined

  return (
    <Modal
      title={credential ? 'Editar tarjeta RFID' : 'Registrar tarjeta RFID'}
      description={
        credential
          ? 'Actualiza la etiqueta o desactiva la tarjeta con un motivo verificable. El UID no se puede modificar.'
          : 'El UID se captura del lector fisico. Se normaliza a mayusculas y sin separadores antes de guardarlo.'
      }
      onClose={onClose}
    >
      <form autoComplete="off" onSubmit={(event) => void handleSubmit(event)}>
        <div className="modal-body">
          {formError ? <NoticeBanner variant="error">{formError}</NoticeBanner> : null}

          {credential ? (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">UID de la tarjeta</div>
                <div className="detail-value mono-text" translate="no">
                  {credential.cardUid}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Empleado titular</div>
                <div className="detail-value">
                  {holder
                    ? `${holder.firstName} ${holder.lastName} (${holder.employeeCode})`
                    : 'Empleado no disponible'}
                </div>
              </div>
            </div>
          ) : null}

          <div className="form-grid">
            {!credential ? (
              <div className="form-field">
                <label className="form-label" htmlFor="credential-form-employee">
                  Empleado titular
                </label>
                <select
                  id="credential-form-employee"
                  name="employeeId"
                  className="select-control"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  disabled={employeesLoading}
                  aria-describedby={
                    employeesLoading || employeesError || employees.length === 0
                      ? 'credential-form-employee-hint'
                      : undefined
                  }
                  required
                >
                  <option value="">Selecciona un empleado</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} ({employee.employeeCode})
                    </option>
                  ))}
                </select>
                {employeesError ? (
                  <span className="form-error" id="credential-form-employee-hint">
                    No se pudo cargar el directorio. Cierra la ventana, reintenta y vuelve a abrirla.
                  </span>
                ) : employeesLoading ? (
                  <span className="form-hint" id="credential-form-employee-hint">
                    Cargando empleados disponibles…
                  </span>
                ) : employees.length === 0 ? (
                  <span className="form-error" id="credential-form-employee-hint">
                    No hay empleados registrados. Crea uno antes de asignar tarjetas.
                  </span>
                ) : null}
              </div>
            ) : null}

            {!credential ? (
              <div className="form-field">
                <label className="form-label" htmlFor="credential-form-uid">
                  UID de la tarjeta
                </label>
                <input
                  id="credential-form-uid"
                  name="cardUid"
                  className="input-control mono-text"
                  value={cardUid}
                  onChange={(event) => setCardUid(event.target.value)}
                  placeholder="Ej. 04A1B2C3D4E5F6"
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="characters"
                  aria-describedby="credential-form-uid-hint"
                  required
                />
                <span className="form-hint" id="credential-form-uid-hint">
                  {CARD_UID_HINT} La tarjeta se registra activa; bloqueala o retirala desde la
                  edicion con un motivo verificable.
                </span>
              </div>
            ) : null}

            <div className="form-field">
              <label className="form-label" htmlFor="credential-form-label">
                Etiqueta
              </label>
              <input
                id="credential-form-label"
                name="label"
                className="input-control"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={64}
                placeholder="Tarjeta principal"
                autoComplete="off"
              />
            </div>

            {credential ? (
              <div className="form-field">
                <label className="form-label" htmlFor="credential-form-status">
                  Estado de la tarjeta
                </label>
                <select
                  id="credential-form-status"
                  name="status"
                  className="select-control"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as CredentialStatus)}
                >
                  {CREDENTIAL_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {CREDENTIAL_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {requiresReason ? (
              <div className="form-field form-field-full">
                <label className="form-label" htmlFor="credential-form-reason">
                  Motivo de desactivacion
                </label>
                <textarea
                  id="credential-form-reason"
                  name="deactivationReason"
                  className="input-control"
                  value={deactivationReason}
                  onChange={(event) => setDeactivationReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Describe por que se bloquea, extravia o retira la tarjeta…"
                  autoComplete="off"
                  aria-describedby="credential-form-reason-hint"
                  required
                />
                <span className="form-hint" id="credential-form-reason-hint">
                  Este motivo queda en el historial de la credencial para futuras auditorias.
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !canSubmit}
            aria-busy={submitting}
          >
            {submitting
              ? 'Guardando…'
              : credential
                ? 'Guardar tarjeta'
                : 'Registrar tarjeta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
