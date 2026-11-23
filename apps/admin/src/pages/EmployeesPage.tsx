import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { EmployeeDto, EmployeeStatus, PaginationMeta } from '@scaccess/shared'
import { Modal } from '../components/ui/Modal'
import { NoticeBanner } from '../components/ui/NoticeBanner'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT, TableMessage } from '../components/ui/TableMessage'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { EMPLOYEE_STATUS_LABELS, formatCount, formatDateTime } from '../lib/formatters'
import {
  getErrorMessage,
  hasLetters,
  isValidEmail,
  isValidEmployeeCode,
  isValidPersonName,
  suggestNextEmployeeCode,
} from '../lib/validation'

const PAGE_SIZE = 20
const EMPLOYEE_STATUSES: EmployeeStatus[] = ['active', 'inactive', 'suspended']

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

type EmployeeModalState = { mode: 'create' } | { mode: 'edit'; employee: EmployeeDto } | null

function employeeBadgeVariant(status: EmployeeStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'warning'
  return 'neutral'
}

export function EmployeesPage() {
  const { canWriteCatalog } = useAuth()
  const [employees, setEmployees] = useState<EmployeeDto[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | ''>('')
  const [departmentInput, setDepartmentInput] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [appliedDepartment, setAppliedDepartment] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [modal, setModal] = useState<EmployeeModalState>(null)

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listEmployees({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        department: appliedDepartment || undefined,
        search: appliedSearch || undefined,
      })
      setEmployees(response.data)
      setPagination(response.pagination)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se pudo cargar el directorio de empleados. Revisa tu conexión y vuelve a intentarlo.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, appliedDepartment, appliedSearch])

  useEffect(() => {
    void loadEmployees()
  }, [loadEmployees])

  useEffect(() => {
    const trimmedSearch = searchInput.trim()
    const trimmedDepartment = departmentInput.trim()
    if (trimmedSearch === appliedSearch && trimmedDepartment === appliedDepartment) {
      return
    }
    const timer = setTimeout(() => {
      setPage(1)
      setAppliedSearch(trimmedSearch)
      setAppliedDepartment(trimmedDepartment)
    }, 350)

    return () => clearTimeout(timer)
  }, [searchInput, departmentInput, appliedSearch, appliedDepartment])

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(employees.flatMap((employee) => (employee.department ? [employee.department] : []))),
      ).toSorted((a, b) => a.localeCompare(b)),
    [employees],
  )

  const suggestedEmployeeCode = useMemo(() => suggestNextEmployeeCode(employees), [employees])

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setAppliedDepartment(departmentInput.trim())
    setAppliedSearch(searchInput.trim())
  }

  function clearFilters() {
    setStatusFilter('')
    setDepartmentInput('')
    setSearchInput('')
    setAppliedDepartment('')
    setAppliedSearch('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(statusFilter || appliedDepartment || appliedSearch)

  function handleSaved(message: string) {
    const wasCreate = modal?.mode === 'create'
    setModal(null)
    setNotice(message)
    if (wasCreate && page !== 1) {
      setPage(1)
    } else {
      void loadEmployees()
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Empleados</h1>
          <p className="page-description">
            Directorio de personal acreditado y estado operativo.
          </p>
        </div>
        {canWriteCatalog ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'create' })}
          >
            <Plus size={16} aria-hidden="true" />
            Nuevo empleado
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
              onClick={() => void loadEmployees()}
            >
              Reintentar
            </button>
          }
        >
          {error}
        </NoticeBanner>
      ) : null}

      <section className="surface-card" aria-label="Directorio de empleados">
        <form
          className="table-toolbar"
          role="search"
          aria-label="Filtros de empleados"
          autoComplete="off"
          noValidate
          onSubmit={handleFilterSubmit}
        >
          <div className="filter-group">
            <div className="toolbar-field">
              <label className="form-label" htmlFor="employee-search">
                Buscar
              </label>
              <input
                id="employee-search"
                name="employeeSearch"
                className="input-control"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nombre, código o correo…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="toolbar-field">
              <label className="form-label" htmlFor="employee-status-filter">
                Filtrar por estado
              </label>
              <select
                id="employee-status-filter"
                name="employeeStatus"
                className="select-control"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as EmployeeStatus | '')
                  setPage(1)
                }}
              >
                <option value="">Todos los estados</option>
                {EMPLOYEE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {EMPLOYEE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar-field">
              <label className="form-label" htmlFor="employee-department-filter">
                Departamento
              </label>
              <input
                id="employee-department-filter"
                name="employeeDepartment"
                className="input-control"
                type="text"
                list="employee-department-options"
                value={departmentInput}
                onChange={(event) => setDepartmentInput(event.target.value)}
                placeholder="Ej. Mantenimiento"
                autoComplete="off"
              />
              <datalist id="employee-department-options">
                {departmentOptions.map((department) => (
                  <option key={department} value={department} />
                ))}
              </datalist>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Limpiar
            </button>
          </div>
          <span className="table-meta" role="status" aria-live="polite">
            {loading
              ? 'Actualizando…'
              : `${formatCount(pagination.total, 'empleado', 'empleados')} en total`}
          </span>
        </form>

        <div className="table-wrapper">
          <table className="data-table responsive-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Empleado</th>
                <th scope="col">Contacto y adscripción</th>
                <th scope="col">Estado</th>
                <th scope="col">Actualizado</th>
                <th scope="col" className="align-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableMessage
                  colSpan={5}
                  title="Cargando empleados…"
                  description={COLD_START_HINT}
                />
              ) : employees.length === 0 ? (
                <TableMessage
                  colSpan={5}
                  title={hasActiveFilters ? 'Sin empleados que coincidan' : 'Sin empleados registrados'}
                  description={
                    hasActiveFilters
                      ? 'Ajusta o limpia los filtros para ver todo el directorio.'
                      : canWriteCatalog
                        ? 'Registra al primer empleado para comenzar a controlar accesos.'
                        : 'Solicita a un administrador que registre el primer empleado.'
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
                      Registrar empleado
                    </button>
                  ) : null}
                </TableMessage>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id}>
                    <td data-label="Empleado">
                      <div className="cell-stack">
                        <span className="cell-primary">
                          {employee.firstName} {employee.lastName}
                        </span>
                        <span className="mono-code" translate="no">
                          {employee.employeeCode}
                        </span>
                      </div>
                    </td>
                    <td data-label="Contacto y adscripción">
                      <div className="cell-stack">
                        <span>{employee.email ?? 'Sin correo registrado'}</span>
                        <span className="cell-secondary">
                          {employee.department ?? 'Sin departamento'} /{' '}
                          {employee.position ?? 'Sin puesto'}
                        </span>
                      </div>
                    </td>
                    <td data-label="Estado">
                      <StatusBadge variant={employeeBadgeVariant(employee.status)}>
                        {EMPLOYEE_STATUS_LABELS[employee.status]}
                      </StatusBadge>
                    </td>
                    <td data-label="Actualizado" className="cell-secondary">
                      {formatDateTime(employee.updatedAt)}
                    </td>
                    <td data-label="Acciones">
                      <div className="row-actions">
                        {canWriteCatalog ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setModal({ mode: 'edit', employee })}
                            aria-label={`Editar empleado ${employee.firstName} ${employee.lastName}`}
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && employees.length > 0 ? (
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
        <EmployeeFormModal
          employee={modal.mode === 'edit' ? modal.employee : null}
          suggestedCode={suggestedEmployeeCode}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}

