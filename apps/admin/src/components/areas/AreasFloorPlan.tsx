import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRightLeft,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  Shuffle,
} from 'lucide-react'
import type {
  AccessEventDto,
  AccessPermissionDto,
  AreaDto,
  CredentialDto,
  EmployeeDto,
  EmployeeStatus,
} from '@scaccess/shared'
import { api } from '../../lib/api'
import { EMPLOYEE_STATUS_LABELS, formatDateTimeWithSeconds } from '../../lib/formatters'

const EXTERIOR_ZONE_ID = 'exterior'
const EXTERIOR_ZONE_LABEL = 'Exterior / Salida registrada'
const EXTERIOR_STATE_LABEL = 'Fuera de instalaciones / En tránsito'

const KNOWN_AREA_ORDER: readonly string[] = [
  'MAIN_ENTRANCE',
  'LAB_ELECTRONICS',
  'SERVER_ROOM',
  'ADMIN_OFFICES',
  'WAREHOUSE_RFID',
  'QA_TEST_AREA',
]

interface AreaProfile {
  capacity: number
  security: string
}

const DEFAULT_AREA_PROFILE: AreaProfile = {
  capacity: 8,
  security: 'Seguridad estándar',
}

const AREA_PROFILES: Record<string, AreaProfile> = {
  MAIN_ENTRANCE: { capacity: 12, security: 'Control perimetral' },
  LAB_ELECTRONICS: { capacity: 6, security: 'Acceso restringido' },
  SERVER_ROOM: { capacity: 3, security: 'Nivel crítico' },
  ADMIN_OFFICES: { capacity: 10, security: 'Acceso privado' },
  WAREHOUSE_RFID: { capacity: 8, security: 'Zona operativa' },
  QA_TEST_AREA: { capacity: 5, security: 'Supervisión técnica' },
}

const TIME_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
})

const EXIT_VALUES = new Set(['exit', 'out', 'salida', 'leave', 'departure', 'check-out', 'checkout'])
const ENTRY_VALUES = new Set(['entry', 'in', 'entrada', 'enter', 'arrival', 'check-in', 'checkin'])

type MovementKind = 'entry' | 'exit'

interface MovementLogEntry {
  id: string
  employeeId: string
  areaId: string
  cardUid: string
  movement: MovementKind
  occurredAt: string
  simulated: boolean
}

interface PresenceRecord {
  employeeId: string
  areaId: string | null
  cardUid: string
  movement: MovementKind
  occurredAt: string
  simulated: boolean
}

interface EmployeeView {
  id: string
  name: string
  code: string
  initials: string
  department: string | null
  status: EmployeeStatus | null
}

type FeedbackTone = 'info' | 'success' | 'warning' | 'error'

interface SimulatorFeedback {
  tone: FeedbackTone
  message: string
}

interface PersonEntry {
  presence: PresenceRecord
  employee: EmployeeView
}

interface SearchMatches {
  zoneIds: Set<string>
  employeeIds: Set<string>
  labels: string[]
}

function toTimestamp(iso: string): number {
  const parsed = new Date(iso).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function readExplicitMovement(metadata: unknown): MovementKind | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  const record = metadata as Record<string, unknown>
  for (const key of ['direction', 'action', 'movement', 'type']) {
    const value = record[key]
    if (typeof value !== 'string') continue

    const normalized = value.trim().toLowerCase()
    if (EXIT_VALUES.has(normalized)) return 'exit'
    if (ENTRY_VALUES.has(normalized)) return 'entry'
  }

  return null
}

function buildMovementLog(events: AccessEventDto[]): MovementLogEntry[] {
  const ordered = events
    .filter((event) => event.decision === 'granted' && event.employeeId !== null)
    .toSorted(
      (left, right) =>
        toTimestamp(left.occurredAt) - toTimestamp(right.occurredAt) ||
        left.id.localeCompare(right.id),
    )

  const lastAreaByEmployee = new Map<string, string | null>()
  const log: MovementLogEntry[] = []

  for (const event of ordered) {
    const employeeId = event.employeeId
    if (!employeeId) continue

    const explicitMovement = readExplicitMovement(event.metadata)
    const previousArea = lastAreaByEmployee.get(employeeId) ?? null
    const movement: MovementKind =
      explicitMovement === 'exit' ||
      (explicitMovement !== 'entry' && previousArea === event.areaId)
        ? 'exit'
        : 'entry'

    lastAreaByEmployee.set(employeeId, movement === 'entry' ? event.areaId : null)
    log.push({
      id: event.id,
      employeeId,
      areaId: event.areaId,
      cardUid: event.cardUid,
      movement,
      occurredAt: event.occurredAt,
      simulated: false,
    })
  }

  return log
}

function applyMovementLog(
  basePresence: Map<string, PresenceRecord>,
  movements: MovementLogEntry[],
): Map<string, PresenceRecord> {
  const next = new Map(basePresence)

  for (const movement of movements) {
    next.set(movement.employeeId, {
      employeeId: movement.employeeId,
      areaId: movement.movement === 'entry' ? movement.areaId : null,
      cardUid: movement.cardUid,
      movement: movement.movement,
      occurredAt: movement.occurredAt,
      simulated: movement.simulated,
    })
  }

  return next
}

function makeInitials(firstName: string, lastName: string): string {
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase()
  return initials || '??'
}

function buildEmployeeViews(
  employees: EmployeeDto[],
  movements: MovementLogEntry[],
): Map<string, EmployeeView> {
  const views = new Map<string, EmployeeView>()

  for (const employee of employees) {
    const fullName = `${employee.firstName} ${employee.lastName}`.trim()
    views.set(employee.id, {
      id: employee.id,
      name: fullName || employee.employeeCode,
      code: employee.employeeCode,
      initials: makeInitials(employee.firstName, employee.lastName),
      department: employee.department,
      status: employee.status,
    })
  }

  for (const movement of movements) {
    if (views.has(movement.employeeId)) continue

    const suffix =
      movement.employeeId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'SINID'
    views.set(movement.employeeId, {
      id: movement.employeeId,
      name: `Empleado ${suffix}`,
      code: `EMP-${suffix}`,
      initials: 'EM',
      department: null,
      status: null,
    })
  }

  return views
}

