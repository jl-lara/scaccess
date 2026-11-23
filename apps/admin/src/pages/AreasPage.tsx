import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { AreaDto, PaginationMeta } from '@scaccess/shared'
import { AreasFloorPlan } from '../components/areas/AreasFloorPlan'
import { Modal } from '../components/ui/Modal'
import { NoticeBanner } from '../components/ui/NoticeBanner'
import { Pagination } from '../components/ui/Pagination'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT, TableMessage } from '../components/ui/TableMessage'
import { api } from '../lib/api'
import { formatCount, formatDateTime } from '../lib/formatters'
import { usePermissions } from '../lib/permissions'
import { getErrorMessage, hasLetters, isValidAreaCode } from '../lib/validation'

const PAGE_SIZE = 20
const DEFAULT_TIMEZONE = 'America/Tijuana'

const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

type ActiveFilter = '' | 'true' | 'false'
type AreasSection = 'catalog' | 'floorplan' | 'simulator'
type AreaModalState = { mode: 'create' } | { mode: 'edit'; area: AreaDto } | null

export function AreasPage() {
  const { isAdmin, canViewCatalogs, canUseSimulator } = usePermissions()
  const [activeSection, setActiveSection] = useState<AreasSection>(() =>
    canViewCatalogs ? 'catalog' : 'floorplan',
  )
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

  const effectiveSection: AreasSection = !canViewCatalogs
    ? 'floorplan'
    : activeSection === 'simulator' && !canUseSimulator
      ? 'catalog'
      : activeSection

  const loadAreas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listAreas({
        page,
        pageSize: canViewCatalogs ? PAGE_SIZE : 100,
        isActive: activeFilter === '' ? undefined : activeFilter === 'true',
        search: appliedSearch || undefined,
      })
      setAreas(response.data)
      setPagination(response.pagination)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se pudo cargar el catálogo de áreas protegidas. Revisa tu conexión y vuelve a intentarlo.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [page, canViewCatalogs, activeFilter, appliedSearch])

  useEffect(() => {
    void loadAreas()
  }, [loadAreas])

  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === appliedSearch) {
      return
    }
    const timer = setTimeout(() => {
      setPage(1)
      setAppliedSearch(trimmed)
    }, 350)

    return () => clearTimeout(timer)
  }, [searchInput, appliedSearch])

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
          <h1 className="page-title">{canViewCatalogs ? 'Áreas físicas' : 'Croquis en vivo'}</h1>
          <p className="page-description">
            {!canViewCatalogs
              ? 'Monitoreo en tiempo real de ocupación y accesos por zona física.'
              : canUseSimulator
                ? 'Zonas protegidas por controladores ESP32-S3, ocupación en vivo y simulación de accesos.'
                : 'Zonas protegidas por controladores ESP32-S3 y ocupación en vivo.'}
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'create' })}
          >
            <Plus size={16} aria-hidden="true" />
            Nueva área
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

      {canViewCatalogs && !isAdmin ? (
        <NoticeBanner variant="warning">
          Puedes consultar el catálogo, pero solo un administrador puede crear o modificar áreas.
        </NoticeBanner>
      ) : null}

      {canViewCatalogs ? (
        <div className="section-tabs" role="tablist" aria-label="Secciones de áreas físicas">
          <button
            type="button"
            role="tab"
            id="tab-areas-catalog"
            aria-selected={effectiveSection === 'catalog'}
            aria-controls="panel-areas-catalog"
            className={`section-tab${effectiveSection === 'catalog' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('catalog')}
          >
            Catálogo de áreas
          </button>
          <button
            type="button"
            role="tab"
            id="tab-areas-floorplan"
            aria-selected={effectiveSection === 'floorplan'}
            aria-controls="panel-areas-floorplan"
            className={`section-tab${effectiveSection === 'floorplan' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('floorplan')}
          >
            Croquis en vivo
          </button>
          {canUseSimulator ? (
            <button
              type="button"
              role="tab"
              id="tab-areas-simulator"
              aria-selected={effectiveSection === 'simulator'}
              aria-controls="panel-areas-simulator"
              className={`section-tab${effectiveSection === 'simulator' ? ' is-active' : ''}`}
              onClick={() => setActiveSection('simulator')}
            >
              Simulador de accesos
            </button>
          ) : null}
        </div>
      ) : null}

      {canViewCatalogs && effectiveSection === 'catalog' ? (
        <div id="panel-areas-catalog" role="tabpanel" aria-labelledby="tab-areas-catalog">
          <section className="surface-card" aria-label="Catálogo de áreas">
            <form
              className="table-toolbar"
              role="search"
              aria-label="Filtros de áreas"
              autoComplete="off"
              noValidate
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
                    placeholder="Nombre o código del área…"
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
                    <option value="">Todas las áreas</option>
                    <option value="true">Solo activas</option>
                    <option value="false">Solo inactivas</option>
                  </select>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                  Limpiar
                </button>
              </div>
              <span className="table-meta" role="status" aria-live="polite">
                {loading
                  ? 'Actualizando…'
                  : `${formatCount(pagination.total, 'área', 'áreas')} en total`}
              </span>
            </form>

            <div className="table-wrapper">
              <table className="data-table responsive-table" aria-busy={loading}>
                <thead>
                  <tr>
                    <th scope="col">Área</th>
                    <th scope="col">Descripción</th>
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
                      title="Cargando áreas protegidas…"
                      description={COLD_START_HINT}
                    />
                  ) : areas.length === 0 ? (
                    <TableMessage
                      colSpan={6}
                      title={hasActiveFilters ? 'Sin áreas que coincidan' : 'Sin áreas registradas'}
                      description={
                        hasActiveFilters
                          ? 'Ajusta o limpia los filtros para ver todo el catálogo.'
                          : isAdmin
                            ? 'Crea la primera área protegida y define su zona horaria.'
                            : 'Solicita a un administrador que cree la primera área protegida.'
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
                          Crear área
                        </button>
                      ) : null}
                    </TableMessage>
                  ) : (
                    areas.map((area) => (
                      <tr key={area.id}>
                        <td data-label="Área">
                          <div className="cell-stack">
                            <span className="cell-primary">{area.name}</span>
                            <span className="mono-code" translate="no">
                              {area.code}
                            </span>
                          </div>
                        </td>
                        <td data-label="Descripción" className="cell-secondary">
                          {area.description ?? 'Sin descripción'}
                        </td>
                        <td data-label="Zona horaria" className="mono-text" translate="no">
                          {area.timezone}
                        </td>
                        <td data-label="Estado">
                          <StatusBadge variant={area.isActive ? 'success' : 'neutral'}>
                            {area.isActive ? 'Activa' : 'Inactiva'}
                          </StatusBadge>
                        </td>
                        <td data-label="Actualizada" className="cell-secondary">
                          {formatDateTime(area.updatedAt)}
                        </td>
                        <td data-label="Acciones">
                          <div className="row-actions">
                            {isAdmin ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setModal({ mode: 'edit', area })}
                                aria-label={`Editar área ${area.name}`}
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

      {effectiveSection === 'floorplan' ? (
        <div
          id="panel-areas-floorplan"
          role={canViewCatalogs ? 'tabpanel' : undefined}
          aria-labelledby={canViewCatalogs ? 'tab-areas-floorplan' : undefined}
        >
          {/* El croquis consulta eventos y empleados por su cuenta con guardas para mocks antiguos. */}
          <AreasFloorPlan
            areas={areas}
            mode="floorplan"
            canViewEmployees={canViewCatalogs}
          />
        </div>
      ) : null}

      {canUseSimulator && effectiveSection === 'simulator' ? (
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

    const trimmedCode = code.trim()
    const trimmedName = name.trim()
    const trimmedTimezone = timezone.trim()

    if (!area && !trimmedCode) {
      setFormError('El código del área es obligatorio.')
      return
    }
    if (!area && !isValidAreaCode(trimmedCode)) {
      setFormError(
        'El código del área debe incluir letras y solo usar letras, números, guiones o guion bajo.',
      )
      return
    }
    if (!trimmedName) {
      setFormError('El nombre del área es obligatorio.')
      return
    }
    if (!hasLetters(trimmedName)) {
      setFormError('El nombre del área debe contener al menos una letra.')
      return
    }
    if (!trimmedTimezone) {
      setFormError('La zona horaria IANA es obligatoria, por ejemplo America/Tijuana.')
      return
    }

    try {
      new Intl.DateTimeFormat('es-MX', { timeZone: trimmedTimezone })
    } catch {
      setFormError(
        'La zona horaria no es válida. Usa un identificador IANA, por ejemplo America/Tijuana.',
      )
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      if (area) {
        await api.updateArea(area.id, {
          name: trimmedName,
          description: description.trim() || null,
          timezone: trimmedTimezone,
          isActive,
        })
        onSaved('Área actualizada correctamente.')
      } else {
        await api.createArea({
          code: trimmedCode.toUpperCase(),
          name: trimmedName,
          description: description.trim() || null,
          timezone: trimmedTimezone,
          isActive,
        })
        onSaved('Área creada correctamente.')
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar el área.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={area ? 'Editar área' : 'Nueva área'}
      description={
        area
          ? 'El código es inmutable porque los controladores lo usan como referencia. Puedes ajustar el nombre, la zona horaria y el estado.'
          : 'El código identifica el área en la configuración de los controladores. Usa un valor corto y estable.'
      }
      onClose={onClose}
    >
      <form autoComplete="off" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="modal-body">
          {formError ? <NoticeBanner variant="error">{formError}</NoticeBanner> : null}

          {area ? (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-label">Código del área</div>
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
                  Código del área
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
                  Se guarda en mayúsculas y no se puede cambiar.
                </span>
              </div>
            ) : null}

            <div className="form-field">
              <label className="form-label" htmlFor="area-form-name">
                Nombre del área
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
                Descripción
              </label>
              <textarea
                id="area-form-description"
                name="description"
                className="input-control"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Qué protege esta área y quién debería tener acceso…"
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
                Área activa y disponible para permisos
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
            {submitting ? 'Guardando…' : 'Guardar área'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
