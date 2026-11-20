import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Cpu,
  CreditCard,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type {
  AccessDecision,
  AccessDeviceDto,
  AccessEventDto,
  AccessReason,
  AreaDto,
  DashboardSummaryDto,
  DeviceStatus,
  EmployeeDto,
} from '@scaccess/shared'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT } from '../components/ui/TableMessage'
import { api } from '../lib/api'
import { usePermissions } from '../lib/permissions'
import {
  DEVICE_STATUS_LABELS,
  REASON_LABELS,
  formatDateTimeWithSeconds,
  formatRelativeMinutes,
} from '../lib/formatters'

const TIME_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const PULSE_TIME_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
})

const UNKNOWN_AREA_LABEL = 'Área sin catálogo'
const UNKNOWN_PERSON_LABEL = 'Tarjeta no asociada'

const CHART_DECISION_LABELS: Record<AccessDecision, string> = {
  granted: 'Permitido',
  denied: 'Denegado',
}

const REASON_CHART_LABELS: Record<string, string> = {
  allowed: 'Acceso permitido',
  card_unknown: 'Tarjeta desconocida',
}

const EXIT_DIRECTION_VALUES = new Set([
  'exit',
  'out',
  'salida',
  'leave',
  'departure',
  'check-out',
  'checkout',
])

const ENTRY_DIRECTION_VALUES = new Set([
  'entry',
  'in',
  'entrada',
  'enter',
  'arrival',
  'check-in',
  'checkin',
])

type EventDirection = 'entry' | 'exit'

interface AccessEventChartExtension {
  area?: { name?: string | null } | null
  employee?: { fullName?: string | null } | null
  credentialUid?: string | null
  decisionReason?: string | null
}

interface AreaActivityBucket {
  areaName: string
  total: number
  granted: number
  denied: number
}

interface ReasonActivityBucket {
  reasonCode: string
  label: string
  total: number
  denied: number
}

interface TimelineChartEvent {
  id: string
  occurredAt: string
  areaName: string
  decision: AccessDecision
  decisionLabel: string
  direction: EventDirection
  directionLabel: string
  personLabel: string
  heightPercent: number
}

function toTimestamp(iso: string): number {
  const parsed = new Date(iso).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatClockTime(iso: string): string {
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? '—' : PULSE_TIME_FORMATTER.format(parsed)
}

function formatReasonLabel(reasonCode: string): string {
  const chartLabel = REASON_CHART_LABELS[reasonCode]
  if (chartLabel) return chartLabel
  if (reasonCode in REASON_LABELS) {
    return REASON_LABELS[reasonCode as AccessReason]
  }
  return reasonCode
}

function readEventDirection(metadata: unknown): EventDirection {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 'entry'
  }

  const record = metadata as Record<string, unknown>
  for (const key of ['direction', 'action', 'movement', 'type']) {
    const value = record[key]
    if (typeof value !== 'string') continue

    const normalized = value.trim().toLowerCase()
    if (EXIT_DIRECTION_VALUES.has(normalized)) return 'exit'
    if (ENTRY_DIRECTION_VALUES.has(normalized)) return 'entry'
  }

  return 'entry'
}

function resolveEventAreaName(
  event: AccessEventDto,
  areasById: Record<string, AreaDto>,
): string {
  const extension = event as AccessEventDto & AccessEventChartExtension
  return extension.area?.name ?? areasById[event.areaId]?.name ?? UNKNOWN_AREA_LABEL
}

function resolveEventPersonLabel(
  event: AccessEventDto,
  employeesById: Record<string, EmployeeDto>,
): string {
  const extension = event as AccessEventDto & AccessEventChartExtension
  const employee = event.employeeId ? employeesById[event.employeeId] : undefined
  const fullName =
    extension.employee?.fullName ??
    (employee ? `${employee.firstName} ${employee.lastName}`.trim() : null)
  const cardUid = extension.credentialUid ?? event.cardUid

  if (fullName) {
    return cardUid ? `${fullName} · ${cardUid}` : fullName
  }
  return cardUid || UNKNOWN_PERSON_LABEL
}

function resolveEventReasonCode(event: AccessEventDto): string {
  const extension = event as AccessEventDto & AccessEventChartExtension
  return extension.decisionReason ?? event.reasonCode
}

const MAX_VISIBLE_DEVICES = 5

