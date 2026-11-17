import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
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
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type {
  AccessDecision,
  AccessDeviceDto,
  AccessEventDto,
  AccessReason,
  AreaDto,
  DashboardSummaryDto,
  EmployeeDto,
} from '@scaccess/shared'
import { StatusBadge } from '../components/ui/StatusBadge'
import { COLD_START_HINT } from '../components/ui/TableMessage'
import { api } from '../lib/api'
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

const KPI_VALUE_STYLE: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const KPI_LINK_STYLE: CSSProperties = {
  color: 'var(--accent-primary-hover)',
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
}
const LEGEND_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '0.5rem 1rem',
  fontSize: '0.78rem',
  color: 'var(--text-secondary)',
  marginBottom: '1rem',
}
const LEGEND_ITEM_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
}
const DOT_STYLE: CSSProperties = {
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '999px',
}
const GRANTED_DOT_STYLE: CSSProperties = {
  ...DOT_STYLE,
  backgroundColor: 'var(--status-granted)',
}
const DENIED_DOT_STYLE: CSSProperties = {
  ...DOT_STYLE,
  backgroundColor: 'var(--status-denied)',
}
const QUICK_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.55rem',
  marginBottom: '1.5rem',
}
const QUICK_ACTIONS_LABEL_STYLE: CSSProperties = {
  marginRight: '0.25rem',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
}
const DEVICE_ROW_STYLE: CSSProperties = {
  padding: '0.85rem 1rem',
  borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
}
const DEVICE_ROW_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
}
const DEVICE_ROW_META_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '0.25rem 0.75rem',
  fontSize: '0.78rem',
  color: 'var(--text-secondary)',
}

