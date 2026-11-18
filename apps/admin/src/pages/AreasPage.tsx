import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import type { AreaDto, PaginationMeta } from '@scaccess/shared'
import { AreasFloorPlan } from '../components/areas/AreasFloorPlan'
import { Modal } from '../components/ui/Modal'
import { NoticeBanner } from '../components/ui/NoticeBanner'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT, TableMessage } from '../components/ui/TableMessage'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/formatters'
import { getErrorMessage } from '../lib/validation'

const PAGE_SIZE = 20
const DEFAULT_TIMEZONE = 'America/Tijuana'

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

const COUNT_FORMATTER = new Intl.NumberFormat('es-MX')

type ActiveFilter = '' | 'true' | 'false'
type AreasSection = 'catalog' | 'floorplan' | 'simulator'
type AreaModalState = { mode: 'create' } | { mode: 'edit'; area: AreaDto } | null

export function AreasPage() {
  const { isAdmin } = useAuth()
  const [activeSection, setActiveSection] = useState<AreasSection>('catalog')
  const [areas, setAreas] = useState<AreaDto[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [modal, setModal] = useState<AreaModalState>(null)

  const loadAreas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listAreas({
        page,
        pageSize: PAGE_SIZE,
        isActive: activeFilter === '' ? undefined : activeFilter === 'true',
        search: appliedSearch || undefined,
      })
      setAreas(response.data)
      setPagination(response.pagination)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se pudo cargar el catalogo de areas protegidas. Revisa tu conexion y vuelve a intentarlo.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [page, activeFilter, appliedSearch])

  useEffect(() => {
    void loadAreas()
  }, [loadAreas])

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setAppliedSearch(searchInput.trim())
  }

  function clearFilters() {
    setActiveFilter('')
    setSearchInput('')
    setAppliedSearch('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(activeFilter || appliedSearch)

  function handleSaved(message: string) {
    const wasCreate = modal?.mode === 'create'
    setModal(null)
    setNotice(message)
    if (wasCreate && page !== 1) {
      setPage(1)
    } else {
      void loadAreas()
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Areas fisicas</h1>
          <p className="page-description">
            Zonas protegidas por controladores ESP32-S3, ocupacion en vivo y simulacion de accesos.
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'create' })}
          >
            <Plus size={16} aria-hidden="true" />
            Nueva area
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
              onClick={() => void loadAreas()}
            >
              Reintentar
            </button>
          }
        >
          {error}
        </NoticeBanner>
      ) : null}

      {!isAdmin ? (
        <NoticeBanner variant="warning">
          Puedes consultar el catalogo, pero solo un administrador puede crear o modificar areas.
        </NoticeBanner>
      ) : null}

      <div className="section-tabs" role="tablist" aria-label="Secciones de areas fisicas">
        <button
          type="button"
          role="tab"
          id="tab-areas-catalog"
          aria-selected={activeSection === 'catalog'}
          aria-controls="panel-areas-catalog"
          className={`section-tab${activeSection === 'catalog' ? ' is-active' : ''}`}
          onClick={() => setActiveSection('catalog')}
        >
          Catalogo de areas
        </button>
        <button
          type="button"
          role="tab"
          id="tab-areas-floorplan"
          aria-selected={activeSection === 'floorplan'}
          aria-controls="panel-areas-floorplan"
          className={`section-tab${activeSection === 'floorplan' ? ' is-active' : ''}`}
          onClick={() => setActiveSection('floorplan')}
        >
          Croquis en vivo
        </button>
        <button
          type="button"
          role="tab"
          id="tab-areas-simulator"
          aria-selected={activeSection === 'simulator'}
          aria-controls="panel-areas-simulator"
          className={`section-tab${activeSection === 'simulator' ? ' is-active' : ''}`}
          onClick={() => setActiveSection('simulator')}
        >
          Simulador de accesos
        </button>
      </div>

      {activeSection === 'catalog' ? (
        <div id="panel-areas-catalog" role="tabpanel" aria-labelledby="tab-areas-catalog">
          <section className="surface-card" aria-label="Catalogo de areas">
        <form
          className="table-toolbar"
          role="search"
          aria-label="Filtros de areas"
          autoComplete="off"
          onSubmit={handleFilterSubmit}
        >
          <div className="filter-group">
            <div className="toolbar-field">
              <label className="form-label" htmlFor="area-search">
                Buscar
              </label>
              <input
                id="area-search"
                name="areaSearch"
                className="input-control"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nombre o codigo del area…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="toolbar-field">
              <label className="form-label" htmlFor="area-active-filter">
                Filtrar por estado
              </label>
              <select
                id="area-active-filter"
                name="areaActive"
                className="select-control"
                value={activeFilter}
                onChange={(event) => {
                  setActiveFilter(event.target.value as ActiveFilter)
                  setPage(1)
                }}
              >
                <option value="">Todas las areas</option>
                <option value="true">Solo activas</option>
                <option value="false">Solo inactivas</option>
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
            {loading ? 'Actualizando…' : `${COUNT_FORMATTER.format(pagination.total)} areas en total`}
          </span>
        </form>

        <div className="table-wrapper">
          <table className="data-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Descripcion</th>
                <th scope="col">Zona horaria</th>
                <th scope="col">Estado</th>
                <th scope="col">Actualizada</th>
                <th scope="col" className="align-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableMessage
                  colSpan={6}
                  title="Cargando areas protegidas…"
                  description={COLD_START_HINT}
                />
              ) : areas.length === 0 ? (
                <TableMessage
                  colSpan={6}
                  title={hasActiveFilters ? 'Sin areas que coincidan' : 'Sin areas registradas'}
                  description={
                    hasActiveFilters
                      ? 'Ajusta o limpia los filtros para ver todo el catalogo.'
                      : isAdmin
                        ? 'Crea la primera area protegida y define su zona horaria.'
                        : 'Solicita a un administrador que cree la primera area protegida.'
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
                  ) : isAdmin ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setModal({ mode: 'create' })}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Crear area
                    </button>
                  ) : null}
                </TableMessage>
              ) : (
                areas.map((area) => (
                  <tr key={area.id}>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-primary">{area.name}</span>
                        <span className="mono-code" translate="no">
                          {area.code}
                        </span>
                      </div>
                    </td>
                    <td className="cell-secondary">
                      {area.description ?? 'Sin descripcion'}
                    </td>
                    <td className="mono-text" translate="no">
                      {area.timezone}
                    </td>
                    <td>
                      <StatusBadge variant={area.isActive ? 'success' : 'neutral'}>
                        {area.isActive ? 'Activa' : 'Inactiva'}
                      </StatusBadge>
                    </td>
                    <td className="cell-secondary">{formatDateTime(area.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        {isAdmin ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setModal({ mode: 'edit', area })}
                            aria-label={`Editar area ${area.name}`}
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

        {!loading && areas.length > 0 ? (
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        ) : null}
          </section>
        </div>
      ) : null}

      {activeSection === 'floorplan' ? (
        <div id="panel-areas-floorplan" role="tabpanel" aria-labelledby="tab-areas-floorplan">
          {/* El croquis consulta eventos y empleados por su cuenta con guardas para mocks antiguos. */}
          <AreasFloorPlan areas={areas} mode="floorplan" />
        </div>
      ) : null}

      {activeSection === 'simulator' ? (
        <div id="panel-areas-simulator" role="tabpanel" aria-labelledby="tab-areas-simulator">
          <AreasFloorPlan areas={areas} mode="simulator" />
        </div>
      ) : null}

      {modal ? (
        <AreaFormModal
          area={modal.mode === 'edit' ? modal.area : null}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}

interface AreaFormModalProps {
  area: AreaDto | null
  onClose: () => void
  onSaved: (message: string) => void
}

function AreaFormModal({ area, onClose, onSaved }: AreaFormModalProps) {
  const [code, setCode] = useState(area?.code ?? '')
  const [name, setName] = useState(area?.name ?? '')
  const [description, setDescription] = useState(area?.description ?? '')
  const [timezone, setTimezone] = useState(area?.timezone ?? DEFAULT_TIMEZONE)
  const [isActive, setIsActive] = useState(area?.isActive ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!area && !code.trim()) {
      setFormError('El codigo del area es obligatorio.')
      return
    }
    if (!name.trim()) {
      setFormError('El nombre del area es obligatorio.')
      return
    }
    if (!timezone.trim()) {
      setFormError('La zona horaria IANA es obligatoria, por ejemplo America/Tijuana.')
      return
    }

    try {
      new Intl.DateTimeFormat('es-MX', { timeZone: timezone.trim() })
    } catch {
      setFormError(
        'La zona horaria no es valida. Usa un identificador IANA, por ejemplo America/Tijuana.',
      )
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      if (area) {
        await api.updateArea(area.id, {
          name: name.trim(),
          description: description.trim() || null,
          timezone: timezone.trim(),
          isActive,
        })
        onSaved('Area actualizada correctamente.')
      } else {
        await api.createArea({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || null,
          timezone: timezone.trim(),
          isActive,
        })
        onSaved('Area creada correctamente.')
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el area.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={area ? 'Editar area' : 'Nueva area'}
      description={
        area
          ? 'El codigo es inmutable porque los controladores lo usan como referencia. Puedes ajustar el nombre, la zona horaria y el estado.'
          : 'El codigo identifica el area en la configuracion de los controladores. Usa un valor corto y estable.'
      }
      onClose={onClose}
    >
      <form autoComplete="off" onSubmit={(event) => void handleSubmit(event)}>
        <div className="modal-body">
          {formError ? <NoticeBanner variant="error">{formError}</NoticeBanner> : null}

          {area ? (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">Codigo del area</div>
                <div className="detail-value mono-text" translate="no">
                  {area.code}
                </div>
              </div>
            </div>
          ) : null}

          <div className="form-grid">
            {!area ? (
              <div className="form-field">
                <label className="form-label" htmlFor="area-form-code">
                  Codigo del area
                </label>
                <input
                  id="area-form-code"
                  name="code"
                  className="input-control mono-text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={32}
                  placeholder="MAIN_ENTRANCE"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="area-form-code-hint"
                  required
                />
                <span className="form-hint" id="area-form-code-hint">
                  Se guarda en mayusculas y no se puede cambiar.
                </span>
              </div>
            ) : null}

            <div className="form-field">
              <label className="form-label" htmlFor="area-form-name">
                Nombre del area
              </label>
              <input
                id="area-form-name"
                name="name"
                className="input-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={128}
                autoComplete="off"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="area-form-timezone">
                Zona horaria
              </label>
              <input
                id="area-form-timezone"
                name="timezone"
                className="input-control mono-text"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                maxLength={64}
                placeholder="America/Tijuana"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="area-form-timezone-hint"
                required
              />
              <span className="form-hint" id="area-form-timezone-hint">
                Identificador IANA, por ejemplo America/Tijuana.
              </span>
            </div>

            <div className="form-field form-field-full">
              <label className="form-label" htmlFor="area-form-description">
                Descripcion
              </label>
              <textarea
                id="area-form-description"
                name="description"
                className="input-control"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Que protege esta area y quien deberia tener acceso…"
                autoComplete="off"
              />
            </div>

            <div className="form-field form-field-full">
              <label className="form-row-checkbox" htmlFor="area-form-active">
                <input
                  id="area-form-active"
                  name="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Area activa y disponible para permisos
              </label>
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
            {submitting ? 'Guardando…' : 'Guardar area'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
