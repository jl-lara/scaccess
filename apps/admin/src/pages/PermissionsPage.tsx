import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Ban, KeyRound, Plus } from 'lucide-react'
import type {
  AccessPermissionDto,
  AreaDto,
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
import { formatDateTime } from '../lib/formatters'
import { getErrorMessage, toIsoDate } from '../lib/validation'

const PAGE_SIZE = 20

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

const COUNT_FORMATTER = new Intl.NumberFormat('es-MX')

interface PermissionState {
  label: string
  variant: 'success' | 'info' | 'warning' | 'neutral'
}

function getPermissionState(permission: AccessPermissionDto): PermissionState {
  if (permission.revokedAt) {
    return { label: 'Revocado', variant: 'neutral' }
  }

  const now = Date.now()
  if (permission.validFrom && new Date(permission.validFrom).getTime() > now) {
    return { label: 'Programado', variant: 'info' }
  }
  if (permission.validTo && new Date(permission.validTo).getTime() <= now) {
    return { label: 'Vencido', variant: 'warning' }
  }
  return { label: 'Vigente', variant: 'success' }
}

function formatValidity(permission: AccessPermissionDto): string {
  if (!permission.validFrom && !permission.validTo) {
    return 'Sin limites de vigencia'
  }

  const from = permission.validFrom
    ? `Desde ${formatDateTime(permission.validFrom)}`
    : 'Desde el inicio'
  const to = permission.validTo
    ? `Hasta ${formatDateTime(permission.validTo)}`
    : 'Sin fecha de fin'

  return `${from}. ${to}.`
}

export function PermissionsPage() {
  const { canWriteCatalog } = useAuth()
  const [permissions, setPermissions] = useState<AccessPermissionDto[]>([])
  const [employees, setEmployees] = useState<EmployeeDto[]>([])
  const [areas, setAreas] = useState<AreaDto[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [grantOpen, setGrantOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<AccessPermissionDto | null>(null)

  const loadPermissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [permissionResponse, employeeResponse, areaResponse] = await Promise.all([
        api.listAccessPermissions({
          page,
          pageSize: PAGE_SIZE,
          employeeId: employeeFilter || undefined,
          areaId: areaFilter || undefined,
          activeOnly: activeOnly ? true : undefined,
        }),
        api.listEmployees({ page: 1, pageSize: 100 }),
        api.listAreas({ page: 1, pageSize: 100 }),
      ])
      setPermissions(permissionResponse.data)
      setPagination(permissionResponse.pagination)
      setEmployees(employeeResponse.data)
      setAreas(areaResponse.data)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se pudo cargar la matriz de permisos de acceso. Revisa tu conexion y vuelve a intentarlo.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [page, employeeFilter, areaFilter, activeOnly])

  useEffect(() => {
    void loadPermissions()
  }, [loadPermissions])

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  )
  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas])

  function clearFilters() {
    setEmployeeFilter('')
    setAreaFilter('')
    setActiveOnly(false)
    setPage(1)
  }

  const hasActiveFilters = Boolean(employeeFilter || areaFilter || activeOnly)

  function handleGranted(message: string) {
    setGrantOpen(false)
    setNotice(message)
    if (page !== 1) {
      setPage(1)
    } else {
      void loadPermissions()
    }
  }

  function handleRevoked(message: string) {
    setRevokeTarget(null)
    setNotice(message)
    void loadPermissions()
  }

  function employeeLabel(employeeId: string): { name: string; code: string } {
    const employee = employeeById.get(employeeId)
    if (!employee) {
      return { name: 'Empleado no disponible', code: employeeId.slice(0, 8) }
    }
    return {
      name: `${employee.firstName} ${employee.lastName}`,
      code: employee.employeeCode,
    }
  }

  function areaLabel(areaId: string): { name: string; code: string } {
    const area = areaById.get(areaId)
    if (!area) {
      return { name: 'Area no disponible', code: areaId.slice(0, 8) }
    }
    return { name: area.name, code: area.code }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Permisos de acceso</h1>
          <p className="page-description">
            Relacion entre empleados y areas protegidas. Revocar un permiso actualiza la
            configuracion de los controladores en la siguiente sincronizacion.
          </p>
        </div>
        {canWriteCatalog ? (
          <button type="button" className="btn btn-primary" onClick={() => setGrantOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Otorgar permiso
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

      {error ? (
        <NoticeBanner
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadPermissions()}
            >
              Reintentar
            </button>
          }
        >
          {error}
        </NoticeBanner>
      ) : null}

      <section className="surface-card" aria-label="Matriz de permisos de acceso">
        <div
          className="table-toolbar"
          role="search"
          aria-label="Filtros de permisos de acceso"
        >
          <div className="filter-group">
            <div className="toolbar-field">
              <label className="form-label" htmlFor="permission-employee-filter">
                Empleado
              </label>
              <select
                id="permission-employee-filter"
                name="employeeId"
                className="select-control"
                value={employeeFilter}
                onChange={(event) => {
                  setEmployeeFilter(event.target.value)
                  setPage(1)
                }}
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
              <label className="form-label" htmlFor="permission-area-filter">
                Area
              </label>
              <select
                id="permission-area-filter"
                name="areaId"
                className="select-control"
                value={areaFilter}
                onChange={(event) => {
                  setAreaFilter(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todas las areas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.code})
                  </option>
                ))}
              </select>
            </div>
            <label className="form-row-checkbox" htmlFor="permission-active-filter">
              <input
                id="permission-active-filter"
                name="activeOnly"
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => {
                  setActiveOnly(event.target.checked)
                  setPage(1)
                }}
              />
              Solo permisos sin revocar
            </label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Limpiar
            </button>
          </div>
          <span className="table-meta" role="status" aria-live="polite">
            {loading
              ? 'Actualizando…'
              : `${COUNT_FORMATTER.format(pagination.total)} permisos en total`}
          </span>
        </div>

        <div className="table-wrapper">
          <table className="data-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Empleado</th>
                <th scope="col">Area</th>
                <th scope="col">Vigencia</th>
                <th scope="col">Estado</th>
                <th scope="col">Otorgado</th>
                <th scope="col" className="align-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableMessage
                  colSpan={6}
                  title="Cargando permisos de acceso…"
                  description={COLD_START_HINT}
                />
              ) : permissions.length === 0 ? (
                <TableMessage
                  colSpan={6}
                  title={hasActiveFilters ? 'Sin permisos que coincidan' : 'Sin permisos otorgados'}
                  description={
                    hasActiveFilters
                      ? 'Ajusta o limpia los filtros para ver toda la matriz.'
                      : canWriteCatalog
                        ? 'Otorga el primer permiso para vincular un empleado con un area.'
                        : 'Solicita a un administrador que otorgue el primer permiso.'
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
                      onClick={() => setGrantOpen(true)}
                    >
                      <KeyRound size={14} aria-hidden="true" />
                      Otorgar permiso
                    </button>
                  ) : null}
                </TableMessage>
              ) : (
                permissions.map((permission) => {
                  const employee = employeeLabel(permission.employeeId)
                  const area = areaLabel(permission.areaId)
                  const permissionState = getPermissionState(permission)

                  return (
                    <tr key={permission.id}>
                      <td>
                        <div className="cell-stack">
                          <span className="cell-primary">{employee.name}</span>
                          <span className="cell-secondary mono-text" translate="no">
                            {employee.code}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <span className="cell-primary">{area.name}</span>
                          <span className="mono-code" translate="no">
                            {area.code}
                          </span>
                        </div>
                      </td>
                      <td className="cell-secondary">{formatValidity(permission)}</td>
                      <td>
                        <StatusBadge variant={permissionState.variant}>
                          {permissionState.label}
                        </StatusBadge>
                      </td>
                      <td className="cell-secondary">{formatDateTime(permission.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          {canWriteCatalog && !permission.revokedAt ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => setRevokeTarget(permission)}
                              aria-label={`Revocar permiso de ${employee.name} en ${area.name}`}
                            >
                              <Ban size={14} aria-hidden="true" />
                              Revocar
                            </button>
                          ) : (
                            <span className="cell-secondary">
                              {permission.revokedAt ? 'Sin acciones' : 'Solo lectura'}
                            </span>
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

        {!loading && permissions.length > 0 ? (
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {grantOpen ? (
        <GrantPermissionModal
          employees={employees}
          areas={areas}
          onClose={() => setGrantOpen(false)}
          onSaved={handleGranted}
        />
      ) : null}

      {revokeTarget ? (
        <RevokePermissionModal
          permission={revokeTarget}
          employeeName={employeeLabel(revokeTarget.employeeId).name}
          areaName={areaLabel(revokeTarget.areaId).name}
          onClose={() => setRevokeTarget(null)}
          onRevoked={handleRevoked}
        />
      ) : null}
    </div>
  )
}

interface GrantPermissionModalProps {
  employees: EmployeeDto[]
  areas: AreaDto[]
  onClose: () => void
  onSaved: (message: string) => void
}

function GrantPermissionModal({ employees, areas, onClose, onSaved }: GrantPermissionModalProps) {
  const [employeeId, setEmployeeId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!employeeId || !areaId) {
      setFormError('Selecciona el empleado y el area que quieres vincular.')
      return
    }

    const fromIso = toIsoDate(validFrom)
    const toIso = toIsoDate(validTo)

    if (fromIso && toIso && new Date(toIso).getTime() <= new Date(fromIso).getTime()) {
      setFormError('La fecha de fin debe ser posterior a la fecha de inicio.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      await api.createAccessPermission({
        employeeId,
        areaId,
        validFrom: fromIso,
        validTo: toIso,
      })
      onSaved('Permiso de acceso otorgado correctamente.')
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo otorgar el permiso de acceso.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Otorgar permiso de acceso"
      description="El permiso se aplica al area indicada. Si no defines fechas, permanece vigente hasta que se revoque."
      onClose={onClose}
    >
      <form autoComplete="off" onSubmit={(event) => void handleSubmit(event)}>
        <div className="modal-body">
          {formError ? <NoticeBanner variant="error">{formError}</NoticeBanner> : null}

          {employees.length === 0 || areas.length === 0 ? (
            <NoticeBanner variant="warning">
              Necesitas al menos un empleado y un area registrados antes de otorgar permisos.
            </NoticeBanner>
          ) : null}

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="permission-form-employee">
                Empleado beneficiario
              </label>
              <select
                id="permission-form-employee"
                name="employeeId"
                className="select-control"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                required
              >
                <option value="">Selecciona un empleado</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="permission-form-area">
                Area protegida
              </label>
              <select
                id="permission-form-area"
                name="areaId"
                className="select-control"
                value={areaId}
                onChange={(event) => setAreaId(event.target.value)}
                required
              >
                <option value="">Selecciona un area</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="permission-form-from">
                Vigente desde
              </label>
              <input
                id="permission-form-from"
                name="validFrom"
                className="input-control"
                type="date"
                value={validFrom}
                onChange={(event) => setValidFrom(event.target.value)}
                autoComplete="off"
                aria-describedby="permission-form-from-hint"
              />
              <span className="form-hint" id="permission-form-from-hint">
                Opcional. Se interpreta al inicio del dia local.
              </span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="permission-form-to">
                Vigente hasta
              </label>
              <input
                id="permission-form-to"
                name="validTo"
                className="input-control"
                type="date"
                value={validTo}
                onChange={(event) => setValidTo(event.target.value)}
                autoComplete="off"
                aria-describedby="permission-form-to-hint"
              />
              <span className="form-hint" id="permission-form-to-hint">
                Opcional. Sin fecha de fin, el permiso no expira.
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || employees.length === 0 || areas.length === 0}
            aria-busy={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar permiso'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface RevokePermissionModalProps {
  permission: AccessPermissionDto
  employeeName: string
  areaName: string
  onClose: () => void
  onRevoked: (message: string) => void
}

function RevokePermissionModal({
  permission,
  employeeName,
  areaName,
  onClose,
  onRevoked,
}: RevokePermissionModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleRevoke() {
    setSubmitting(true)
    setFormError(null)
    try {
      await api.revokeAccessPermission(permission.id)
      onRevoked('Permiso revocado. El historial de accesos se conserva intacto.')
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo revocar el permiso de acceso.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Revocar permiso de acceso"
      description="El permiso deja de ser valido de inmediato. Los eventos ya registrados no se modifican."
      onClose={onClose}
    >
      {formError ? <NoticeBanner variant="error">{formError}</NoticeBanner> : null}

      <div className="detail-grid">
        <div className="detail-item">
          <div className="detail-label">Empleado</div>
          <div className="detail-value">{employeeName}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Area</div>
          <div className="detail-value">{areaName}</div>
        </div>
      </div>

      <p className="modal-warning">
        Esta accion no elimina el registro del permiso: lo marca como revocado con la fecha actual.
      </p>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => void handleRevoke()}
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Revocando…' : 'Confirmar revocacion'}
        </button>
      </div>
    </Modal>
  )
}