const CHART_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '0.75rem 1rem',
  marginBottom: '1rem',
}
const CHART_SUBTITLE_STYLE: CSSProperties = {
  margin: '0.35rem 0 0',
  maxWidth: '72ch',
  color: 'var(--text-secondary)',
  fontSize: '0.8rem',
  textWrap: 'pretty',
}
const CHART_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  alignItems: 'start',
  gap: '1rem',
}
const CHART_COLUMN_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  minWidth: 0,
}
const CHART_PANEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
  minWidth: 0,
  padding: '1rem',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-subtle)',
}
const CHART_PANEL_TITLE_STYLE: CSSProperties = {
  margin: 0,
  color: 'var(--text-primary)',
  fontSize: '0.84rem',
  fontWeight: 700,
}
const CHART_PANEL_META_STYLE: CSSProperties = {
  margin: '0.2rem 0 0',
  color: 'var(--text-muted)',
  fontSize: '0.73rem',
}
const CHART_LEGEND_ROW_STYLE: CSSProperties = {
  ...LEGEND_ROW_STYLE,
  justifyContent: 'flex-start',
  gap: '0.45rem 0.9rem',
  marginBottom: 0,
  fontSize: '0.72rem',
}
const AREA_LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}
const AREA_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
}
const AREA_ROW_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
}
const AREA_NAME_STYLE: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  color: 'var(--text-primary)',
  fontSize: '0.78rem',
  fontWeight: 600,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const AREA_COUNTS_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  gap: '0.3rem',
}
const CHART_COUNT_STYLE: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
}
const AREA_TRACK_STYLE: CSSProperties = {
  display: 'flex',
  height: '12px',
  overflow: 'hidden',
  borderRadius: '999px',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
}
const AREA_SEGMENT_STYLE: CSSProperties = {
  height: '100%',
  transition: 'width 0.25s ease',
}
const PULSE_SCROLL_STYLE: CSSProperties = {
  overflowX: 'auto',
  paddingBottom: '0.2rem',
}
const PULSE_CHART_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '0.3rem',
  minWidth: '420px',
  minHeight: '150px',
}
const PULSE_COLUMN_STYLE: CSSProperties = {
  display: 'flex',
  flex: '1 1 28px',
  minWidth: '18px',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '0.25rem',
}
const PULSE_DIRECTION_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  color: 'var(--text-secondary)',
}
const PULSE_TRACK_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  width: '100%',
  height: '104px',
  overflow: 'hidden',
  borderRadius: '5px 5px 3px 3px',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
}
const PULSE_BAR_STYLE: CSSProperties = {
  width: '100%',
  borderRadius: '4px 4px 0 0',
  transition: 'height 0.25s ease',
}
const PULSE_TIME_STYLE: CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}
const REASON_LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
}
const REASON_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
}
const REASON_ROW_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
}
const REASON_LABEL_STYLE: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  color: 'var(--text-primary)',
  fontSize: '0.76rem',
  fontWeight: 600,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const REASON_COUNT_STYLE: CSSProperties = {
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.72rem',
  fontVariantNumeric: 'tabular-nums',
}
const REASON_TRACK_STYLE: CSSProperties = {
  height: '7px',
  overflow: 'hidden',
  borderRadius: '999px',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
}
const REASON_FILL_STYLE: CSSProperties = {
  height: '100%',
  borderRadius: '999px',
  transition: 'width 0.25s ease',
}
const CHART_STATE_STYLE: CSSProperties = {
  padding: '1.5rem 1rem',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--bg-surface-elevated)',
  border: '1px dashed var(--border-subtle)',
  textAlign: 'center',
}
const CHART_STATE_TITLE_STYLE: CSSProperties = {
  margin: 0,
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  fontWeight: 600,
}
const CHART_STATE_DESCRIPTION_STYLE: CSSProperties = {
  margin: '0.35rem auto 0',
  maxWidth: '58ch',
  color: 'var(--text-muted)',
  fontSize: '0.78rem',
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null)
  const [recentEvents, setRecentEvents] = useState<AccessEventDto[]>([])
  const [devices, setDevices] = useState<AccessDeviceDto[]>([])
  const [areasById, setAreasById] = useState<Record<string, AreaDto>>({})
  const [employeesById, setEmployeesById] = useState<Record<string, EmployeeDto>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, eventsRes, devicesRes, areasRes, employeesRes] = await Promise.all([
        api.getDashboardSummary(),
        api.listAccessEvents({ page: 1, pageSize: 8 }),
        api.listAccessDevices({ page: 1, pageSize: 20 }),
        api.listAreas({ page: 1, pageSize: 100 }),
        api.listEmployees({ page: 1, pageSize: 100 }),
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
  }, [])

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Centro de Monitoreo Operativo</h1>
          <p className="page-description">
            Estado en tiempo real de empleados acreditados, lectores fisicos ESP32-S3 y decisiones
            de acceso en las ultimas 24 horas.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.35rem',
          }}
        >
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
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadDashboard()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {summary && summary.devices.outOfSync > 0 ? (
        <div className="alert-banner warning" role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
        <div className="kpi-card">
          <div className="kpi-header">
            <span>Empleados activos</span>
            <Users size={17} aria-hidden="true" />
          </div>
          <div className="kpi-value" style={KPI_VALUE_STYLE}>
            {summary ? summary.employees.active : '—'}
          </div>
          <div className="kpi-meta">
            <span>Total registrados: {summary ? summary.employees.total : '—'}</span>
            <Link to="/employees" style={KPI_LINK_STYLE} aria-label="Gestionar empleados">
              Gestionar
            </Link>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Tarjetas RFID activas</span>
            <CreditCard size={17} aria-hidden="true" />
          </div>
          <div className="kpi-value" style={KPI_VALUE_STYLE}>
            {summary ? summary.credentials.active : '—'}
          </div>
          <div className="kpi-meta">
            <span>
              Bloqueadas / extraviadas: {summary ? summary.credentials.blockedOrLost : '—'}
            </span>
            <Link to="/credentials" style={KPI_LINK_STYLE} aria-label="Ver tarjetas RFID">
              Ver tarjetas
            </Link>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Areas protegidas</span>
            <Building2 size={17} aria-hidden="true" />
          </div>
          <div className="kpi-value" style={KPI_VALUE_STYLE}>
            {summary ? summary.areas.active : '—'}
          </div>
          <div className="kpi-meta">
            <span>Total configuradas: {summary ? summary.areas.total : '—'}</span>
            <Link to="/areas" style={KPI_LINK_STYLE} aria-label="Ver areas protegidas">
              Ver areas
            </Link>
          </div>
        </div>

        <div className={`kpi-card ${summary && outOfSync > 0 ? 'variant-warning' : 'variant-granted'}`}>
          <div className="kpi-header">
            <span>Controladores ESP32</span>
            <Cpu size={17} aria-hidden="true" />
          </div>
          <div className="kpi-value" style={KPI_VALUE_STYLE}>
            {summary ? `${summary.devices.active}/${summary.devices.total}` : '—'}
          </div>
          <div className="kpi-meta">
            <span>Desactualizados: {summary ? outOfSync : '—'}</span>
            <Link
              to="/devices"
              style={KPI_LINK_STYLE}
              aria-label="Revisar sincronizacion de controladores"
            >
              Sincronizacion
            </Link>
          </div>
        </div>

        <div className="kpi-card variant-granted">
          <div className="kpi-header">
            <span>Accesos concedidos (24h)</span>
            <CheckCircle2 size={17} aria-hidden="true" />
          </div>
          <div className="kpi-value" style={KPI_VALUE_STYLE}>
            {summary ? summary.recentEvents24h.granted : '—'}
          </div>
          <div className="kpi-meta">
            <span>{hasRecentActivity ? `${grantedPct}% de intentos recientes` : 'Sin actividad reciente'}</span>
            <Link to="/access-events" style={KPI_LINK_STYLE} aria-label="Auditar accesos concedidos">
              Auditar
            </Link>
          </div>
        </div>

        <div className="kpi-card variant-denied">
          <div className="kpi-header">
            <span>Accesos denegados (24h)</span>
            <ShieldAlert size={17} aria-hidden="true" />
          </div>
          <div className="kpi-value" style={KPI_VALUE_STYLE}>
            {summary ? summary.recentEvents24h.denied : '—'}
          </div>
          <div className="kpi-meta">
            <span>{hasRecentActivity ? `${deniedPct}% de rechazos (24h)` : 'Sin rechazos recientes'}</span>
            <Link to="/access-events" style={KPI_LINK_STYLE} aria-label="Ver accesos denegados">
              Ver rechazos
            </Link>
          </div>
        </div>
      </section>

      <nav aria-label="Accesos rapidos" style={QUICK_ACTIONS_STYLE}>
        <span style={QUICK_ACTIONS_LABEL_STYLE}>Accesos rapidos</span>
        <Link to="/access-events" className="btn btn-secondary btn-sm">
          <Activity size={14} aria-hidden="true" />
          Bitacora de accesos
        </Link>
        <Link to="/devices" className="btn btn-secondary btn-sm">
          <Cpu size={14} aria-hidden="true" />
          Controladores ESP32
        </Link>
      </nav>

      <div className="dashboard-split">
        <section className="surface-card" aria-label="Balance de decisiones en muestra reciente">
          <div className="surface-card-header">
            <h2 className="surface-card-title">
              <Activity size={18} aria-hidden="true" />
              <span>Balance de decisiones en muestra reciente</span>
            </h2>
          </div>

          {hasRecentActivity ? (
            <>
              <div
                className="ratio-bar-track"
                role="img"
                aria-label={`Proporcion de accesos de las ultimas 24 horas: ${summary?.recentEvents24h.granted ?? 0} concedidos (${grantedPct}%) y ${summary?.recentEvents24h.denied ?? 0} denegados (${deniedPct}%).`}
              >
                <div className="ratio-bar-granted" style={{ width: `${grantedPct}%` }} />
                <div className="ratio-bar-denied" style={{ width: `${deniedPct}%` }} />
              </div>
              <div style={LEGEND_ROW_STYLE}>
                <span style={LEGEND_ITEM_STYLE}>
                  <span style={GRANTED_DOT_STYLE} aria-hidden="true" />
                  Concedidos: <strong>{summary?.recentEvents24h.granted ?? 0}</strong> ({grantedPct}%)
                </span>
                <span style={LEGEND_ITEM_STYLE}>
                  <span style={DENIED_DOT_STYLE} aria-hidden="true" />
                  Denegados: <strong>{summary?.recentEvents24h.denied ?? 0}</strong> ({deniedPct}%)
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
        </section>

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

          <div
            role="status"
            aria-live="polite"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.85rem' }}
          >
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {devices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                {loading
                  ? `Consultando controladores… ${COLD_START_HINT}`
                  : 'No hay controladores registrados.'}
              </p>
            ) : (
              devices.map((dev) => (
                <div key={dev.id} style={DEVICE_ROW_STYLE}>
                  <div style={DEVICE_ROW_HEADER_STYLE}>
                    <div>
                      <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>{dev.name}</span>
                      <span className="mono-code" translate="no">
                        {dev.deviceCode}
                      </span>
                    </div>
                    <StatusBadge
                      variant={
                        dev.status === 'active'
                          ? 'success'
                          : dev.status === 'maintenance'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {DEVICE_STATUS_LABELS[dev.status]}
                    </StatusBadge>
                  </div>
                  <div style={DEVICE_ROW_META_STYLE}>
                    <span>Ubicacion: {dev.location ?? 'Sin especificar'}</span>
                    <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="mono-text" translate="no">
                        config v{dev.configVersion}
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={dev.lastSeenAt ?? undefined} title={formatDateTimeWithSeconds(dev.lastSeenAt)}>
                        {formatRelativeMinutes(dev.lastSeenAt)}
                      </time>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section
        className="surface-card"
        aria-label="Gráfica de actividad de accesos recientes"
        aria-busy={loading}
      >
        <div style={CHART_HEADER_STYLE}>
          <div style={{ minWidth: 0 }}>
            <h2 className="surface-card-title">
              <Activity size={18} aria-hidden="true" />
              <span>Últimos eventos de acceso registrados</span>
            </h2>
            <p style={CHART_SUBTITLE_STYLE}>
              Vista visual de la muestra reciente: actividad por área, pulso de lecturas y motivos
              de decisión. La bitácora completa conserva el detalle tabular de cada evento.
            </p>
          </div>
          <Link to="/access-events" className="btn btn-secondary btn-sm">
            Ver bitácora completa <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {recentEvents.length > 0 ? (
          <div role="img" aria-label="Gráfica de últimos eventos de acceso" style={CHART_GRID_STYLE}>
            <div style={CHART_PANEL_STYLE}>
              <div>
                <h3 style={CHART_PANEL_TITLE_STYLE}>Accesos permitidos vs. denegados por área</h3>
                <p style={CHART_PANEL_META_STYLE}>
                  {recentEvents.length} lecturas recientes agrupadas por área física (máximo 6).
                </p>
              </div>

              <div style={CHART_LEGEND_ROW_STYLE}>
                <span style={LEGEND_ITEM_STYLE}>
                  <span style={GRANTED_DOT_STYLE} aria-hidden="true" />
                  Permitidos
                </span>
                <span style={LEGEND_ITEM_STYLE}>
                  <span style={DENIED_DOT_STYLE} aria-hidden="true" />
                  Denegados
                </span>
              </div>

              <div style={AREA_LIST_STYLE}>
                {areaActivity.map((bucket) => {
                  const grantedWidth =
                    bucket.total > 0 ? (bucket.granted / bucket.total) * 100 : 0
                  const deniedWidth = bucket.total > 0 ? (bucket.denied / bucket.total) * 100 : 0

                  return (
                    <div key={bucket.areaName} style={AREA_ROW_STYLE}>
                      <div style={AREA_ROW_HEADER_STYLE}>
                        <span style={AREA_NAME_STYLE} title={bucket.areaName}>
                          {bucket.areaName}
                        </span>
                        <span style={AREA_COUNTS_STYLE}>
                          <span
                            className="status-badge success"
                            style={CHART_COUNT_STYLE}
                            title={`${bucket.granted} accesos permitidos`}
                          >
                            <CheckCircle2 size={11} aria-hidden="true" />
                            {bucket.granted}
                          </span>
                          <span
                            className="status-badge danger"
                            style={CHART_COUNT_STYLE}
                            title={`${bucket.denied} accesos denegados`}
                          >
                            <XCircle size={11} aria-hidden="true" />
                            {bucket.denied}
                          </span>
                        </span>
                      </div>
                      <div
                        style={AREA_TRACK_STYLE}
                        title={`${bucket.areaName}: ${bucket.granted} permitidos y ${bucket.denied} denegados de ${bucket.total} eventos`}
                      >
                        {grantedWidth > 0 ? (
                          <span
                            style={{
                              ...AREA_SEGMENT_STYLE,
                              width: `${grantedWidth}%`,
                              backgroundColor: 'var(--status-granted)',
                            }}
                            title={`Permitidos: ${bucket.granted}`}
                          />
                        ) : null}
                        {deniedWidth > 0 ? (
                          <span
                            style={{
                              ...AREA_SEGMENT_STYLE,
                              width: `${deniedWidth}%`,
                              backgroundColor: 'var(--status-denied)',
                            }}
                            title={`Denegados: ${bucket.denied}`}
                          />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={CHART_COLUMN_STYLE}>
              <div style={CHART_PANEL_STYLE}>
                <div>
                  <h3 style={CHART_PANEL_TITLE_STYLE}>Pulso de eventos recientes</h3>
                  <p style={CHART_PANEL_META_STYLE}>
                    Línea de tiempo visual de lecturas recientes: altura según recencia y color
                    según la decisión.
                  </p>
                </div>

                <div style={CHART_LEGEND_ROW_STYLE}>
                  <span style={LEGEND_ITEM_STYLE}>
                    <CheckCircle2 size={12} color="var(--status-granted)" aria-hidden="true" />
                    Permitido
                  </span>
                  <span style={LEGEND_ITEM_STYLE}>
                    <XCircle size={12} color="var(--status-denied)" aria-hidden="true" />
                    Denegado
                  </span>
                  <span style={LEGEND_ITEM_STYLE}>
                    <LogIn size={12} color="var(--text-secondary)" aria-hidden="true" />
                    Entrada
                  </span>
                  <span style={LEGEND_ITEM_STYLE}>
                    <LogOut size={12} color="var(--text-secondary)" aria-hidden="true" />
                    Salida
                  </span>
                </div>

                <div style={PULSE_SCROLL_STYLE}>
                  <div style={PULSE_CHART_STYLE}>
                    {timelineEvents.map((event) => (
                      <div key={event.id} style={PULSE_COLUMN_STYLE}>
                        <span
                          style={PULSE_DIRECTION_STYLE}
                          title={event.directionLabel}
                          aria-label={event.directionLabel}
                        >
                          {event.direction === 'entry' ? (
                            <LogIn size={11} aria-hidden="true" />
                          ) : (
                            <LogOut size={11} aria-hidden="true" />
                          )}
                        </span>
                        <div style={PULSE_TRACK_STYLE}>
                          <div
                            title={`${event.directionLabel} · ${formatDateTimeWithSeconds(event.occurredAt)} · ${event.areaName} · ${event.decisionLabel} · ${event.personLabel}`}
                            style={{
                              ...PULSE_BAR_STYLE,
                              height: `${event.heightPercent}%`,
                              backgroundColor:
                                event.decision === 'granted'
                                  ? 'var(--status-granted)'
                                  : 'var(--status-denied)',
                            }}
                          />
                        </div>
                        <time
                          dateTime={event.occurredAt}
                          style={PULSE_TIME_STYLE}
                          title={formatDateTimeWithSeconds(event.occurredAt)}
                        >
                          {formatClockTime(event.occurredAt)}
                        </time>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={CHART_PANEL_STYLE}>
                <div>
                  <h3 style={CHART_PANEL_TITLE_STYLE}>Distribución por motivo</h3>
                  <p style={CHART_PANEL_META_STYLE}>
                    Motivos de decisión en la muestra reciente, ordenados por frecuencia.
                  </p>
                </div>

                <div style={REASON_LIST_STYLE}>
                  {reasonActivity.map((bucket) => {
                    const width = maxReasonTotal > 0 ? (bucket.total / maxReasonTotal) * 100 : 0
                    const fillColor =
                      bucket.denied > 0 ? 'var(--status-denied)' : 'var(--status-granted)'

                    return (
                      <div key={bucket.reasonCode} style={REASON_ROW_STYLE}>
                        <div style={REASON_ROW_HEADER_STYLE}>
                          <span style={REASON_LABEL_STYLE} title={bucket.label}>
                            {bucket.label}
                          </span>
                          <span style={REASON_COUNT_STYLE}>{bucket.total}</span>
                        </div>
                        <div style={REASON_TRACK_STYLE}>
                          <div
                            style={{
                              ...REASON_FILL_STYLE,
                              width: `${width}%`,
                              backgroundColor: fillColor,
                            }}
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
          <div role="status" aria-live="polite" aria-atomic="true" style={CHART_STATE_STYLE}>
            <p style={CHART_STATE_TITLE_STYLE}>Cargando eventos recientes...</p>
            <p style={CHART_STATE_DESCRIPTION_STYLE}>{COLD_START_HINT}</p>
          </div>
        ) : (
          <div role="status" aria-live="polite" aria-atomic="true" style={CHART_STATE_STYLE}>
            <p style={CHART_STATE_TITLE_STYLE}>Sin eventos registrados</p>
            <p style={CHART_STATE_DESCRIPTION_STYLE}>
              Aún no existen lecturas enviadas por los controladores ESP32-S3.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