interface KpiCardItem {
  label: string
  Icon: LucideIcon
  value: number | string
  meta: string
  hoverDetails: string[]
  to: string
  linkText: string
  linkAriaLabel: string
  variant?: 'variant-granted' | 'variant-denied' | 'variant-warning'
}

interface BuildKpiCardsParams {
  summary: DashboardSummaryDto | null
  hasRecentActivity: boolean
  grantedPct: number
  deniedPct: number
  outOfSync: number
  total24h: number
  activeAreasCount: number
  recentGrantedCount: number
  topDeniedReasonLabel: string
  canViewCatalogs: boolean
  canWriteCatalog: boolean
}

function deviceBadgeVariant(status: DeviceStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'maintenance') return 'warning'
  return 'neutral'
}

function buildKpiCards({
  summary,
  hasRecentActivity,
  grantedPct,
  deniedPct,
  outOfSync,
  total24h,
  activeAreasCount,
  recentGrantedCount,
  topDeniedReasonLabel,
  canViewCatalogs,
  canWriteCatalog,
}: BuildKpiCardsParams): KpiCardItem[] {
  const inactiveEmployees = summary
    ? Math.max(0, summary.employees.total - summary.employees.active)
    : '—'
  const activeEmployeesPct =
    summary && summary.employees.total > 0
      ? Math.round((summary.employees.active / summary.employees.total) * 100)
      : 0
  const credentialCoveragePct =
    summary && summary.employees.active > 0
      ? Math.min(100, Math.round((summary.credentials.active / summary.employees.active) * 100))
      : 0
  const inactiveAreas = summary ? Math.max(0, summary.areas.total - summary.areas.active) : '—'
  const syncedDevices = summary ? Math.max(0, summary.devices.active - outOfSync) : '—'
  const inactiveDevices = summary
    ? Math.max(0, summary.devices.total - summary.devices.active)
    : '—'

  const areasCard: KpiCardItem = {
    label: 'Areas protegidas',
    Icon: Building2,
    value: summary ? summary.areas.active : '—',
    meta: `Total configuradas: ${summary ? summary.areas.total : '—'}`,
    hoverDetails: [
      `Areas inactivas: ${inactiveAreas}`,
      `Con actividad reciente: ${activeAreasCount} area(s)`,
    ],
    to: '/areas',
    linkText: canViewCatalogs ? 'Ver areas' : 'Ver croquis',
    linkAriaLabel: canViewCatalogs ? 'Ver areas protegidas' : 'Ver croquis de areas protegidas',
  }

  const grantedCard: KpiCardItem = {
    label: 'Accesos concedidos (24h)',
    Icon: CheckCircle2,
    value: summary ? summary.recentEvents24h.granted : '—',
    meta: hasRecentActivity ? `${grantedPct}% de intentos recientes` : 'Sin actividad reciente',
    hoverDetails: [
      `Total evaluados (24h): ${total24h}`,
      `En muestra reciente: ${recentGrantedCount} permitido(s)`,
    ],
    to: '/access-events',
    linkText: 'Auditar',
    linkAriaLabel: 'Auditar accesos concedidos',
    variant: 'variant-granted',
  }

  const deniedCard: KpiCardItem = {
    label: 'Accesos denegados (24h)',
    Icon: ShieldAlert,
    value: summary ? summary.recentEvents24h.denied : '—',
    meta: hasRecentActivity ? `${deniedPct}% de rechazos (24h)` : 'Sin rechazos recientes',
    hoverDetails: [
      `Total evaluados (24h): ${total24h}`,
      `Motivo principal: ${topDeniedReasonLabel}`,
    ],
    to: '/access-events',
    linkText: 'Ver rechazos',
    linkAriaLabel: 'Ver accesos denegados',
    variant: 'variant-denied',
  }

  if (!canViewCatalogs) {
    return [areasCard, grantedCard, deniedCard]
  }

  return [
    {
      label: 'Empleados activos',
      Icon: Users,
      value: summary ? summary.employees.active : '—',
      meta: `Total registrados: ${summary ? summary.employees.total : '—'}`,
      hoverDetails: [
        `Inactivos / baja: ${inactiveEmployees}`,
        `Personal activo: ${activeEmployeesPct}% del padron`,
      ],
      to: '/employees',
      linkText: canWriteCatalog ? 'Gestionar' : 'Ver empleados',
      linkAriaLabel: canWriteCatalog ? 'Gestionar empleados' : 'Ver empleados',
    },
    {
      label: 'Tarjetas RFID activas',
      Icon: CreditCard,
      value: summary ? summary.credentials.active : '—',
      meta: `Bloqueadas / extraviadas: ${summary ? summary.credentials.blockedOrLost : '—'}`,
      hoverDetails: [
        `Total emitidas: ${summary ? summary.credentials.total : '—'}`,
        `Cobertura por empleado activo: ${credentialCoveragePct}%`,
      ],
      to: '/credentials',
      linkText: 'Ver tarjetas',
      linkAriaLabel: 'Ver tarjetas RFID',
    },
    areasCard,
    {
      label: 'Controladores ESP32',
      Icon: Cpu,
      value: summary ? `${summary.devices.active}/${summary.devices.total}` : '—',
      meta: `Desactualizados: ${summary ? outOfSync : '—'}`,
      hoverDetails: [
        `Sincronizados al dia: ${syncedDevices}`,
        `Inactivos / mantenimiento: ${inactiveDevices}`,
      ],
      to: '/devices',
      linkText: 'Sincronizacion',
      linkAriaLabel: 'Revisar sincronizacion de controladores',
      variant: summary && outOfSync > 0 ? 'variant-warning' : 'variant-granted',
    },
    grantedCard,
    deniedCard,
  ]
}

