import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, ShieldAlert } from 'lucide-react'
import type {
  AccountStatus,
  EmployeeDto,
  PaginationMeta,
  RoleDto,
  UserAccountDto,
} from '@scaccess/shared'
import { Modal } from '../components/ui/Modal'
import { NoticeBanner } from '../components/ui/NoticeBanner'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT, TableMessage } from '../components/ui/TableMessage'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS, formatDateTime } from '../lib/formatters'
import { getErrorMessage, isValidUuid } from '../lib/validation'

const PAGE_SIZE = 20
const ACCOUNT_STATUSES: AccountStatus[] = ['active', 'disabled']

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

const COUNT_FORMATTER = new Intl.NumberFormat('es-MX')

type UserModalState = { mode: 'create' } | { mode: 'edit'; user: UserAccountDto } | null

export function UsersPage() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState<UserAccountDto[]>([])
  const [roles, setRoles] = useState<RoleDto[]>([])
  const [employees, setEmployees] = useState<EmployeeDto[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<AccountStatus | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [modal, setModal] = useState<UserModalState>(null)

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [userResponse, roleResponse, employeeResponse] = await Promise.all([
        api.listUsers({
          page,
          pageSize: PAGE_SIZE,
          status: statusFilter || undefined,
          search: appliedSearch || undefined,
        }),
        api.listRoles(),
        api.listEmployees({ page: 1, pageSize: 100 }),
      ])
      setUsers(userResponse.data)
      setPagination(userResponse.pagination)
      setRoles(roleResponse)
      setEmployees(employeeResponse.data)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se pudo cargar la administracion de cuentas. Revisa tu conexion y vuelve a intentarlo.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [isAdmin, page, statusFilter, appliedSearch])

  useEffect(() => {
    if (!isAdmin) {
      return
    }
    void loadUsers()
  }, [isAdmin, loadUsers])

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  )

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setAppliedSearch(searchInput.trim())
  }

  function clearFilters() {
    setStatusFilter('')
    setSearchInput('')
    setAppliedSearch('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(statusFilter || appliedSearch)

  function handleSaved(message: string) {
    const wasCreate = modal?.mode === 'create'
    setModal(null)
    setNotice(message)
    if (wasCreate && page !== 1) {
      setPage(1)
    } else {
      void loadUsers()
    }
  }

  if (!isAdmin) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h1 className="page-title">Cuentas y roles</h1>
            <p className="page-description">
              Administracion de cuentas de acceso y roles.
            </p>
          </div>
        </div>
        <section className="surface-card access-denied" aria-label="Permisos insuficientes">
          <ShieldAlert size={28} aria-hidden="true" />
          <h2 className="surface-card-title">Permisos insuficientes</h2>
          <p>
            Solo una cuenta con rol Administrador puede gestionar cuentas, roles y vinculos con
            empleados. Tu sesion no tiene ese privilegio.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuentas y roles</h1>
          <p className="page-description">
            Administracion de cuentas de acceso y roles.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModal({ mode: 'create' })}
          disabled={loading}
        >
          <Plus size={16} aria-hidden="true" />
          Nueva cuenta
        </button>
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
              onClick={() => void loadUsers()}
            >
              Reintentar
            </button>
          }
        >
          {error}
        </NoticeBanner>
      ) : null}

      <section className="surface-card" aria-label="Cuentas administrativas">
        <form
          className="table-toolbar"
          role="search"
          aria-label="Filtros de cuentas"
          autoComplete="off"
          onSubmit={handleFilterSubmit}
        >
          <div className="filter-group">
            <div className="toolbar-field">
              <label className="form-label" htmlFor="user-search">
                Buscar cuenta
              </label>
              <input
                id="user-search"
                name="userSearch"
                className="input-control"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Correo, nombre o codigo de empleado…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="toolbar-field">
              <label className="form-label" htmlFor="user-status-filter">
                Filtrar por estado
              </label>
              <select
                id="user-status-filter"
                name="userStatus"
                className="select-control"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as AccountStatus | '')
                  setPage(1)
                }}
              >
                <option value="">Todos los estados</option>
                {ACCOUNT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ACCOUNT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
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
              : `${COUNT_FORMATTER.format(pagination.total)} cuentas en total`}
          </span>
        </form>

        <div className="table-wrapper">
          <table className="data-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col">Empleado vinculado</th>
                <th scope="col">Roles</th>
                <th scope="col">Estado</th>
                <th scope="col">Ultimo acceso</th>
                <th scope="col" className="align-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableMessage
                  colSpan={6}
                  title="Cargando cuentas…"
                  description={COLD_START_HINT}
                />
              ) : users.length === 0 ? (
                <TableMessage
                  colSpan={6}
                  title={hasActiveFilters ? 'Sin cuentas que coincidan' : 'Sin cuentas registradas'}
                  description={
                    hasActiveFilters
                      ? 'Ajusta o limpia los filtros para ver todas las cuentas.'
                      : 'Crea la primera cuenta vinculada a Supabase Auth y asigna un rol.'
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
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setModal({ mode: 'create' })}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Crear cuenta
                    </button>
                  )}
                </TableMessage>
              ) : (
                users.map((user) => {
                  const employee = user.employeeId
                    ? employeeById.get(user.employeeId)
                    : undefined

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="cell-stack">
                          <span className="cell-primary">{user.email}</span>
                          <span className="cell-secondary mono-text" translate="no">
                            Auth {user.authUserId.slice(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td>
                        {employee ? (
                          <div className="cell-stack">
                            <span>
                              {employee.firstName} {employee.lastName}
                            </span>
                            <span className="cell-secondary mono-text" translate="no">
                              {employee.employeeCode}
                            </span>
                          </div>
                        ) : (
                          <span className="cell-secondary">Sin empleado vinculado</span>
                        )}
                      </td>
                      <td>
                        <div className="badge-list">
                          {user.roles.length === 0 ? (
                            <span className="cell-secondary">Sin roles</span>
                          ) : (
                            user.roles.map((roleCode) => (
                              <StatusBadge key={roleCode} variant="info">
                                {ROLE_LABELS[roleCode] ?? roleCode}
                              </StatusBadge>
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        <StatusBadge variant={user.status === 'active' ? 'success' : 'neutral'}>
                          {ACCOUNT_STATUS_LABELS[user.status]}
                        </StatusBadge>
                      </td>
                      <td className="cell-secondary">{formatDateTime(user.lastLoginAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setModal({ mode: 'edit', user })}
                            aria-label={`Editar cuenta ${user.email}`}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Editar
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

        {!loading && users.length > 0 ? (
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
        <UserFormModal
          user={modal.mode === 'edit' ? modal.user : null}
          roles={roles}
          employees={employees}
          employeeById={employeeById}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}

interface UserFormModalProps {
  user: UserAccountDto | null
  roles: RoleDto[]
  employees: EmployeeDto[]
  employeeById: Map<string, EmployeeDto>
  onClose: () => void
  onSaved: (message: string) => void
}

function UserFormModal({
  user,
  roles,
  employees,
  employeeById,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const [authUserId, setAuthUserId] = useState(user?.authUserId ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [employeeId, setEmployeeId] = useState(user?.employeeId ?? '')
  const [status, setStatus] = useState<AccountStatus>(user?.status ?? 'active')
  const [roleCodes, setRoleCodes] = useState<string[]>(() => {
    if (user) {
      return user.roles
    }
    return roles.some((role) => role.code === 'auditor') ? ['auditor'] : []
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const linkedEmployee = user?.employeeId ? employeeById.get(user.employeeId) : undefined

  function toggleRole(roleCode: string) {
    setRoleCodes((current) =>
      current.includes(roleCode)
        ? current.filter((code) => code !== roleCode)
        : [...current, roleCode],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user) {
      if (!isValidUuid(authUserId)) {
        setFormError('Captura el UUID de la cuenta creada en Supabase Auth.')
        return
      }
      if (!email.trim()) {
        setFormError('El correo de la cuenta es obligatorio.')
        return
      }
    }

    if (roleCodes.length === 0) {
      setFormError('Asigna al menos un rol administrativo a la cuenta.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      if (user) {
        await api.updateUser(user.id, {
          status,
          employeeId: employeeId || null,
          roleCodes,
        })
        onSaved('Cuenta actualizada correctamente.')
      } else {
        await api.createUser({
          authUserId: authUserId.trim(),
          email: email.trim(),
          employeeId: employeeId || null,
          status,
          roleCodes,
        })
        onSaved('Cuenta creada correctamente.')
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la cuenta.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={user ? 'Editar cuenta' : 'Nueva cuenta'}
      description={
        user
          ? 'Actualiza el estado, el empleado vinculado o los roles. El correo y la identidad de Supabase Auth no se modifican desde aqui.'
          : 'La cuenta debe existir primero en Supabase Auth. Captura su UUID para vincularla con esta consola.'
      }
      size="wide"
      onClose={onClose}
    >
      <form autoComplete="off" onSubmit={(event) => void handleSubmit(event)}>
        <div className="modal-body">
          {formError ? <NoticeBanner variant="error">{formError}</NoticeBanner> : null}

          {user ? (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">Correo de la cuenta</div>
                <div className="detail-value">{user.email}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">UUID de Supabase Auth</div>
                <div className="detail-value mono-text" translate="no">
                  {user.authUserId}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Empleado vinculado</div>
                <div className="detail-value">
                  {linkedEmployee
                    ? `${linkedEmployee.firstName} ${linkedEmployee.lastName} (${linkedEmployee.employeeCode})`
                    : 'Sin empleado vinculado'}
                </div>
              </div>
            </div>
          ) : null}

          <div className="form-grid">
            {!user ? (
              <>
                <div className="form-field">
                  <label className="form-label" htmlFor="user-form-auth-id">
                    UUID de Supabase Auth
                  </label>
                  <input
                    id="user-form-auth-id"
                    name="authUserId"
                    className="input-control mono-text"
                    value={authUserId}
                    onChange={(event) => setAuthUserId(event.target.value)}
                    placeholder="00000000-0000-4000-8000-000000000000"
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby="user-form-auth-id-hint"
                    required
                  />
                  <span className="form-hint" id="user-form-auth-id-hint">
                    No es el correo ni el identificador interno de esta consola.
                  </span>
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="user-form-email">
                    Correo electronico
                  </label>
                  <input
                    id="user-form-email"
                    name="email"
                    className="input-control"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={320}
                    placeholder="persona@institucion.edu.mx"
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </div>
              </>
            ) : null}

            <div className="form-field">
              <label className="form-label" htmlFor="user-form-employee">
                Empleado vinculado
              </label>
              <select
                id="user-form-employee"
                name="employeeId"
                className="select-control"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                aria-describedby="user-form-employee-hint"
              >
                <option value="">Sin empleado vinculado</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
              <span className="form-hint" id="user-form-employee-hint">
                El vinculo permite relacionar la cuenta con su historial personal.
              </span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="user-form-status">
                Estado de la cuenta
              </label>
              <select
                id="user-form-status"
                name="status"
                className="select-control"
                value={status}
                onChange={(event) => setStatus(event.target.value as AccountStatus)}
              >
                {ACCOUNT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {ACCOUNT_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="form-field form-field-full"
              role="group"
              aria-labelledby="user-form-roles-label"
              aria-describedby="user-form-roles-hint"
            >
              <span className="form-label" id="user-form-roles-label">
                Roles administrativos
              </span>
              {roles.length === 0 ? (
                <span className="form-error">
                  No se pudieron cargar los roles disponibles. Cierra la ventana y reintenta.
                </span>
              ) : (
                <div className="checkbox-grid">
                  {roles.map((role) => (
                    <label
                      key={role.code}
                      className="checkbox-item"
                      htmlFor={`user-role-${role.code}`}
                    >
                      <input
                        id={`user-role-${role.code}`}
                        name="roleCodes"
                        type="checkbox"
                        value={role.code}
                        checked={roleCodes.includes(role.code)}
                        onChange={() => toggleRole(role.code)}
                      />
                      <span className="checkbox-copy">
                        <span>{role.name}</span>
                        <span className="cell-secondary mono-text" translate="no">
                          {role.code}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <span className="form-hint" id="user-form-roles-hint">
                Administrador y Operador pueden modificar el catalogo; Auditor solo consulta. El
                servidor valida el rol en cada solicitud.
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
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar cuenta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
