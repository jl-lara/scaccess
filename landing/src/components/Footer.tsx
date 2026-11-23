const FOOTER_LINKS = [
  { href: '#producto', label: 'Producto' },
  { href: '#hardware', label: 'Hardware' },
  { href: '#ecosistema', label: 'Ecosistema' },
  { href: '#flujo', label: 'Flujo operativo' },
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#contacto', label: 'Contacto' },
] as const

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <a href="#producto" aria-label="Volver al inicio de Accesa">
            <img
              src="/brand/logo_accesa_fondo_blanco_oscuro_transparente.png"
              alt="Accesa"
              className="footer-logo"
              width={122}
              height={24}
            />
          </a>

          <ul className="footer-nav">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-bottom">
          <p>Accesa — Sistema de Control de Acceso RFID.</p>
          <p>Desarrollado en la Universidad Tecnológica de Tijuana (UTT).</p>
        </div>
      </div>
    </footer>
  )
}
