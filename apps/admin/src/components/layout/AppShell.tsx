import { Suspense, useEffect, useState } from 'react'
import {
  Activity,
  Building2,
  Cpu,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sun,
  Users,
  UserCog,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { api } from '../../lib/api'
import { ROLE_LABELS } from '../../lib/formatters'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Panel de control', icon: LayoutDashboard },
  { to: '/access-events', label: 'Bitacora de accesos', icon: Activity },
  { to: '/employees', label: 'Empleados', icon: Users },
  { to: '/credentials', label: 'Tarjetas RFID', icon: CreditCard },
  { to: '/permissions', label: 'Permisos de acceso', icon: KeyRound },
  { to: '/areas', label: 'Areas fisicas', icon: Building2 },
  { to: '/devices', label: 'Controladores ESP32', icon: Cpu },
  { to: '/users', label: 'Cuentas y roles', icon: UserCog, adminOnly: true },
]

const SIDEBAR_STORAGE_KEY = 'scaccess-sidebar-collapsed'

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppShell() {
  const { user, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [apiState, setApiState] = useState<'waking' | 'online' | 'offline'>('waking')
  const [uptimeSeconds, setUptimeSeconds] = useState<number | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarCollapsed)

  useEffect(() => {
    let active = true
    async function checkApiHealth() {
      try {
        const res = await api.getHealth()
        if (!active) return
        setApiState('online')
        setUptimeSeconds(res.uptimeSeconds)
      } catch {
        if (!active) return
        setApiState('offline')
      }
    }
    void checkApiHealth()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkApiHealth()
      }
    }

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkApiHealth()
      }
    }, 30_000)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const visibleNav = PRIMARY_NAV.filter((item) => !item.adminOnly || isAdmin)

  function toggleSidebar() {
    const nextCollapsed = !isSidebarCollapsed
    setIsSidebarCollapsed(nextCollapsed)
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed))
    } catch {
      // The sidebar still toggles when browser storage is unavailable.
    }
  }

  return (
    <div className={`app-shell${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <aside id="app-sidebar" className="app-sidebar" hidden={isSidebarCollapsed}>
        <div className="brand-header">
          <div className="brand-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="brand-title">SCAccess</p>
            <p className="brand-subtitle">CONSOLA OPERATIVA</p>
          </div>
        </div>

        <div className="nav-section-label">Navegacion principal</div>
        <nav className="nav-list" aria-label="Menu administrativo">
          {visibleNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {user ? (
            <div className="user-pill">
              <span className="user-pill-email" title={user.email}>
                {user.email}
              </span>
              <span className="user-pill-roles">
                {user.roles.map((r) => ROLE_LABELS[r] ?? r).join(' · ')}
              </span>
            </div>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
            <LogOut size={15} aria-hidden="true" />
            <span>Cerrar sesion</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn btn-secondary btn-sm sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={isSidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
              aria-expanded={!isSidebarCollapsed}
              aria-controls="app-sidebar"
              title={isSidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={16} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={16} aria-hidden="true" />
              )}
              <span>{isSidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú'}</span>
            </button>
            <div className="topbar-status" role="status" aria-live="polite">
              <span className={`status-dot ${apiState}`} aria-hidden="true" />
              <span className="topbar-status-text">
                {apiState === 'online'
                  ? 'API conectada'
                  : apiState === 'waking'
                    ? 'Despertando la API en Render… puede tardar hasta 60 segundos.'
                    : 'API sin respuesta. Verifica la conexion y vuelve a intentarlo.'}
              </span>
              {apiState === 'online' && uptimeSeconds !== null ? (
                <span aria-hidden="true" className="cell-secondary">
                  ({uptimeSeconds}s activa)
                </span>
              ) : null}
            </div>
          </div>
          <div className="topbar-actions">
            <span className="topbar-meta">API v1 · Control de Acceso RFID</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-pressed={!isDark}
            >
              {isDark ? (
                <Sun size={15} aria-hidden="true" />
              ) : (
                <Moon size={15} aria-hidden="true" />
              )}
              <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
            </button>
          </div>
        </header>

        <main className="app-content" id="main-content" tabIndex={-1}>
          <Suspense
            fallback={
              <div className="surface-card" role="status" aria-live="polite">
                <p className="empty-title">Cargando modulo…</p>
                <p className="empty-description">
                  La vista se descarga solo cuando la necesitas.
                </p>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
