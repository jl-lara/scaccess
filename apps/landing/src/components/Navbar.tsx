import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const NAV_ITEMS = [
  { href: '#producto', label: 'Producto' },
  { href: '#hardware', label: 'Hardware' },
  { href: '#ecosistema', label: 'Ecosistema' },
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#contacto', label: 'Contacto' },
] as const

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

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
          <a href="#producto" className="nav-brand" aria-label="Inicio de Accesa">
            <img
              src="/brand/logo_accesa_fondo_blanco.png"
              alt="Accesa"
              className="nav-brand-logo"
              width={132}
              height={26}
            />
          </a>

          <ul className="nav-links">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="nav-link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="nav-actions">
            <a href="#contacto" className="btn btn-primary btn-sm nav-desktop-cta">
              Solicitar demostración
            </a>
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
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="mobile-menu-link" onClick={closeMenu}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <a href="#contacto" className="btn btn-primary btn-sm btn-full" onClick={closeMenu}>
            Solicitar demostración
          </a>
        </div>
      </div>
    </header>
  )
}