function matchesEmployeeQuery(
  employee: EmployeeView,
  presence: PresenceRecord,
  query: string,
): boolean {
  if (!query) return true

  const haystack = [
    employee.name,
    employee.code,
    employee.department ?? '',
    presence.cardUid,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function formatTime(iso: string): string {
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? '--:--' : TIME_FORMATTER.format(parsed)
}

function getAreaProfile(code: string): AreaProfile {
  return AREA_PROFILES[code.toUpperCase()] ?? DEFAULT_AREA_PROFILE
}

function getAreaOrder(code: string): number {
  const index = KNOWN_AREA_ORDER.indexOf(code.toUpperCase())
  return index === -1 ? KNOWN_AREA_ORDER.length : index
}

interface PersonitaIconProps {
  className?: string
}

function PersonitaIcon({ className }: PersonitaIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
      data-personita-icon="true"
      aria-hidden="true"
      focusable="false"
    >
      <g strokeWidth="0" />
      <g strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <path d="M13.9 2.999A1.9 1.9 0 1 1 12 1.1a1.9 1.9 0 0 1 1.9 1.899zM13.544 6h-3.088a1.855 1.855 0 0 0-1.8 1.405l-1.662 6.652a.667.667 0 0 0 .14.573.873.873 0 0 0 .665.33.718.718 0 0 0 .653-.445L10 9.1V13l-.922 9.219a.71.71 0 0 0 .707.781h.074a.69.69 0 0 0 .678-.563L12 14.583l1.463 7.854a.69.69 0 0 0 .678.563h.074a.71.71 0 0 0 .707-.781L14 13V9.1l1.548 5.415a.718.718 0 0 0 .653.444.873.873 0 0 0 .665-.329.667.667 0 0 0 .14-.573l-1.662-6.652A1.855 1.855 0 0 0 13.544 6z" />
        <path fill="none" d="M0 0h24v24H0z" />
      </g>
    </svg>
  )
}

function EmployeeAvatar({ employee }: { employee: EmployeeView }) {
  return (
    <span className="croquis__avatar" aria-hidden="true">
      {employee.initials}
    </span>
  )
}

function MovementBadge({ movement }: { movement: MovementKind }) {
  return (
    <span className={`croquis__movement croquis__movement--${movement}`}>
      {movement === 'entry' ? (
        <LogIn size={12} aria-hidden="true" />
      ) : (
        <LogOut size={12} aria-hidden="true" />
      )}
      {movement === 'entry' ? 'Entrada' : 'Salida'}
    </span>
  )
}

interface EmployeeChipProps {
  employee: EmployeeView
  presence: PresenceRecord
  locationLabel: string
  isHighlighted: boolean
  dimmed: boolean
  onSelect: (employeeId: string) => void
}

function EmployeeChip({
  employee,
  presence,
  locationLabel,
  isHighlighted,
  dimmed,
  onSelect,
}: EmployeeChipProps) {
  const movementLabel = presence.movement === 'entry' ? 'Entrada' : 'Salida'
  const toneClass = presence.movement === 'exit' ? ' croquis__chip--exit' : ''

  return (
    <button
      type="button"
      className={`croquis__chip${toneClass}${isHighlighted ? ' is-selected' : ''}${
        dimmed ? ' is-dimmed' : ''
      }`}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(employee.id)
      }}
      aria-label={`${employee.name}, ${movementLabel} ${formatDateTimeWithSeconds(
        presence.occurredAt,
      )}, ${locationLabel}, tarjeta ${presence.cardUid}`}
      title={`${employee.name} (${employee.code}) — ${movementLabel} · ${formatTime(
        presence.occurredAt,
      )}`}
      data-employee-id={employee.id}
    >
      <PersonitaIcon className="croquis__personita-icon" />
      <span className="sr-only">
        <span>{employee.name}</span>
        <span>{employee.code}</span>
      </span>
    </button>
  )
}

interface FloorZoneProps {
  area: AreaDto
  people: PersonEntry[]
  selected: boolean
  matched: boolean
  searchActive: boolean
  highlightedEmployeeIds: ReadonlySet<string>
  selectedEmployeeId: string | null
  onSelectZone: (areaId: string) => void
  onSelectEmployee: (employeeId: string, areaId: string) => void
}

function FloorZone({
  area,
  people,
  selected,
  matched,
  searchActive,
  highlightedEmployeeIds,
  selectedEmployeeId,
  onSelectZone,
  onSelectEmployee,
}: FloorZoneProps) {
  const profile = getAreaProfile(area.code)
  const occupancy = people.length
  const occupancyPercent = Math.min(100, Math.round((occupancy / profile.capacity) * 100))
  const atCapacity = occupancy >= profile.capacity

  return (
    <article
      className={`croquis__zone${selected ? ' is-selected' : ''}${matched ? ' is-match' : ''}${
        area.isActive ? '' : ' is-inactive'
      }`}
      data-testid={`floor-zone-${area.id}`}
      data-area-code={area.code}
      onClick={() => onSelectZone(area.id)}
    >
      <button
        type="button"
        className="croquis__zone-head"
        onClick={(event) => {
          event.stopPropagation()
          onSelectZone(area.id)
        }}
        aria-label={`Ver actividad de la zona ${area.name}, código ${area.code}`}
      >
        <span className="croquis__zone-name">
          {area.name} · <span className="croquis__zone-code">{area.code}</span>
        </span>
        <span className={area.isActive ? 'status-badge success' : 'status-badge neutral'}>
          {area.isActive ? 'Activa' : 'Inactiva'}
        </span>
      </button>

      <div className="croquis__occupancy">
        <span>
          {occupancy} {occupancy === 1 ? 'persona' : 'personas'} en zona
        </span>
        <span>
          Capacidad {profile.capacity}
          {atCapacity ? ' · Aforo completo' : ''}
        </span>
      </div>
      <div className="croquis__capacity-track" aria-hidden="true">
        <div
          className={`croquis__capacity-fill${atCapacity ? ' is-full' : ''}`}
          style={{ width: `${occupancyPercent}%` }}
        />
      </div>
      <p className="croquis__zone-security">Seguridad: {profile.security}</p>

      {people.length > 0 ? (
        <div className="croquis__chips">
          {people.map((person) => (
            <EmployeeChip
              key={person.employee.id}
              employee={person.employee}
              presence={person.presence}
              locationLabel={area.name}
              isHighlighted={selectedEmployeeId === person.employee.id}
              dimmed={searchActive && !highlightedEmployeeIds.has(person.employee.id)}
              onSelect={(employeeId) => onSelectEmployee(employeeId, area.id)}
            />
          ))}
        </div>
      ) : (
        <p className="croquis__zone-empty">Sin empleados dentro.</p>
      )}
    </article>
  )
}

interface ExteriorZoneProps {
  people: PersonEntry[]
  selected: boolean
  matched: boolean
  searchActive: boolean
  highlightedEmployeeIds: ReadonlySet<string>
  selectedEmployeeId: string | null
  onSelectZone: () => void
  onSelectEmployee: (employeeId: string) => void
}

function ExteriorZone({
  people,
  selected,
  matched,
  searchActive,
  highlightedEmployeeIds,
  selectedEmployeeId,
  onSelectZone,
  onSelectEmployee,
}: ExteriorZoneProps) {
  return (
    <article
      className={`croquis__exterior${selected ? ' is-selected' : ''}${matched ? ' is-match' : ''}`}
      data-testid="floor-zone-exterior"
      onClick={onSelectZone}
    >
      <button
        type="button"
        className="croquis__exterior-head"
        onClick={(event) => {
          event.stopPropagation()
          onSelectZone()
        }}
        aria-label={`Ver actividad de ${EXTERIOR_ZONE_LABEL}, ${people.length} personas`}
      >
        <span className="croquis__exterior-title">
          <strong>{EXTERIOR_ZONE_LABEL}</strong>
          <span>{EXTERIOR_STATE_LABEL}</span>
        </span>
        <span className="croquis__exterior-count">
          {people.length} {people.length === 1 ? 'salida' : 'salidas'}
        </span>
      </button>

      {people.length > 0 ? (
        <div className="croquis__chips">
          {people.map((person) => (
            <EmployeeChip
              key={person.employee.id}
              employee={person.employee}
              presence={person.presence}
              locationLabel={EXTERIOR_STATE_LABEL}
              isHighlighted={selectedEmployeeId === person.employee.id}
              dimmed={searchActive && !highlightedEmployeeIds.has(person.employee.id)}
              onSelect={onSelectEmployee}
            />
          ))}
        </div>
      ) : (
        <p className="croquis__zone-empty">Sin salidas registradas en esta sesion.</p>
      )}
    </article>
  )
}

interface FloorPlanPanelProps {
  selectedArea: AreaDto | null
  exteriorSelected: boolean
  people: PersonEntry[]
  log: MovementLogEntry[]
  employeeById: Map<string, EmployeeView>
  totalInside: number
  totalOutside: number
  analyzedEvents: number
  simulatedMovements: number
  showSimulationStats: boolean
  onClose: () => void
  onSelectEmployee: (employeeId: string) => void
}