interface EmployeeFormModalProps {
  employee: EmployeeDto | null
  suggestedCode: string
  onClose: () => void
  onSaved: (message: string) => void
}

function EmployeeFormModal({
  employee,
  suggestedCode,
  onClose,
  onSaved,
}: EmployeeFormModalProps) {
  const [employeeCode, setEmployeeCode] = useState(employee?.employeeCode ?? suggestedCode)
  const [firstName, setFirstName] = useState(employee?.firstName ?? '')
  const [lastName, setLastName] = useState(employee?.lastName ?? '')
  const [email, setEmail] = useState(employee?.email ?? '')
  const [department, setDepartment] = useState(employee?.department ?? '')
  const [position, setPosition] = useState(employee?.position ?? '')
  const [status, setStatus] = useState<EmployeeStatus>(employee?.status ?? 'active')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedCode = employeeCode.trim()
    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    const trimmedEmail = email.trim()
    const trimmedDept = department.trim()
    const trimmedPos = position.trim()

    if (!trimmedCode || !trimmedFirst || !trimmedLast) {
      setFormError('Completa el código, el nombre y los apellidos.')
      return
    }
    if (!isValidEmployeeCode(trimmedCode)) {
      setFormError(
        'El código de empleado debe incluir letras y solo usar letras, números, guiones o guion bajo (ej. EMP-001).',
      )
      return
    }
    if (!isValidPersonName(trimmedFirst) || !isValidPersonName(trimmedLast)) {
      setFormError('El nombre y los apellidos solo pueden contener letras y espacios (sin números).')
      return
    }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setFormError('Ingresa un correo electrónico válido.')
      return
    }
    if (trimmedDept && !hasLetters(trimmedDept)) {
      setFormError('El departamento debe contener al menos una letra.')
      return
    }
    if (trimmedPos && !hasLetters(trimmedPos)) {
      setFormError('El puesto debe contener al menos una letra.')
      return
    }

    const payload = {
      employeeCode: trimmedCode,
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: trimmedEmail || null,
      department: trimmedDept || null,
      position: trimmedPos || null,
      status,
    }

    setSubmitting(true)
    setFormError(null)

    try {
      if (employee) {
        await api.updateEmployee(employee.id, payload)
        onSaved('Empleado actualizado correctamente.')
      } else {
        await api.createEmployee(payload)
        onSaved('Empleado registrado correctamente.')
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el empleado.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={employee ? 'Editar empleado' : 'Nuevo empleado'}
      description={
        employee
          ? 'Los cambios aplican de inmediato a la validación de accesos y a la próxima sincronización de los controladores.'
          : 'Registra a la persona con su código institucional. Podrás vincular una tarjeta RFID después.'
      }
      onClose={onClose}
    >
      <form autoComplete="off" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="modal-body">
          {formError ? <NoticeBanner variant="error">{formError}</NoticeBanner> : null}

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="employee-form-code">
                Código de empleado
              </label>
              <input
                id="employee-form-code"
                name="employeeCode"
                className="input-control mono-text"
                value={employeeCode}
                onChange={(event) => setEmployeeCode(event.target.value)}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="employee-form-code-hint"
                required
              />
              <span className="form-hint" id="employee-form-code-hint">
                {employee
                  ? 'Identificador interno único, por ejemplo EMP-001.'
                  : `Sugerencia consecutiva (${suggestedCode}); puedes editarlo si usas otro código institucional.`}
              </span>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="employee-form-status">
                Estado del empleado
              </label>
              <select
                id="employee-form-status"
                name="employeeStatus"
                className="select-control"
                value={status}
                onChange={(event) => setStatus(event.target.value as EmployeeStatus)}
              >
                {EMPLOYEE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {EMPLOYEE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="employee-form-first-name">
                Nombre(s)
              </label>
              <input
                id="employee-form-first-name"
                name="firstName"
                className="input-control"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                maxLength={100}
                autoComplete="off"
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="employee-form-last-name">
                Apellidos
              </label>
              <input
                id="employee-form-last-name"
                name="lastName"
                className="input-control"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                maxLength={100}
                autoComplete="off"
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="employee-form-email">
                Correo electrónico
              </label>
              <input
                id="employee-form-email"
                name="email"
                className="input-control"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
                placeholder="persona@institucion.edu.mx"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="employee-form-department">
                Departamento
              </label>
              <input
                id="employee-form-department"
                name="department"
                className="input-control"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                maxLength={100}
                autoComplete="off"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="employee-form-position">
                Puesto
              </label>
              <input
                id="employee-form-position"
                name="position"
                className="input-control"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                maxLength={100}
                autoComplete="off"
              />
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
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar empleado'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
