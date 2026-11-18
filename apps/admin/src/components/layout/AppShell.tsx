import { Suspense, useEffect, useState } from 'react'
import {
  Activity,
  Building2,
  ChevronDown,
  Cpu,
  CreditCard,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Users,
  UserCog,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
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

const TOP_NAV: NavItem[] = [
  { to: '/', label: 'Panel de control', icon: LayoutDashboard },
  { to: '/access-events', label: 'Bitacora de accesos', icon: Activity },
]

const CATALOG_NAV: NavItem[] = [
  { to: '/employees', label: 'Empleados', icon: Users },
  { to: '/credentials', label: 'Tarjetas RFID', icon: CreditCard },
  { to: '/devices', label: 'Controladores ESP32', icon: Cpu },
]

const BOTTOM_NAV: NavItem[] = [
  { to: '/permissions', label: 'Permisos de acceso', icon: KeyRound },
  { to: '/areas', label: 'Areas fisicas', icon: Building2 },
  { to: '/users', label: 'Cuentas y roles', icon: UserCog, adminOnly: true },
]

function renderNavLink(item: NavItem) {
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
}

const SIDEBAR_STORAGE_KEY = 'scaccess-sidebar-collapsed'

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppShell() {
  const location = useLocation()
  const { user, isAdmin, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [apiState, setApiState] = useState<'waking' | 'online' | 'offline'>('waking')
  const [uptimeSeconds, setUptimeSeconds] = useState<number | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarCollapsed)
  const [isCatalogSubmenuOpen, setIsCatalogSubmenuOpen] = useState(true)

  const isCatalogRouteActive = CATALOG_NAV.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  )

  useEffect(() => {
    if (isCatalogRouteActive) {
      setIsCatalogSubmenuOpen(true)
    }
  }, [isCatalogRouteActive])

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

  const visibleBottomNav = BOTTOM_NAV.filter((item) => !item.adminOnly || isAdmin)

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
      <aside id="app-sidebar" className="app-sidebar">
        <div className="brand-header">
          <div className="brand-logo-frame">
            {isSidebarCollapsed ? (
              <img
                src={isDark ? '/brand/isotipo_oscuro_transparente.png' : '/brand/isotipo.png'}
                alt="Accesa"
                className="brand-logo-isotipo"
              />
            ) : (
              <img
                src={
                  isDark
                    ? '/brand/logo_accesa_fondo_blanco_oscuro_transparente.png'
                    : '/brand/logo_accesa_fondo_blanco.png'
                }
                alt="Accesa"
                className="brand-logo-full"
              />
            )}
          </div>
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
            <span className="sidebar-toggle-label">
              {isSidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú'}
            </span>
          </button>
        </div>

        <div className="sidebar-body" hidden={isSidebarCollapsed}>
          <nav className="nav-list" aria-label="Menu administrativo">
            {TOP_NAV.map(renderNavLink)}

            <div className="nav-submenu-group">
              <button
                type="button"
                className={`nav-submenu-toggle${isCatalogRouteActive ? ' is-active-parent' : ''}`}
                aria-expanded={isCatalogSubmenuOpen}
                aria-controls="nav-catalog-submenu"
                onClick={() => setIsCatalogSubmenuOpen((current) => !current)}
              >
                <span className="nav-submenu-toggle-left">
                  <FolderKanban size={17} aria-hidden="true" />
                  <span>Catálogos y equipos</span>
                </span>
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={`nav-submenu-chevron${isCatalogSubmenuOpen ? ' is-open' : ''}`}
                />
              </button>
              <div id="nav-catalog-submenu" className="nav-submenu" hidden={!isCatalogSubmenuOpen}>
                {CATALOG_NAV.map(renderNavLink)}
              </div>
            </div>

            {visibleBottomNav.map(renderNavLink)}
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
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
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
            <button
              type="button"
              className="btn btn-secondary btn-sm theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-pressed={isDark}
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