function FloorPlanPanel({
  selectedArea,
  exteriorSelected,
  people,
  log,
  employeeById,
  totalInside,
  totalOutside,
  analyzedEvents,
  simulatedMovements,
  showSimulationStats,
  onClose,
  onSelectEmployee,
}: FloorPlanPanelProps) {
  const hasSelection = exteriorSelected || selectedArea !== null

  if (!hasSelection) {
    return (
      <aside className="croquis__panel" aria-label="Resumen del croquis">
        <div>
          <h3 className="croquis__panel-title">Lectura del plano</h3>
          <p className="croquis__panel-copy">
            Selecciona una zona o un empleado para revisar quienes estan dentro y sus ultimos
            movimientos registrados.
          </p>
        </div>

        <dl className="croquis__stats">
          <div className="croquis__stat">
            <dt>En areas</dt>
            <dd>{totalInside}</dd>
          </div>
          <div className="croquis__stat">
            <dt>Fuera</dt>
            <dd>{totalOutside}</dd>
          </div>
          <div className="croquis__stat">
            <dt>Eventos</dt>
            <dd>{analyzedEvents}</dd>
          </div>
          {showSimulationStats ? (
            <div className="croquis__stat">
              <dt>Simulaciones</dt>
              <dd>{simulatedMovements}</dd>
            </div>
          ) : null}
        </dl>

        <p className="croquis__panel-note">
          Solo los accesos concedidos mueven a las personas en el croquis. Las lecturas denegadas
          quedan en la bitacora, pero no alteran la ubicacion.
        </p>
      </aside>
    )
  }

  const panelTitle = exteriorSelected ? EXTERIOR_ZONE_LABEL : selectedArea?.name ?? 'Zona'
  const panelSubtitle = exteriorSelected
    ? EXTERIOR_STATE_LABEL
    : selectedArea
      ? `${selectedArea.code} · ${getAreaProfile(selectedArea.code).security}`
      : ''

  return (
    <aside className="croquis__panel" aria-label={`Actividad de ${panelTitle}`}>
      <div className="croquis__panel-head">
        <div>
          <h3 className="croquis__panel-title">{panelTitle}</h3>
          <p className="croquis__panel-subtitle">{panelSubtitle}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Cerrar detalle
        </button>
      </div>

      <section className="croquis__panel-section" aria-label="Personas ubicadas en la zona">
        <h4>{exteriorSelected ? EXTERIOR_STATE_LABEL : 'Dentro ahora'}</h4>
        {people.length > 0 ? (
          <ul className="croquis__panel-list">
            {people.map((person) => (
              <li key={person.employee.id}>
                <button
                  type="button"
                  className="croquis__panel-person"
                  onClick={() => onSelectEmployee(person.employee.id)}
                  aria-label={`Ver movimiento de ${person.employee.name}`}
                >
                  <EmployeeAvatar employee={person.employee} />
                  <span className="croquis__chip-copy">
                    <span className="croquis__chip-name">{person.employee.name}</span>
                    <span className="croquis__chip-meta">
                      {person.employee.code} · {formatTime(person.presence.occurredAt)}
                    </span>
                  </span>
                  <MovementBadge movement={person.presence.movement} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="croquis__panel-empty">
            {exteriorSelected
              ? 'Sin salidas registradas en esta sesion.'
              : 'Sin empleados dentro en este momento.'}
          </p>
        )}
      </section>

      <section className="croquis__panel-section" aria-label="Ultimos movimientos de la zona">
        <h4>Ultimas entradas y salidas</h4>
        {log.length > 0 ? (
          <ol className="croquis__panel-list">
            {log.slice(0, 6).map((entry) => {
              const employee = employeeById.get(entry.employeeId)
              return (
                <li
                  key={`${entry.simulated ? 'sim' : 'srv'}-${entry.id}`}
                  className={`croquis__timeline-item${entry.simulated ? ' is-simulated' : ''}`}
                >
                  <MovementBadge movement={entry.movement} />
                  <span className="croquis__timeline-name">{employee?.name ?? 'Empleado'}</span>
                  <time className="croquis__timeline-time" dateTime={entry.occurredAt}>
                    {formatDateTimeWithSeconds(entry.occurredAt)}
                  </time>
                  <span className="croquis__timeline-meta">
                    Tarjeta {entry.cardUid}
                    {entry.simulated ? <span className="croquis__sim-tag">Simulado</span> : null}
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="croquis__panel-empty">Sin movimientos registrados en esta zona.</p>
        )}
      </section>
    </aside>
  )
}

export type FloorPlanMode = 'floorplan' | 'simulator' | 'all'

interface AreasFloorPlanProps {
  areas: AreaDto[]
  mode?: FloorPlanMode
  canViewEmployees?: boolean
}

export function AreasFloorPlan({
  areas,
  mode = 'all',
  canViewEmployees = true,
}: AreasFloorPlanProps) {
  const showSimulator = mode !== 'floorplan'
  const [serverEvents, setServerEvents] = useState<AccessEventDto[]>([])
  const [employees, setEmployees] = useState<EmployeeDto[]>([])
  const [permissions, setPermissions] = useState<AccessPermissionDto[]>([])
  const [credentials, setCredentials] = useState<CredentialDto[]>([])
  const [hasPermissionsCatalog, setHasPermissionsCatalog] = useState(false)
  const [hasCredentialsCatalog, setHasCredentialsCatalog] = useState(false)
  const [includeInactiveEmployees, setIncludeInactiveEmployees] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [simulatedMovements, setSimulatedMovements] = useState<MovementLogEntry[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [movement, setMovement] = useState<MovementKind>('entry')
  const [movementEmployeeId, setMovementEmployeeId] = useState('')
  const [movementAreaId, setMovementAreaId] = useState('')
  const [roundSeed, setRoundSeed] = useState(0)
  const [feedback, setFeedback] = useState<SimulatorFeedback | null>(null)
  const simulationCounter = useRef(0)

  useEffect(() => {
    let active = true

    async function loadFloorPlanData() {
      setLoading(true)

      try {
        const eventsPromise =
          typeof api.listAccessEvents === 'function'
            ? Promise.resolve(api.listAccessEvents({ page: 1, pageSize: 100 })).catch(() => null)
            : Promise.resolve(null)
        const employeesPromise =
          canViewEmployees && typeof api.listEmployees === 'function'
            ? Promise.resolve(api.listEmployees({ page: 1, pageSize: 100 })).catch(() => null)
            : Promise.resolve(null)
        const permissionsPromise =
          showSimulator && canViewEmployees && typeof api.listAccessPermissions === 'function'
            ? Promise.resolve(
                api.listAccessPermissions({ activeOnly: true, page: 1, pageSize: 100 }),
              ).catch(() => null)
            : Promise.resolve(null)
        const credentialsPromise =
          showSimulator && canViewEmployees && typeof api.listCredentials === 'function'
            ? Promise.resolve(api.listCredentials({ page: 1, pageSize: 100 })).catch(() => null)
            : Promise.resolve(null)

        const [eventsResponse, employeesResponse, permissionsResponse, credentialsResponse] =
          await Promise.all([
            eventsPromise,
            employeesPromise,
            permissionsPromise,
            credentialsPromise,
          ])

        if (!active) return

        setServerEvents(Array.isArray(eventsResponse?.data) ? eventsResponse.data : [])
        setEmployees(Array.isArray(employeesResponse?.data) ? employeesResponse.data : [])
        if (Array.isArray(permissionsResponse?.data)) {
          setPermissions(permissionsResponse.data)
          setHasPermissionsCatalog(true)
        } else {
          setPermissions([])
          setHasPermissionsCatalog(false)
        }
        if (Array.isArray(credentialsResponse?.data)) {
          setCredentials(credentialsResponse.data)
          setHasCredentialsCatalog(true)
        } else {
          setCredentials([])
          setHasCredentialsCatalog(false)
        }
      } catch {
        if (!active) return
        setServerEvents([])
        setEmployees([])
        setPermissions([])
        setCredentials([])
        setHasPermissionsCatalog(false)
        setHasCredentialsCatalog(false)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadFloorPlanData()

    return () => {
      active = false
    }
  }, [reloadKey, canViewEmployees, showSimulator])

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas])

  const orderedAreas = useMemo(
    () =>
      areas.toSorted((left, right) => {
        const orderDifference = getAreaOrder(left.code) - getAreaOrder(right.code)
        if (orderDifference !== 0) return orderDifference
        return left.name.localeCompare(right.name, 'es')
      }),
    [areas],
  )

  const activeAreas = useMemo(
    () => orderedAreas.filter((area) => area.isActive),
    [orderedAreas],
  )

  const destinationAreas = activeAreas.length > 0 ? activeAreas : orderedAreas

  const baseLog = useMemo(() => buildMovementLog(serverEvents), [serverEvents])

  const employeeViews = useMemo(
    () => buildEmployeeViews(employees, [...baseLog, ...simulatedMovements]),
    [employees, baseLog, simulatedMovements],
  )

  const basePresence = useMemo(() => applyMovementLog(new Map(), baseLog), [baseLog])

  const effectivePresence = useMemo(
    () => applyMovementLog(basePresence, simulatedMovements),
    [basePresence, simulatedMovements],
  )

  const movementLog = useMemo(
    () => [...baseLog, ...simulatedMovements],
    [baseLog, simulatedMovements],
  )

  const cardUidByEmployee = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of movementLog) {
      map.set(entry.employeeId, entry.cardUid)
    }
    return map
  }, [movementLog])

  const recentLogByArea = useMemo(() => {
    const map = new Map<string, MovementLogEntry[]>()
    for (const entry of movementLog) {
      const current = map.get(entry.areaId) ?? []
      current.push(entry)
      map.set(entry.areaId, current)
    }

    for (const entries of map.values()) {
      entries.sort(
        (left, right) =>
          toTimestamp(right.occurredAt) - toTimestamp(left.occurredAt) ||
          right.id.localeCompare(left.id),
      )
    }

    return map
  }, [movementLog])

  const peopleByArea = useMemo(() => {
    const map = new Map<string, PersonEntry[]>()

    for (const presence of effectivePresence.values()) {
      if (!presence.areaId || !areaById.has(presence.areaId)) continue

      const employee = employeeViews.get(presence.employeeId)
      if (!employee) continue

      const current = map.get(presence.areaId) ?? []
      current.push({ presence, employee })
      map.set(presence.areaId, current)
    }

    for (const people of map.values()) {
      people.sort((left, right) => left.employee.name.localeCompare(right.employee.name, 'es'))
    }

    return map
  }, [effectivePresence, areaById, employeeViews])

  const exteriorPeople = useMemo(() => {
    const people: PersonEntry[] = []

    for (const presence of effectivePresence.values()) {
      if (presence.areaId !== null || presence.movement !== 'exit') continue

      const employee = employeeViews.get(presence.employeeId)
      if (!employee) continue

      people.push({ presence, employee })
    }

    people.sort(
      (left, right) =>
        toTimestamp(right.presence.occurredAt) - toTimestamp(left.presence.occurredAt),
    )

    return people
  }, [effectivePresence, employeeViews])

  const employeeOptions = useMemo(() => {
    const allViews = [...employeeViews.values()]
    const filtered = includeInactiveEmployees
      ? allViews
      : allViews.filter((emp) => emp.status === null || emp.status === 'active')
    return filtered.toSorted((left, right) => left.name.localeCompare(right.name, 'es'))
  }, [employeeViews, includeInactiveEmployees])

  const effectiveEmployeeId = employeeOptions.some((emp) => emp.id === movementEmployeeId)
    ? movementEmployeeId
    : employeeOptions[0]?.id ?? ''

  const activeCredentialByEmployee = useMemo(() => {
    const map = new Map<string, CredentialDto>()
    for (const credential of credentials) {
      if (credential.status === 'active' && !map.has(credential.employeeId)) {
        map.set(credential.employeeId, credential)
      }
    }
    return map
  }, [credentials])

  function evaluateEntryRules(
    employee: EmployeeView,
    destination: AreaDto,
    occupancyCount: number,
  ): SimulatorFeedback | null {
    if (!destination.isActive) {
      return {
        tone: 'error',
        message: `Acceso denegado: el área ${destination.name} está inactiva.`,
      }
    }

    if (employee.status && employee.status !== 'active') {
      return {
        tone: 'error',
        message: `Acceso denegado: ${employee.name} tiene estado ${EMPLOYEE_STATUS_LABELS[employee.status].toLowerCase()}.`,
      }
    }

    if (hasCredentialsCatalog && !activeCredentialByEmployee.has(employee.id)) {
      return {
        tone: 'error',
        message: `Acceso denegado: ${employee.name} no cuenta con una tarjeta RFID activa.`,
      }
    }

    if (hasPermissionsCatalog) {
      const nowMs = Date.now()
      const matching = permissions.filter(
        (permission) =>
          permission.employeeId === employee.id &&
          permission.areaId === destination.id &&
          permission.revokedAt === null,
      )
      if (matching.length === 0) {
        return {
          tone: 'error',
          message: `Acceso denegado: ${employee.name} no tiene permiso asignado para ${destination.name}.`,
        }
      }

      const validNow = matching.some((permission) => {
        const fromMs = permission.validFrom ? new Date(permission.validFrom).getTime() : null
        const toMs = permission.validTo ? new Date(permission.validTo).getTime() : null
        if (fromMs !== null && Number.isFinite(fromMs) && fromMs > nowMs) return false
        if (toMs !== null && Number.isFinite(toMs) && toMs <= nowMs) return false
        return true
      })

      if (!validNow) {
        return {
          tone: 'error',
          message: `Acceso denegado: el permiso de ${employee.name} en ${destination.name} está vencido o aún no inicia su vigencia.`,
        }
      }
    }

    const capacity = getAreaProfile(destination.code).capacity
    if (occupancyCount >= capacity) {
      return {
        tone: 'warning',
        message: `Capacidad máxima alcanzada en ${destination.name} (${occupancyCount}/${capacity} personas). Registra una salida antes de permitir otro ingreso.`,
      }
    }

    return null
  }

  const selectedDestinationId =
    selectedZoneId && selectedZoneId !== EXTERIOR_ZONE_ID
      ? areaById.get(selectedZoneId)
      : undefined
  const defaultDestinationId =
    selectedDestinationId?.isActive === true
      ? selectedDestinationId.id
      : destinationAreas[0]?.id ?? ''

  const effectiveDestinationId = destinationAreas.some((area) => area.id === movementAreaId)
    ? movementAreaId
    : defaultDestinationId

  const normalizedQuery = search.trim().toLowerCase()
  const searchActive = normalizedQuery.length > 0

  const searchMatches = useMemo<SearchMatches>(() => {
    const zoneIds = new Set<string>()
    const employeeIds = new Set<string>()
    const labels: string[] = []

    if (!normalizedQuery) {
      return { zoneIds, employeeIds, labels }
    }

    for (const area of orderedAreas) {
      const people = peopleByArea.get(area.id) ?? []
      for (const person of people) {
        if (!matchesEmployeeQuery(person.employee, person.presence, normalizedQuery)) continue
        zoneIds.add(area.id)
        employeeIds.add(person.employee.id)
        labels.push(`${person.employee.name}: ${area.name}`)
      }
    }

    for (const person of exteriorPeople) {
      if (!matchesEmployeeQuery(person.employee, person.presence, normalizedQuery)) continue
      zoneIds.add(EXTERIOR_ZONE_ID)
      employeeIds.add(person.employee.id)
      labels.push(`${person.employee.name}: ${EXTERIOR_STATE_LABEL}`)
    }

    return { zoneIds, employeeIds, labels }
  }, [normalizedQuery, orderedAreas, peopleByArea, exteriorPeople])

  const searchStatus = searchActive
    ? searchMatches.labels.length > 0
      ? `Ubicación: ${searchMatches.labels.slice(0, 3).join(' · ')}${
          searchMatches.labels.length > 3 ? ` (+${searchMatches.labels.length - 3})` : ''
        }`
      : 'Sin empleados que coincidan con la búsqueda.'
    : null

  const exteriorSelected = selectedZoneId === EXTERIOR_ZONE_ID
  const selectedArea =
    selectedZoneId && !exteriorSelected ? areaById.get(selectedZoneId) ?? null : null
  const selectedPeople = exteriorSelected
    ? exteriorPeople
    : selectedZoneId
      ? peopleByArea.get(selectedZoneId) ?? []
      : []
  const selectedLog = selectedZoneId
    ? exteriorSelected
      ? movementLog
          .filter((entry) => entry.movement === 'exit')
          .toSorted(
            (left, right) =>
              toTimestamp(right.occurredAt) - toTimestamp(left.occurredAt) ||
              right.id.localeCompare(left.id),
          )
      : recentLogByArea.get(selectedZoneId) ?? []
    : []

  let totalInside = 0
  for (const people of peopleByArea.values()) {
    totalInside += people.length
  }

  const simulationDisabled = employeeOptions.length === 0

  function nextSimulationId(prefix: string): string {
    simulationCounter.current += 1
    return `${prefix}-${Date.now()}-${simulationCounter.current}`
  }

  function handleSelectZone(areaId: string) {
    setSelectedZoneId(areaId)
    setSelectedEmployeeId(null)
  }

  function handleSelectEmployee(employeeId: string, areaId: string | null) {
    setSelectedEmployeeId(employeeId)
    setSelectedZoneId(areaId ?? EXTERIOR_ZONE_ID)
  }

  function handleSimulateMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const employee = employeeViews.get(effectiveEmployeeId)
    if (!employee) {
      setFeedback({
        tone: 'warning',
        message: 'Selecciona un empleado para simular el movimiento.',
      })
      return
    }

    const current = effectivePresence.get(employee.id)
    const activeCredential = activeCredentialByEmployee.get(employee.id)
    const cardUid =
      activeCredential?.cardUid ?? current?.cardUid ?? cardUidByEmployee.get(employee.id) ?? 'SIMULADO'

    if (movement === 'exit') {
      const exitFromAreaId = current?.areaId ?? null
      const exitMovement: MovementLogEntry = {
        id: nextSimulationId('sim-exit'),
        employeeId: employee.id,
        areaId: exitFromAreaId ?? '',
        cardUid,
        movement: 'exit',
        occurredAt: new Date().toISOString(),
        simulated: true,
      }

      setSimulatedMovements((currentMovements) => [...currentMovements, exitMovement])
      setSelectedZoneId(exitFromAreaId ?? EXTERIOR_ZONE_ID)
      setSelectedEmployeeId(employee.id)
      setFeedback({
        tone: 'success',
        message: exitFromAreaId
          ? `Salida simulada: ${employee.name} salió de ${
              areaById.get(exitFromAreaId)?.name ?? 'el área'
            }.`
          : `Salida simulada: ${employee.name} quedó en ${EXTERIOR_STATE_LABEL}.`,
      })
      return
    }

    const destination = areaById.get(effectiveDestinationId)
    if (!destination) {
      setFeedback({
        tone: 'warning',
        message: 'Selecciona un área de destino para simular la entrada.',
      })
      return
    }

    if (current?.areaId === destination.id) {
      setFeedback({
        tone: 'warning',
        message: `${employee.name} ya se encuentra en ${destination.name}. Registra una salida o elige otra área.`,
      })
      return
    }

    const currentOccupancy = peopleByArea.get(destination.id)?.length ?? 0
    const denial = evaluateEntryRules(employee, destination, currentOccupancy)
    if (denial) {
      setSelectedZoneId(destination.id)
      setFeedback(denial)
      return
    }

    const entryMovement: MovementLogEntry = {
      id: nextSimulationId('sim-entry'),
      employeeId: employee.id,
      areaId: destination.id,
      cardUid,
      movement: 'entry',
      occurredAt: new Date().toISOString(),
      simulated: true,
    }

    setSimulatedMovements((currentMovements) => [...currentMovements, entryMovement])
    setSelectedZoneId(destination.id)
    setSelectedEmployeeId(employee.id)
    setFeedback({
      tone: 'success',
      message: `Entrada simulada: ${employee.name} ingresó a ${destination.name}.`,
    })
  }

  function handleSimulatedRound() {
    if (employeeOptions.length === 0 || destinationAreas.length === 0) {
      setFeedback({
        tone: 'warning',
        message: 'No hay empleados o áreas disponibles para simular una ronda.',
      })
      return
    }

    const activeEligibleEmployees = employeeOptions.filter(
      (employee) => employee.status === null || employee.status === 'active',
    )
    if (activeEligibleEmployees.length === 0) {
      setFeedback({
        tone: 'warning',
        message: 'No hay empleados activos disponibles para simular una ronda.',
      })
      return
    }

    const total = Math.min(3, activeEligibleEmployees.length)
    const baseTime = Date.now()
    const roundMovements: MovementLogEntry[] = []
    const simulatedAreaCounts = new Map<string, number>()
    for (const area of destinationAreas) {
      simulatedAreaCounts.set(area.id, peopleByArea.get(area.id)?.length ?? 0)
    }

    for (let step = 0; step < total; step += 1) {
      const employee = activeEligibleEmployees[(roundSeed + step) % activeEligibleEmployees.length]
      if (!employee) continue

      const current = effectivePresence.get(employee.id)
      if (current?.areaId) {
        roundMovements.push({
          id: nextSimulationId('sim-round-exit'),
          employeeId: employee.id,
          areaId: current.areaId,
          cardUid: current.cardUid,
          movement: 'exit',
          occurredAt: new Date(baseTime + step * 1000).toISOString(),
          simulated: true,
        })
        simulatedAreaCounts.set(
          current.areaId,
          Math.max(0, (simulatedAreaCounts.get(current.areaId) ?? 1) - 1),
        )
        continue
      }

      let chosenDestination: AreaDto | null = null
      for (let offset = 0; offset < destinationAreas.length; offset += 1) {
        const candidate = destinationAreas[(roundSeed + step + offset) % destinationAreas.length]
        if (!candidate) continue
        const occupancy = simulatedAreaCounts.get(candidate.id) ?? 0
        if (evaluateEntryRules(employee, candidate, occupancy) === null) {
          chosenDestination = candidate
          break
        }
      }

      if (!chosenDestination) continue

      roundMovements.push({
        id: nextSimulationId('sim-round-entry'),
        employeeId: employee.id,
        areaId: chosenDestination.id,
        cardUid:
          activeCredentialByEmployee.get(employee.id)?.cardUid ??
          cardUidByEmployee.get(employee.id) ??
          'SIMULADO',
        movement: 'entry',
        occurredAt: new Date(baseTime + step * 1000).toISOString(),
        simulated: true,
      })
      simulatedAreaCounts.set(
        chosenDestination.id,
        (simulatedAreaCounts.get(chosenDestination.id) ?? 0) + 1,
      )
    }

    if (roundMovements.length === 0) {
      setFeedback({
        tone: 'warning',
        message:
          'Ningún empleado cumplió con tarjeta activa, permiso vigente y aforo disponible para esta ronda.',
      })
      return
    }

    setSimulatedMovements((currentMovements) => [...currentMovements, ...roundMovements])
    setRoundSeed((currentSeed) => currentSeed + 1)
    setSelectedZoneId(null)
    setSelectedEmployeeId(null)
    setFeedback({
      tone: 'success',
      message: `Ronda simulada: ${roundMovements.length} ${
        roundMovements.length === 1 ? 'movimiento aplicado' : 'movimientos aplicados'
      }.`,
    })
  }

  function handleReset() {
    setSimulatedMovements([])
    setSelectedZoneId(null)
    setSelectedEmployeeId(null)
    setFeedback({
      tone: 'info',
      message: 'Croquis restablecido con los eventos y ubicaciones del servidor.',
    })
  }

  const gridRowCount = Math.max(1, Math.ceil(orderedAreas.length / 2))

  return (
    <section className="croquis" aria-labelledby="areas-floor-plan-title">
      <style>{FLOOR_PLAN_STYLES}</style>

      <header className="croquis__header">
        <div>
          <h2 className="croquis__title" id="areas-floor-plan-title">
            Croquis de las áreas y ubicación en tiempo real (Simulación)
          </h2>
          <p className="croquis__subtitle">
            Las entradas concedidas ubican a cada empleado en su zona respetando estado, tarjeta
            RFID activa, permiso vigente y aforo. Una salida explícita o una segunda lectura
            consecutiva en la misma área lo mueve a {EXTERIOR_STATE_LABEL}.
          </p>
        </div>

        <div className="croquis__header-actions">
          <span className={`croquis__live${loading ? ' is-loading' : ''}`}>
            <span className="croquis__live-dot" aria-hidden="true" />
            {loading ? 'Sincronizando eventos…' : `${serverEvents.length} eventos del servidor`}
          </span>
          {showSimulator ? (
            <span className="croquis__sim-count">
              {simulatedMovements.length}{' '}
              {simulatedMovements.length === 1 ? 'simulación activa' : 'simulaciones activas'}
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setReloadKey((current) => current + 1)}
              disabled={loading}
            >
              <RefreshCw size={13} aria-hidden="true" />
              Actualizar eventos
            </button>
          )}
        </div>
      </header>

      {showSimulator ? (
        <div className="croquis__controls">
          <form className="croquis__control-form" onSubmit={handleSimulateMovement}>
            <div className="croquis__field">
              <label htmlFor="floor-plan-employee">Empleado a mover</label>
              <select
                id="floor-plan-employee"
                className="select-control"
                value={effectiveEmployeeId}
                onChange={(event) => setMovementEmployeeId(event.target.value)}
                disabled={simulationDisabled}
              >
                {employeeOptions.length === 0 ? (
                  <option value="">Sin empleados disponibles</option>
                ) : null}
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.code})
                    {employee.status && employee.status !== 'active'
                      ? ` — ${EMPLOYEE_STATUS_LABELS[employee.status]}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="croquis__field">
              <label htmlFor="floor-plan-movement">Movimiento</label>
              <select
                id="floor-plan-movement"
                className="select-control"
                value={movement}
                onChange={(event) => setMovement(event.target.value as MovementKind)}
              >
                <option value="entry">Entrada al área</option>
                <option value="exit">Salida del área</option>
              </select>
            </div>

            <div className="croquis__field">
              <label htmlFor="floor-plan-destination">Área de destino</label>
              <select
                id="floor-plan-destination"
                className="select-control"
                value={effectiveDestinationId}
                onChange={(event) => setMovementAreaId(event.target.value)}
                disabled={movement === 'exit' || destinationAreas.length === 0}
              >
                {destinationAreas.length === 0 ? (
                  <option value="">Sin áreas disponibles</option>
                ) : null}
                {destinationAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm croquis__submit"
              disabled={simulationDisabled}
            >
              <ArrowRightLeft size={14} aria-hidden="true" />
              Simular movimiento (Entrada / Salida)
            </button>
          </form>

          <div className="croquis__quick-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSimulatedRound}
              disabled={simulationDisabled || destinationAreas.length === 0}
            >
              <Shuffle size={14} aria-hidden="true" />
              Simular ronda de accesos
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleReset}
              disabled={simulatedMovements.length === 0}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Restablecer con datos del servidor
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setReloadKey((current) => current + 1)}
              disabled={loading}
            >
              <RefreshCw size={13} aria-hidden="true" />
              Actualizar eventos
            </button>
            <label className="form-row-checkbox" htmlFor="floor-plan-include-inactive">
              <input
                id="floor-plan-include-inactive"
                type="checkbox"
                checked={includeInactiveEmployees}
                onChange={(event) => setIncludeInactiveEmployees(event.target.checked)}
              />
              Incluir inactivos/suspendidos (para probar rechazos)
            </label>
          </div>
        </div>
      ) : null}

      {showSimulator && feedback ? (
        <p
          className={`croquis__feedback croquis__feedback--${feedback.tone}`}
          role={feedback.tone === 'error' || feedback.tone === 'warning' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' || feedback.tone === 'warning' ? 'assertive' : 'polite'}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="croquis__search">
        <label className="croquis__search-label" htmlFor="floor-plan-search">
          Buscar empleado en el croquis
        </label>
        <div className="croquis__search-row">
          <Search size={16} aria-hidden="true" className="croquis__search-icon" />
          <input
            id="floor-plan-search"
            type="search"
            className="input-control croquis__search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, código EMP-... o tarjeta"
            autoComplete="off"
            spellCheck={false}
          />
          {searchActive ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSearch('')}
            >
              Limpiar
            </button>
          ) : null}
        </div>
        {searchStatus ? (
          <p
            className={`croquis__search-status${searchMatches.labels.length === 0 ? ' is-empty' : ''}`}
            role="status"
            aria-live="polite"
          >
            {searchStatus}
          </p>
        ) : null}
      </div>

      <div className="croquis__layout">
        <div className="croquis__plan">
          <div className="croquis__plan-caption">
            <span>Plano táctico · edificio principal</span>
            <span>
              {totalInside} en áreas · {exteriorPeople.length} fuera
            </span>
          </div>

          {orderedAreas.length === 0 ? (
            <p className="croquis__empty-plan">
              Sin áreas en el croquis. Crea o activa áreas para dibujar el plano.
            </p>
          ) : (
            <div className="croquis__grid">
              <div
                className="croquis__corridor"
                style={{ gridColumn: 2, gridRow: `1 / span ${gridRowCount}` }}
                aria-hidden="true"
              >
                Pasillo central
              </div>

              {orderedAreas.map((area, index) => (
                <div
                  key={area.id}
                  className="croquis__zone-slot"
                  style={{ gridColumn: index % 2 === 0 ? 1 : 3, gridRow: Math.floor(index / 2) + 1 }}
                >
                  <FloorZone
                    area={area}
                    people={peopleByArea.get(area.id) ?? []}
                    selected={selectedZoneId === area.id}
                    matched={searchActive && searchMatches.zoneIds.has(area.id)}
                    searchActive={searchActive}
                    highlightedEmployeeIds={searchMatches.employeeIds}
                    selectedEmployeeId={selectedEmployeeId}
                    onSelectZone={handleSelectZone}
                    onSelectEmployee={handleSelectEmployee}
                  />
                </div>
              ))}
            </div>
          )}

          <ExteriorZone
            people={exteriorPeople}
            selected={exteriorSelected}
            matched={searchActive && searchMatches.zoneIds.has(EXTERIOR_ZONE_ID)}
            searchActive={searchActive}
            highlightedEmployeeIds={searchMatches.employeeIds}
            selectedEmployeeId={selectedEmployeeId}
            onSelectZone={() => handleSelectZone(EXTERIOR_ZONE_ID)}
            onSelectEmployee={(employeeId) => handleSelectEmployee(employeeId, null)}
          />

          <div
            className="croquis__legend"
            role="group"
            aria-label="Simbología del croquis"
          >
            <span className="croquis__legend-title">Simbología:</span>
            <span className="croquis__legend-item">
              <span
                className="croquis__legend-swatch croquis__legend-swatch--entry"
                aria-hidden="true"
              >
                <PersonitaIcon className="croquis__personita-icon" />
              </span>
              Empleado en área (última lectura: entrada)
            </span>
            <span className="croquis__legend-item">
              <span
                className="croquis__legend-swatch croquis__legend-swatch--exit"
                aria-hidden="true"
              >
                <PersonitaIcon className="croquis__personita-icon" />
              </span>
              Empleado en exterior (última lectura: salida)
            </span>
          </div>
        </div>

        <FloorPlanPanel
          selectedArea={selectedArea}
          exteriorSelected={exteriorSelected}
          people={selectedPeople}
          log={selectedLog}
          employeeById={employeeViews}
          totalInside={totalInside}
          totalOutside={exteriorPeople.length}
          analyzedEvents={serverEvents.length}
          simulatedMovements={simulatedMovements.length}
          showSimulationStats={showSimulator}
          onClose={() => {
            setSelectedZoneId(null)
            setSelectedEmployeeId(null)
          }}
          onSelectEmployee={(employeeId) =>
            handleSelectEmployee(employeeId, selectedZoneId === EXTERIOR_ZONE_ID ? null : selectedZoneId)
          }
        />
      </div>
    </section>
  )
}

const FLOOR_PLAN_STYLES = `
  .croquis {
    --fp-canvas: var(--bg-canvas, #222831);
    --fp-surface: var(--bg-surface, #31363f);
    --fp-elevated: var(--bg-surface-elevated, #282e37);
    --fp-border: var(--border-subtle, rgba(238, 238, 238, 0.13));
    --fp-border-strong: var(--border-strong, rgba(238, 238, 238, 0.26));
    --fp-text: var(--text-primary, #eeeeee);
    --fp-secondary: var(--text-secondary, #c5cdd3);
    --fp-muted: var(--text-muted, #9aa5ae);
    --fp-accent: var(--accent-primary, #76abae);
    --fp-accent-soft: var(--accent-primary-soft, rgba(118, 171, 174, 0.18));
    --fp-granted: var(--status-granted, #34d399);
    --fp-warning: var(--status-warning, #fbbf24);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-md, 10px);
    background: var(--fp-surface);
    color: var(--fp-text);
  }

  .croquis__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.9rem;
    flex-wrap: wrap;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid var(--fp-border);
  }

  .croquis__title {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: var(--fp-text);
    text-wrap: balance;
  }

  .croquis__subtitle {
    margin: 0.25rem 0 0;
    max-width: 72ch;
    color: var(--fp-secondary);
    font-size: 0.82rem;
    line-height: 1.45;
    text-wrap: pretty;
  }

  .croquis__header-actions {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .croquis__live {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.28rem 0.65rem;
    border: 1px solid var(--fp-border);
    border-radius: 999px;
    background: var(--fp-elevated);
    color: var(--fp-secondary);
    font-family: var(--font-mono, monospace);
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .croquis__live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--fp-granted);
  }

  .croquis__live.is-loading .croquis__live-dot {
    background: var(--fp-warning);
  }

  .croquis__sim-count {
    color: var(--fp-muted);
    font-size: 0.74rem;
    font-variant-numeric: tabular-nums;
  }

  .croquis__controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.9rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-md, 10px);
    background: var(--fp-elevated);
  }

  .croquis__control-form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.65rem;
  }

  .croquis__field {
    display: flex;
    flex: 1 1 150px;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 140px;
  }

  .croquis__field label {
    color: var(--fp-secondary);
    font-size: 0.74rem;
    font-weight: 600;
  }

  .croquis__field .input-control,
  .croquis__field .select-control {
    width: 100%;
  }

  .croquis__submit {
    margin-left: auto;
  }

  .croquis__quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .croquis__feedback {
    margin: 0;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--accent-primary-border, var(--fp-accent));
    border-radius: var(--radius-sm, 6px);
    background: var(--fp-accent-soft);
    color: var(--fp-text);
    font-size: 0.8rem;
  }

  .croquis__feedback--success {
    border-color: var(--status-granted-border, rgba(13, 148, 136, 0.35));
    background: var(--status-granted-soft, rgba(13, 148, 136, 0.12));
    color: var(--status-granted-text, var(--fp-text));
  }

  .croquis__feedback--warning {
    border-color: var(--status-warning-border, rgba(180, 83, 9, 0.35));
    background: var(--status-warning-soft, rgba(180, 83, 9, 0.12));
    color: var(--status-warning-text, var(--fp-text));
  }

  .croquis__feedback--error {
    border-color: var(--status-denied-border, rgba(190, 18, 60, 0.35));
    background: var(--status-denied-soft, rgba(190, 18, 60, 0.12));
    color: var(--status-denied-text, var(--fp-text));
  }

  .croquis__search {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-md, 10px);
    background: var(--fp-elevated);
  }

  .croquis__search-label {
    color: var(--fp-secondary);
    font-size: 0.74rem;
    font-weight: 600;
  }

  .croquis__search-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .croquis__search-icon {
    flex-shrink: 0;
    color: var(--fp-muted);
  }

  .croquis__search-input {
    flex: 1;
    min-width: 0;
  }

  .croquis__search-status {
    margin: 0;
    color: var(--fp-accent);
    font-size: 0.76rem;
  }

  .croquis__search-status.is-empty {
    color: var(--fp-warning);
  }

  .croquis__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 1rem;
  }

  .croquis__plan {
    overflow: hidden;
    padding: 0.95rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-md, 10px);
    background: var(--fp-canvas);
  }

  .croquis__plan-caption {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
    color: var(--fp-muted);
    font-family: var(--font-mono, monospace);
    font-size: 0.7rem;
  }

  .croquis__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 26px minmax(0, 1fr);
    gap: 0.65rem;
  }

  .croquis__corridor {
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: 1px solid var(--fp-border);
    border-right: 1px solid var(--fp-border);
    border-radius: var(--radius-sm, 6px);
    background: var(--fp-elevated);
    color: var(--fp-muted);
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-orientation: mixed;
    writing-mode: vertical-rl;
  }

  .croquis__zone-slot {
    min-width: 0;
  }

  .croquis__zone {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    height: 100%;
    padding: 0.85rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-md, 10px);
    background: var(--fp-surface);
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .croquis__zone:hover {
    border-color: var(--fp-border-strong);
  }

  .croquis__zone.is-selected {
    border-color: var(--fp-accent);
    box-shadow: inset 0 0 0 1px var(--fp-accent);
  }

  .croquis__zone.is-match {
    border-color: var(--fp-accent);
    background: color-mix(in srgb, var(--fp-accent-soft) 35%, var(--fp-surface));
  }

  .croquis__zone.is-inactive {
    opacity: 0.7;
  }

  .croquis__zone-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .croquis__zone-head:focus-visible,
  .croquis__exterior-head:focus-visible {
    outline: 2px solid var(--fp-accent);
    outline-offset: 3px;
    border-radius: 4px;
  }

  .croquis__zone-name {
    min-width: 0;
    font-size: 0.84rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .croquis__zone-code {
    color: var(--fp-muted);
    font-family: var(--font-mono, monospace);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  .croquis__occupancy,
  .croquis__zone-security {
    color: var(--fp-secondary);
    font-size: 0.73rem;
  }

  .croquis__occupancy {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-variant-numeric: tabular-nums;
  }

  .croquis__zone-security {
    margin: 0;
    color: var(--fp-muted);
  }

  .croquis__capacity-track {
    height: 4px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--fp-border);
  }

  .croquis__capacity-fill {
    height: 100%;
    background: var(--fp-granted);
    transition: width 0.25s ease;
  }

  .croquis__capacity-fill.is-full {
    background: var(--fp-warning);
  }

  .croquis__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.1rem;
  }

  .croquis__chip {
    --personita-tone: var(--fp-granted);
    --personita-tone-soft: var(--status-granted-soft, rgba(52, 211, 153, 0.16));
    --personita-tone-border: var(--status-granted-border, rgba(52, 211, 153, 0.38));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--personita-tone-border);
    border-radius: 50%;
    background: var(--personita-tone-soft);
    color: var(--personita-tone);
    cursor: pointer;
    transition: border-color 0.15s ease, opacity 0.15s ease, background-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .croquis__chip--exit {
    --personita-tone: var(--fp-warning);
    --personita-tone-soft: var(--status-warning-soft, rgba(251, 191, 36, 0.16));
    --personita-tone-border: var(--status-warning-border, rgba(251, 191, 36, 0.4));
  }

  .croquis__chip:hover {
    border-color: var(--personita-tone);
    background: var(--fp-elevated);
  }

  .croquis__chip.is-selected {
    border-color: var(--fp-accent);
    box-shadow: 0 0 0 2px var(--fp-accent);
  }

  .croquis__chip.is-dimmed {
    opacity: 0.32;
  }

  .croquis__chip:focus-visible {
    outline: 2px solid var(--fp-accent);
    outline-offset: 2px;
  }

  .croquis__personita-icon {
    display: block;
    width: 20px;
    height: 20px;
  }

  .croquis__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border: 1px solid var(--accent-primary-border, var(--fp-accent));
    border-radius: 50%;
    background: var(--fp-accent-soft);
    color: var(--fp-accent);
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
    font-weight: 700;
  }

  .croquis__chip-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .croquis__chip-name {
    max-width: 150px;
    overflow: hidden;
    color: var(--fp-text);
    font-size: 0.72rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .croquis__chip-meta {
    color: var(--fp-muted);
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
    white-space: nowrap;
  }

  .croquis__movement {
    display: inline-flex;
    align-items: center;
    gap: 0.18rem;
    font-size: 0.62rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .croquis__movement--entry {
    color: var(--fp-granted);
  }

  .croquis__movement--exit {
    color: var(--fp-warning);
  }

  .croquis__zone-empty,
  .croquis__empty-plan,
  .croquis__panel-empty {
    margin: 0;
    color: var(--fp-muted);
    font-size: 0.74rem;
    font-style: italic;
  }

  .croquis__empty-plan {
    padding: 1rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-md, 10px);
    text-align: center;
  }

  .croquis__exterior {
    margin-top: 0.75rem;
    padding: 0.8rem 0.85rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-md, 10px);
    background: var(--fp-surface);
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .croquis__exterior:hover {
    border-color: var(--fp-border-strong);
  }

  .croquis__exterior.is-selected {
    border-color: var(--fp-accent);
    box-shadow: inset 0 0 0 1px var(--fp-accent);
  }

  .croquis__exterior.is-match {
    border-color: var(--fp-accent);
    background: color-mix(in srgb, var(--fp-accent-soft) 35%, var(--fp-surface));
  }

  .croquis__exterior-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .croquis__exterior-title {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .croquis__exterior-title strong {
    font-size: 0.82rem;
    font-weight: 600;
  }

  .croquis__exterior-title span {
    color: var(--fp-muted);
    font-size: 0.7rem;
  }

  .croquis__exterior-count {
    color: var(--fp-warning);
    font-family: var(--font-mono, monospace);
    font-size: 0.72rem;
  }

  .croquis__legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem 1rem;
    margin-top: 0.85rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--fp-border);
    color: var(--fp-secondary);
    font-size: 0.72rem;
  }

  .croquis__legend-title {
    color: var(--fp-text);
    font-family: var(--font-mono, monospace);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .croquis__legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .croquis__legend-swatch {
    --legend-tone: var(--fp-granted);
    --legend-tone-soft: var(--status-granted-soft, rgba(52, 211, 153, 0.16));
    --legend-tone-border: var(--status-granted-border, rgba(52, 211, 153, 0.38));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: 1px solid var(--legend-tone-border);
    border-radius: 50%;
    background: var(--legend-tone-soft);
    color: var(--legend-tone);
  }

  .croquis__legend-swatch--exit {
    --legend-tone: var(--fp-warning);
    --legend-tone-soft: var(--status-warning-soft, rgba(251, 191, 36, 0.16));
    --legend-tone-border: var(--status-warning-border, rgba(251, 191, 36, 0.4));
  }

  .croquis__legend-swatch .croquis__personita-icon {
    width: 15px;
    height: 15px;
  }

  .croquis__panel {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-md, 10px);
    background: var(--fp-elevated);
  }

  .croquis__panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .croquis__panel-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    text-wrap: balance;
  }

  .croquis__panel-subtitle {
    margin: 0.2rem 0 0;
    color: var(--fp-accent);
    font-family: var(--font-mono, monospace);
    font-size: 0.7rem;
  }

  .croquis__panel-copy,
  .croquis__panel-note {
    margin: 0;
    color: var(--fp-secondary);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .croquis__panel-note {
    padding-top: 0.6rem;
    border-top: 1px solid var(--fp-border);
    color: var(--fp-muted);
    font-size: 0.74rem;
  }

  .croquis__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
    gap: 0.5rem;
    margin: 0;
  }

  .croquis__stat {
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-sm, 6px);
    background: var(--fp-surface);
  }

  .croquis__stat dt {
    color: var(--fp-muted);
    font-size: 0.68rem;
  }

  .croquis__stat dd {
    margin: 0.15rem 0 0;
    color: var(--fp-text);
    font-family: var(--font-mono, monospace);
    font-size: 1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .croquis__panel-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .croquis__panel-section h4 {
    margin: 0;
    color: var(--fp-secondary);
    font-size: 0.74rem;
    font-weight: 600;
  }

  .croquis__panel-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 240px;
    margin: 0;
    padding: 0;
    overflow: auto;
    overscroll-behavior: contain;
    list-style: none;
  }

  .croquis__panel-person {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--fp-border);
    border-radius: var(--radius-sm, 6px);
    background: var(--fp-surface);
    color: var(--fp-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .croquis__panel-person:hover {
    border-color: var(--fp-accent);
  }

  .croquis__panel-person:focus-visible {
    outline: 2px solid var(--fp-accent);
    outline-offset: 2px;
  }

  .croquis__timeline-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.2rem 0.45rem;
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--fp-border);
    border-left: 2px solid var(--fp-border-strong);
    border-radius: var(--radius-sm, 6px);
    background: var(--fp-surface);
    font-size: 0.72rem;
  }

  .croquis__timeline-item.is-simulated {
    border-left-color: var(--fp-accent);
  }

  .croquis__timeline-name {
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .croquis__timeline-time {
    color: var(--fp-muted);
    font-family: var(--font-mono, monospace);
    font-size: 0.64rem;
  }

  .croquis__timeline-meta {
    display: flex;
    grid-column: 2 / -1;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    color: var(--fp-muted);
    font-family: var(--font-mono, monospace);
    font-size: 0.62rem;
  }

  .croquis__sim-tag {
    padding: 0.05rem 0.35rem;
    border-radius: 999px;
    background: var(--fp-accent-soft);
    color: var(--fp-accent);
    font-size: 0.58rem;
    font-weight: 700;
  }

  @media (min-width: 1100px) {
    .croquis__layout {
      grid-template-columns: minmax(0, 1.75fr) minmax(280px, 1fr);
    }
  }

  @media (max-width: 720px) {
    .croquis {
      padding: 1rem;
    }

    .croquis__grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .croquis__corridor {
      display: none;
    }

    .croquis__zone-slot {
      grid-column: 1 !important;
      grid-row: auto !important;
    }

    .croquis__submit {
      margin-left: 0;
    }

    .croquis__chip-name {
      max-width: 120px;
    }
  }
`
