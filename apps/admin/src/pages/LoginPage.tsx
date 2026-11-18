import { useState, type CSSProperties, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, Moon, Sun } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const BRAND_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '0.85rem',
  marginBottom: '1.6rem',
}
const FORM_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
}
const PASSWORD_WRAPPER_STYLE: CSSProperties = { position: 'relative' }
const PASSWORD_INPUT_STYLE: CSSProperties = { paddingRight: '2.75rem', width: '100%' }
const PASSWORD_TOGGLE_STYLE: CSSProperties = {
  position: 'absolute',
  top: '50%',
  right: '0.3rem',
  transform: 'translateY(-50%)',
  padding: '0.3rem',
}
const FOOTER_STYLE: CSSProperties = {
  marginTop: '1.35rem',
  paddingTop: '1rem',
  borderTop: '1px solid var(--border-subtle)',
  fontSize: '0.76rem',
  color: 'var(--text-muted)',
}

export function LoginPage() {
  const { user, loading, error, signIn } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch {
      // El contexto ya almacena el mensaje de error
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || loading

  return (
    <main className="login-screen" aria-labelledby="login-title">
      <div className="login-theme-toggle">
        <button
          type="button"
          className="btn btn-secondary btn-sm theme-toggle"
          onClick={toggleTheme}
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-pressed={isDark}
        >
          {isDark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
          <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
      </div>
      <section className="login-card">
        <div style={BRAND_ROW_STYLE}>
          <div className="brand-logo-frame">
            <img
              src={
                isDark
                  ? '/brand/logo_accesa_fondo_blanco_oscuro_transparente.png'
                  : '/brand/logo_accesa_fondo_blanco.png'
              }
              alt="Accesa"
              className="login-brand-logo"
            />
          </div>
          <div>
            <h1
              id="login-title"
              style={{
                margin: 0,
                fontSize: '1.35rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Consola Administrativa
            </h1>
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
              }}
            >
              Accesa · Control de Acceso RFID
            </p>
          </div>
        </div>

        {error ? (
          <div className="alert-banner error" role="alert">
            <span>{error}</span>
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={FORM_STYLE}
          aria-busy={busy}
        >
          <div className="form-field">
            <label className="form-label" htmlFor="login-email">
              Correo electronico institucional
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              className="input-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operador@institucion.edu.mx"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="login-password">
              Contrasena
            </label>
            <div style={PASSWORD_WRAPPER_STYLE}>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="input-control"
                style={PASSWORD_INPUT_STYLE}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={PASSWORD_TOGGLE_STYLE}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff size={15} aria-hidden="true" />
                ) : (
                  <Eye size={15} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
            aria-busy={busy}
            style={{ marginTop: '0.4rem', padding: '0.68rem 1rem' }}
          >
            <KeyRound size={16} aria-hidden="true" />
            <span>
              {submitting
                ? 'Verificando acceso…'
                : loading
                  ? 'Verificando sesion…'
                  : 'Ingresar a la consola'}
            </span>
          </button>

          {submitting ? (
            <p className="form-hint" role="status" aria-live="polite" style={{ margin: 0 }}>
              La verificacion puede tardar hasta 60 segundos si el servidor de Render esta
              despertando.
            </p>
          ) : null}
        </form>

        <div style={FOOTER_STYLE}>
          Acceso exclusivo para personal con rol Administrador, Operador o Auditor. Si el servicio
          estuvo suspendido en Render, la primera autenticacion puede tardar hasta 60 segundos.
        </div>
      </section>
    </main>
  )
}
