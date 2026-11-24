import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { usePageScrollProgress } from '../hooks/useScrollProgress'
import { AppLink, useRouter } from '../lib/router'

const NAV_ITEMS = [
  { to: '/#producto', label: 'Producto' },
  { to: '/#hardware', label: 'Hardware' },
  { to: '/#ecosistema', label: 'Ecosistema' },
  { to: '/#roles', label: 'Roles' },
  { to: '/#escenarios', label: 'Escenarios' },
  { to: '/#preguntas', label: 'Preguntas' },
  { to: '/contacto', label: 'Contacto' },
] as const

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { route } = useRouter()
  const scrollProgress = usePageScrollProgress()

  useEffect(() => {
    if (!menuOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="container">
        <nav className="nav-bar" aria-label="Navegación principal">
          <AppLink to="/#producto" className="nav-brand" aria-label="Inicio de Accesa">
            <img
              src="/brand/logo_accesa_fondo_blanco.png"
              alt="Accesa"
              className="nav-brand-logo"
              width={132}
              height={26}
            />
          </AppLink>

          <ul className="nav-links">
            {NAV_ITEMS.map((item) => {
              const isActive = item.to === '/contacto' && route === '/contacto'
              return (
                <li key={item.to}>
                  <AppLink
                    to={item.to}
                    className={isActive ? 'nav-link nav-link-active' : 'nav-link'}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </AppLink>
                </li>
              )
            })}
          </ul>

          <div className="nav-actions">
            <AppLink to="/contacto" className="btn btn-primary btn-sm nav-desktop-cta">
              Solicitar demostración
            </AppLink>
            <button
              type="button"
              className="nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={menuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </nav>

        <div id="mobile-navigation" className="mobile-menu" data-open={menuOpen}>
          <ul className="mobile-menu-list">
            {NAV_ITEMS.map((item) => {
              const isActive = item.to === '/contacto' && route === '/contacto'
              return (
                <li key={item.to}>
                  <AppLink
                    to={item.to}
                    className={isActive ? 'mobile-menu-link mobile-menu-link-active' : 'mobile-menu-link'}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    {item.label}
                  </AppLink>
                </li>
              )
            })}
          </ul>
          <AppLink to="/contacto" className="btn btn-primary btn-sm btn-full" onClick={closeMenu}>
            Solicitar demostración
          </AppLink>
        </div>
      </div>

      {route === '/' && (
        <div
          className="nav-scroll-progress"
          aria-hidden="true"
          style={{ transform: `scaleX(${scrollProgress.toFixed(3)})` }}
        />
      )}
    </header>
  )
}