function isFocusWithinTarget(
  currentTarget: EventTarget & HTMLElement,
  relatedTarget: EventTarget | null,
): boolean {
  return relatedTarget instanceof Node && currentTarget.contains(relatedTarget)
}

export function DashboardPage() {
  const { canViewCatalogs, canWriteCatalog, profileLabel } = usePermissions()
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null)
  const [recentEvents, setRecentEvents] = useState<AccessEventDto[]>([])
  const [devices, setDevices] = useState<AccessDeviceDto[]>([])
  const [areasById, setAreasById] = useState<Record<string, AreaDto>>({})
  const [employeesById, setEmployeesById] = useState<Record<string, EmployeeDto>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [hoveredKpi, setHoveredKpi] = useState<string | null>(null)
  const [hoveredArea, setHoveredArea] = useState<string | null>(null)
  const [hoveredPulseId, setHoveredPulseId] = useState<string | null>(null)
  const [hoveredReason, setHoveredReason] = useState<string | null>(null)
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, eventsRes, devicesRes, areasRes, employeesRes] = await Promise.all([
        api.getDashboardSummary(),
        api.listAccessEvents({ page: 1, pageSize: 8 }),
        canViewCatalogs
          ? api.listAccessDevices({ page: 1, pageSize: 20 })
          : Promise.resolve({ data: [] as AccessDeviceDto[] }),
        api.listAreas({ page: 1, pageSize: 100 }),
        canViewCatalogs
          ? api.listEmployees({ page: 1, pageSize: 100 })
          : Promise.resolve({ data: [] as EmployeeDto[] }),
      ])

      setSummary(summaryRes)
      setRecentEvents(eventsRes.data)
      setDevices(devicesRes.data)

      const areaMap: Record<string, AreaDto> = {}
      for (const area of areasRes.data) {
        areaMap[area.id] = area
      }
      setAreasById(areaMap)

      const empMap: Record<string, EmployeeDto> = {}
      for (const emp of employeesRes.data) {
        empMap[emp.id] = emp
      }
      setEmployeesById(empMap)
      setLastUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el panel de control.')
    } finally {
      setLoading(false)
    }
  }, [canViewCatalogs])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const areaActivity = useMemo<AreaActivityBucket[]>(() => {
    const byArea = new Map<string, AreaActivityBucket>()

    for (const event of recentEvents) {
      const areaName = resolveEventAreaName(event, areasById)
      const current = byArea.get(areaName) ?? {
        areaName,
        total: 0,
        granted: 0,
        denied: 0,
      }
      current.total += 1
      if (event.decision === 'granted') {
        current.granted += 1
      } else {
        current.denied += 1
      }
      byArea.set(areaName, current)
    }

    return [...byArea.values()]
      .toSorted(
        (left, right) =>
          right.total - left.total || left.areaName.localeCompare(right.areaName, 'es'),
      )
      .slice(0, 6)
  }, [recentEvents, areasById])

  const reasonActivity = useMemo<ReasonActivityBucket[]>(() => {
    const byReason = new Map<string, ReasonActivityBucket>()

    for (const event of recentEvents) {
      const reasonCode = resolveEventReasonCode(event)
      const current = byReason.get(reasonCode) ?? {
        reasonCode,
        label: formatReasonLabel(reasonCode),
        total: 0,
        denied: 0,
      }
      current.total += 1
      if (event.decision === 'denied') {
        current.denied += 1
      }
      byReason.set(reasonCode, current)
    }

    return [...byReason.values()]
      .toSorted(
        (left, right) =>
          right.total - left.total || left.label.localeCompare(right.label, 'es'),
      )
      .slice(0, 6)
  }, [recentEvents])

  const timelineEvents = useMemo<TimelineChartEvent[]>(() => {
    const ordered = recentEvents
      .map((event) => ({ event, timestamp: toTimestamp(event.occurredAt) }))
      .toSorted((left, right) => right.timestamp - left.timestamp)
      .slice(0, 12)

    return ordered.map(({ event }, index) => {
      const recencyRatio = ordered.length <= 1 ? 1 : 1 - index / (ordered.length - 1)
      const direction = readEventDirection(event.metadata)

      return {
        id: event.id,
        occurredAt: event.occurredAt,
        areaName: resolveEventAreaName(event, areasById),
        decision: event.decision,
        decisionLabel: CHART_DECISION_LABELS[event.decision],
        direction,
        directionLabel: direction === 'entry' ? 'Entrada' : 'Salida',
        personLabel: resolveEventPersonLabel(event, employeesById),
        heightPercent: Math.round(32 + recencyRatio * 68),
      }
    })
  }, [recentEvents, areasById, employeesById])

  const total24h = summary
    ? summary.recentEvents24h.granted + summary.recentEvents24h.denied
    : 0
  const grantedPct =
    total24h > 0 && summary
      ? Math.round((summary.recentEvents24h.granted / total24h) * 100)
      : 0
  const deniedPct = total24h > 0 ? 100 - grantedPct : 0
  const hasRecentActivity = total24h > 0
  const outOfSync = summary ? summary.devices.outOfSync : 0
  const maxReasonTotal = reasonActivity[0]?.total ?? 0
  const visibleDevices = devices.slice(0, MAX_VISIBLE_DEVICES)
  const recentGrantedCount = useMemo(
    () => recentEvents.filter((ev) => ev.decision === 'granted').length,
    [recentEvents],
  )
  const topDeniedReasonLabel = useMemo(() => {
    const topDenied = reasonActivity
      .filter((bucket) => bucket.denied > 0)
      .toSorted(
        (left, right) => right.denied - left.denied || left.label.localeCompare(right.label, 'es'),
      )[0]
    return topDenied ? topDenied.label : 'Sin rechazos en muestra'
  }, [reasonActivity])
  const inspectedPulseEvent =
    timelineEvents.find((item) => item.id === hoveredPulseId) ?? timelineEvents[0] ?? null
  const kpiCards = buildKpiCards({
    summary,
    hasRecentActivity,
    grantedPct,
    deniedPct,
    outOfSync,
    total24h,
    activeAreasCount: areaActivity.length,
    recentGrantedCount,
    topDeniedReasonLabel,
    canViewCatalogs,
    canWriteCatalog,
  })

  const dashboardDescription = !canViewCatalogs
    ? 'Monitoreo en vivo de accesos recientes y estado por area.'
    : !canWriteCatalog
      ? 'Consulta operativa de indicadores, actividad reciente y estado de controladores.'
      : 'Resumen operativo de accesos, acreditaciones y controladores ESP32-S3 (24h).'

  return (
    <div className="dashboard-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Centro de Monitoreo Operativo</h1>
          <p className="page-description">{dashboardDescription}</p>
        </div>
        <div className="dashboard-header-actions">
          <StatusBadge variant="info">Perfil: {profileLabel}</StatusBadge>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadDashboard()}
            disabled={loading}
            aria-busy={loading}
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>{loading ? 'Actualizando…' : 'Actualizar telemetria'}</span>
          </button>
          {lastUpdatedAt ? (
            <span className="table-meta" role="status" aria-live="polite">
              Telemetria actualizada a las{' '}
              <time dateTime={lastUpdatedAt.toISOString()}>
                {TIME_FORMATTER.format(lastUpdatedAt)}
              </time>
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="alert-banner error" role="alert" aria-live="assertive" aria-atomic="true">
          <span className="dashboard-alert-copy">{error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadDashboard()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {canViewCatalogs && summary && summary.devices.outOfSync > 0 ? (
        <div className="alert-banner warning" role="status">
          <div className="dashboard-alert-copy">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>
              Atencion operativa: <strong>{summary.devices.outOfSync}</strong> controlador(es)
              activo(s) tienen cambios de configuracion pendientes de sincronizar.
            </span>
          </div>
          <Link to="/devices" className="btn btn-secondary btn-sm">
            Revisar controladores
          </Link>
        </div>
      ) : null}

      <section className="kpi-grid" aria-label="Indicadores clave del sistema" aria-busy={loading}>
        {kpiCards.map((card) => {
          const isHovered = hoveredKpi === card.label
          const cardClassName = [
            'kpi-card',
            card.variant,
            isHovered ? 'is-hovered' : null,
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={card.label}
              className={cardClassName}
              onMouseEnter={() => setHoveredKpi(card.label)}
              onMouseLeave={() => setHoveredKpi((cur) => (cur === card.label ? null : cur))}
              onFocus={() => setHoveredKpi(card.label)}
              onBlur={(e) => {
                if (!isFocusWithinTarget(e.currentTarget, e.relatedTarget)) {
                  setHoveredKpi((cur) => (cur === card.label ? null : cur))
                }
              }}
            >
              <div className="kpi-header">
                <span>{card.label}</span>
                <card.Icon size={17} aria-hidden="true" />
              </div>
              <div className="kpi-value">{card.value}</div>
              <div className="kpi-meta">
                <span>{card.meta}</span>
                <Link to={card.to} className="kpi-link" aria-label={card.linkAriaLabel}>
                  {card.linkText}
                </Link>
              </div>
              <div className="kpi-detail-slot">
                {isHovered ? (
                  <div
                    className="kpi-hover-details"
                    role="region"
                    aria-label={`Detalle de ${card.label}`}
                  >
                    {card.hoverDetails.map((detail) => (
                      <p key={detail} className="kpi-hover-detail-item">
                        {detail}
                      </p>
                    ))}
                  </div>
                ) : (
                  <span className="kpi-detail-hint" aria-hidden="true">
                    Desglose operativo
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </section>

      <div className={canViewCatalogs ? 'dashboard-split' : 'dashboard-split dashboard-split--single'}>
        <section
          className="surface-card"
          aria-label="Últimos eventos de acceso registrados"
          aria-busy={loading}
        >
          <div className="dashboard-chart-header">
            <div>
              <h2 className="surface-card-title">
                <Activity size={18} aria-hidden="true" />
                <span>Últimos eventos de acceso registrados</span>
              </h2>
              <p className="chart-subpanel-meta">
                Actividad por área, pulso temporal y motivos de decisión.
              </p>
            </div>
            <Link to="/access-events" className="btn btn-secondary btn-sm">
              Ver bitácora completa <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="dashboard-ratio-strip">
            {hasRecentActivity ? (
              <>
                <div
                  className="ratio-bar-track"
                  role="img"
                  aria-label={`Proporcion de accesos de las ultimas 24 horas: ${summary?.recentEvents24h.granted ?? 0} concedidos (${grantedPct}%) y ${summary?.recentEvents24h.denied ?? 0} denegados (${deniedPct}%).`}
                >
                  <div
                    className="ratio-bar-granted"
                    style={{ width: `${grantedPct}%` }}
                    title={`Concedidos: ${summary?.recentEvents24h.granted ?? 0} (${grantedPct}%)`}
                  />
                  <div
                    className="ratio-bar-denied"
                    style={{ width: `${deniedPct}%` }}
                    title={`Denegados: ${summary?.recentEvents24h.denied ?? 0} (${deniedPct}%)`}
                  />
                </div>
                <div className="dashboard-legend">
                  <span className="legend-item">
                    <span className="legend-dot legend-dot--granted" aria-hidden="true" />
                    Concedidos: <strong>{summary?.recentEvents24h.granted ?? 0}</strong> (
                    {grantedPct}%)
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot legend-dot--denied" aria-hidden="true" />
                    Denegados: <strong>{summary?.recentEvents24h.denied ?? 0}</strong> ({deniedPct}
                    %)
                  </span>
                </div>
              </>
            ) : (
              <p className="table-meta" role="status">
                {loading
                  ? 'Consultando actividad de las ultimas 24 horas…'
                  : 'Sin eventos de acceso en las ultimas 24 horas.'}
              </p>
            )}
          </div>

          {recentEvents.length > 0 ? (
            <div
              role="img"
              aria-label="Gráfica de últimos eventos de acceso"
              className="dashboard-chart-grid"
            >
              <div className="chart-subpanel">
                <div>
                  <h3 className="chart-subpanel-title">
                    Accesos permitidos vs. denegados por área
                  </h3>
                  <p className="chart-subpanel-meta">
                    {recentEvents.length} lecturas recientes agrupadas por área física (máximo 6).
                  </p>
                </div>

                <div className="dashboard-legend">
                  <span className="legend-item">
                    <span className="legend-dot legend-dot--granted" aria-hidden="true" />
                    Permitidos
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot legend-dot--denied" aria-hidden="true" />
                    Denegados
                  </span>
                </div>

                <div className="area-list">
                  {areaActivity.map((bucket) => {
                    const grantedWidth =
                      bucket.total > 0 ? (bucket.granted / bucket.total) * 100 : 0
                    const deniedWidth = bucket.total > 0 ? (bucket.denied / bucket.total) * 100 : 0
                    const isAreaHovered = hoveredArea === bucket.areaName
                    const areaGrantedPct =
                      bucket.total > 0 ? Math.round((bucket.granted / bucket.total) * 100) : 0

                    return (
                      <div
                        key={bucket.areaName}
                        className={isAreaHovered ? 'area-row is-hovered' : 'area-row'}
                        onMouseEnter={() => setHoveredArea(bucket.areaName)}
                        onMouseLeave={() =>
                          setHoveredArea((cur) => (cur === bucket.areaName ? null : cur))
                        }
                      >
                        <div className="area-row-header">
                          <span className="area-name" title={bucket.areaName}>
                            {bucket.areaName}
                          </span>
                          <span className="area-counts">
                            <span
                              className="status-badge success"
                              title={`${bucket.granted} accesos permitidos`}
                            >
                              <CheckCircle2 size={11} aria-hidden="true" />
                              {bucket.granted}
                            </span>
                            <span
                              className="status-badge danger"
                              title={`${bucket.denied} accesos denegados`}
                            >
                              <XCircle size={11} aria-hidden="true" />
                              {bucket.denied}
                            </span>
                          </span>
                        </div>
                        <div
                          className="area-track"
                          title={`${bucket.areaName}: ${bucket.granted} permitidos y ${bucket.denied} denegados de ${bucket.total} eventos`}
                        >
                          {grantedWidth > 0 ? (
                            <span
                              className="area-segment area-segment--granted"
                              style={{ width: `${grantedWidth}%` }}
                              title={`Permitidos: ${bucket.granted}`}
                            />
                          ) : null}
                          {deniedWidth > 0 ? (
                            <span
                              className="area-segment area-segment--denied"
                              style={{ width: `${deniedWidth}%` }}
                              title={`Denegados: ${bucket.denied}`}
                            />
                          ) : null}
                        </div>
                        <div className="area-detail-slot">
                          {isAreaHovered ? (
                            <div className="area-row-detail">
                              {areaGrantedPct}% aprobacion · {bucket.total} lectura(s) recientes
                            </div>
                          ) : (
                            <span className="area-row-hint" aria-hidden="true">
                              {bucket.granted} permitidos · {bucket.denied} denegados
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="dashboard-chart-column">
                <div className="chart-subpanel">
                  <div>
                    <h3 className="chart-subpanel-title">Pulso de eventos recientes</h3>
                    <p className="chart-subpanel-meta">
                      Altura según recencia y color según la decisión.
                    </p>
                  </div>

                  <div className="dashboard-legend">
                    <span className="legend-item">
                      <span className="legend-dot legend-dot--granted" aria-hidden="true" />
                      Permitido
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot legend-dot--denied" aria-hidden="true" />
                      Denegado
                    </span>
                    <span className="legend-item">
                      <LogIn size={12} aria-hidden="true" />
                      Entrada
                    </span>
                    <span className="legend-item">
                      <LogOut size={12} aria-hidden="true" />
                      Salida
                    </span>
                  </div>

                  <div className="pulse-scroll">
                    <div className="pulse-chart">
                      {timelineEvents.map((event) => {
                        const isPulseActive = inspectedPulseEvent?.id === event.id

                        return (
                          <div
                            key={event.id}
                            className={isPulseActive ? 'pulse-column is-active' : 'pulse-column'}
                            tabIndex={0}
                            aria-label={`${event.directionLabel} · ${event.areaName} · ${event.decisionLabel} · ${event.personLabel}`}
                            onMouseEnter={() => setHoveredPulseId(event.id)}
                            onFocus={() => setHoveredPulseId(event.id)}
                          >
                            <span
                              className="pulse-direction"
                              title={event.directionLabel}
                              aria-label={event.directionLabel}
                            >
                              {event.direction === 'entry' ? (
                                <LogIn size={11} aria-hidden="true" />
                              ) : (
                                <LogOut size={11} aria-hidden="true" />
                              )}
                            </span>
                            <div className="pulse-track">
                              <div
                                className={`pulse-bar ${
                                  event.decision === 'granted'
                                    ? 'pulse-bar--granted'
                                    : 'pulse-bar--denied'
                                }`}
                                title={`${event.directionLabel} · ${formatDateTimeWithSeconds(event.occurredAt)} · ${event.areaName} · ${event.decisionLabel} · ${event.personLabel}`}
                                style={{ height: `${event.heightPercent}%` }}
                              />
                            </div>
                            <time
                              dateTime={event.occurredAt}
                              className="pulse-time"
                              title={formatDateTimeWithSeconds(event.occurredAt)}
                            >
                              {formatClockTime(event.occurredAt)}
                            </time>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {inspectedPulseEvent ? (
                    <div className="pulse-inspector" aria-live="polite">
                      <div className="pulse-inspector-header">
                        <span className="pulse-inspector-person">
                          {inspectedPulseEvent.personLabel}
                        </span>
                        <StatusBadge
                          variant={
                            inspectedPulseEvent.decision === 'granted' ? 'success' : 'danger'
                          }
                        >
                          {inspectedPulseEvent.decision === 'granted'
                            ? 'Acceso concedido'
                            : 'Acceso denegado'}
                        </StatusBadge>
                      </div>
                      <span className="pulse-inspector-meta">
                        {`Lectura: ${inspectedPulseEvent.directionLabel} en ${inspectedPulseEvent.areaName} · ${formatDateTimeWithSeconds(inspectedPulseEvent.occurredAt)}`}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="chart-subpanel">
                  <div>
                    <h3 className="chart-subpanel-title">Distribución por motivo</h3>
                    <p className="chart-subpanel-meta">
                      Motivos de decisión en la muestra reciente, ordenados por frecuencia.
                    </p>
                  </div>

                  <div className="reason-list">
                    {reasonActivity.map((bucket) => {
                      const width = maxReasonTotal > 0 ? (bucket.total / maxReasonTotal) * 100 : 0
                      const isReasonHovered = hoveredReason === bucket.reasonCode
                      const reasonPct =
                        recentEvents.length > 0
                          ? Math.round((bucket.total / recentEvents.length) * 100)
                          : 0

                      return (
                        <div
                          key={bucket.reasonCode}
                          className={isReasonHovered ? 'reason-row is-hovered' : 'reason-row'}
                          onMouseEnter={() => setHoveredReason(bucket.reasonCode)}
                          onMouseLeave={() =>
                            setHoveredReason((cur) => (cur === bucket.reasonCode ? null : cur))
                          }
                        >
                          <div className="reason-row-header">
                            <span className="reason-label" title={bucket.label}>
                              {bucket.label}
                            </span>
                            <span className="reason-count">
                              {isReasonHovered ? `${bucket.total} (${reasonPct}%)` : bucket.total}
                            </span>
                          </div>
                          <div className="reason-track">
                            <div
                              className={`reason-fill ${
                                bucket.denied > 0 ? 'reason-fill--denied' : 'reason-fill--granted'
                              }`}
                              style={{ width: `${width}%` }}
                              title={`${bucket.label}: ${bucket.total} eventos`}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div role="status" aria-live="polite" aria-atomic="true" className="chart-state">
              <p className="chart-state-title">Cargando eventos recientes...</p>
              <p className="chart-state-description">{COLD_START_HINT}</p>
            </div>
          ) : (
            <div role="status" aria-live="polite" aria-atomic="true" className="chart-state">
              <p className="chart-state-title">Sin eventos registrados</p>
              <p className="chart-state-description">
                Aún no existen lecturas enviadas por los controladores ESP32-S3.
              </p>
            </div>
          )}
        </section>

        {canViewCatalogs ? (
          <section className="surface-card" aria-label="Estado de sincronización de dispositivos">
          <div className="surface-card-header">
            <h2 className="surface-card-title">
              <Cpu size={18} aria-hidden="true" />
              <span>Estado de sincronización de dispositivos</span>
            </h2>
            <Link to="/devices" className="btn btn-secondary btn-sm">
              Administrar
            </Link>
          </div>

          <div className="device-sync-badges" role="status" aria-live="polite">
            {summary ? (
              <>
                <StatusBadge variant={outOfSync > 0 ? 'warning' : 'success'}>
                  {outOfSync > 0
                    ? `${outOfSync} por sincronizar`
                    : 'Configuracion sincronizada'}
                </StatusBadge>
                <StatusBadge variant="neutral">
                  {summary.devices.active} de {summary.devices.total} activos
                </StatusBadge>
              </>
            ) : (
              <span className="table-meta">
                Consultando estado de sincronizacion… {COLD_START_HINT}
              </span>
            )}
          </div>

          {devices.length === 0 ? (
            <p className="device-compact-empty">
              {loading
                ? `Consultando controladores… ${COLD_START_HINT}`
                : 'No hay controladores registrados.'}
            </p>
          ) : (
            <>
              <div className="device-compact-list" role="list">
                {visibleDevices.map((dev) => {
                  const isDeviceHovered = hoveredDeviceId === dev.id

                  return (
                    <div
                      key={dev.id}
                      className={
                        isDeviceHovered ? 'device-compact-row is-hovered' : 'device-compact-row'
                      }
                      role="listitem"
                      tabIndex={0}
                      onMouseEnter={() => setHoveredDeviceId(dev.id)}
                      onMouseLeave={() =>
                        setHoveredDeviceId((cur) => (cur === dev.id ? null : cur))
                      }
                      onFocus={() => setHoveredDeviceId(dev.id)}
                      onBlur={(e) => {
                        if (!isFocusWithinTarget(e.currentTarget, e.relatedTarget)) {
                          setHoveredDeviceId((cur) => (cur === dev.id ? null : cur))
                        }
                      }}
                    >
                      <div className="device-compact-header">
                        <div>
                          <span className="device-compact-name">{dev.name}</span>
                          <span className="mono-code" translate="no">
                            {dev.deviceCode}
                          </span>
                        </div>
                        <StatusBadge variant={deviceBadgeVariant(dev.status)}>
                          {DEVICE_STATUS_LABELS[dev.status]}
                        </StatusBadge>
                      </div>
                      <div className="device-compact-meta">
                        <span>Ubicacion: {dev.location ?? 'Sin especificar'}</span>
                        <span>
                          <span className="mono-text" translate="no">
                            config v{dev.configVersion}
                          </span>
                          {' · '}
                          <time
                            dateTime={dev.lastSeenAt ?? undefined}
                            title={formatDateTimeWithSeconds(dev.lastSeenAt)}
                          >
                            {formatRelativeMinutes(dev.lastSeenAt)}
                          </time>
                        </span>
                      </div>
                      <div className="device-extra-slot">
                        {isDeviceHovered ? (
                          <div className="device-hover-extra">
                            <span>Hardware: {dev.hardwareModel ?? 'ESP32-S3'}</span>
                            <span>Firmware: {dev.firmwareVersion ?? 'Sin reportar'}</span>
                            <span>Areas: {dev.areaIds.length}</span>
                          </div>
                        ) : (
                          <span className="device-extra-hint" aria-hidden="true">
                            Pasa el cursor para ver hardware y areas
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {devices.length > MAX_VISIBLE_DEVICES ? (
                <p className="device-more-note">
                  Mostrando {MAX_VISIBLE_DEVICES} de {devices.length} controladores.
                </p>
              ) : null}
            </>
          )}
          </section>
        ) : null}
      </div>
    </div>
  )
}
