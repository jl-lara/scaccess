import { AppLink } from '../lib/router'

const FOOTER_LINKS = [
  { to: '/#producto', label: 'Producto' },
  { to: '/#hardware', label: 'Hardware' },
  { to: '/#ecosistema', label: 'Ecosistema' },
  { to: '/#roles', label: 'Roles' },
  { to: '/#escenarios', label: 'Escenarios' },
  { to: '/#preguntas', label: 'Preguntas' },
] as const

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <AppLink to="/#producto" aria-label="Volver al inicio de Accesa">
              <img
                src="/brand/logo_accesa_fondo_blanco_oscuro_transparente.png"
                alt="Accesa"
                className="footer-logo"
                width={122}
                height={24}
              />
            </AppLink>
            <p className="footer-description">
              Plataforma institucional de control de acceso RFID con validación local offline-first
              en ESP32-S3.
            </p>
          </div>

          <div className="footer-nav-col">
            <p className="footer-col-title">Explorar</p>
            <ul className="footer-nav">
              {FOOTER_LINKS.map((link) => (
                <li key={link.to}>
                  <AppLink to={link.to}>{link.label}</AppLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-contact-col">
            <p className="footer-col-title">Contacto y demos</p>
            <AppLink to="/contacto" className="btn btn-secondary-dark btn-sm">
              Ir al formulario de contacto
            </AppLink>
            <p className="footer-contact-note">contacto@accesa.utt.edu.mx · UTT Tijuana</p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>Accesa — Sistema de Control de Acceso RFID.</p>
          <p>Desarrollado en la Universidad Tecnológica de Tijuana (UTT).</p>
        </div>
      </div>
    </footer>
  )
}
