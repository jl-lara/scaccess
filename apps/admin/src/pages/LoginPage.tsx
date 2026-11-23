import { useRef, useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { isValidEmail } from '../lib/validation'

type LoginViewMode = 'signin' | 'forgot'

export function LoginPage() {
  const { user, loading, error, signIn, requestPasswordReset, clearError } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const [mode, setMode] = useState<LoginViewMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [recoverySent, setRecoverySent] = useState(false)

  const emailRef = useRef<HTMLInputElement | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)

  if (user) {
    return <Navigate to="/" replace />
  }

  function switchMode(nextMode: LoginViewMode) {
    setMode(nextMode)
    setLocalError(null)
    setRecoverySent(false)
    clearError?.()
  }

  async function handleSignInSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setLocalError('Ingresa tu correo electrónico institucional.')
      emailRef.current?.focus()
      return
    }
    if (!isValidEmail(trimmedEmail)) {
      setLocalError('Ingresa un correo electrónico válido.')
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setLocalError('Ingresa tu contraseña.')
      passwordRef.current?.focus()
      return
    }

    setLocalError(null)
    setSubmitting(true)
    try {
      await signIn(trimmedEmail, password)
    } catch {
      // El contexto ya almacena el mensaje de error
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setLocalError('Ingresa tu correo electrónico institucional.')
      emailRef.current?.focus()
      return
    }
    if (!isValidEmail(trimmedEmail)) {
      setLocalError('Ingresa un correo electrónico válido.')
      emailRef.current?.focus()
      return
    }
    if (!requestPasswordReset) {
      setLocalError('La recuperación de contraseña no está disponible en este momento.')
      return
    }

    setLocalError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(trimmedEmail)
      setRecoverySent(true)
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'No se pudo enviar el enlace de recuperación.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || loading
  const activeError = localError ?? error

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

      <div className="login-layout">
        <aside className="login-showcase" aria-label="Resumen de plataforma Accesa">
          <div className="login-showcase-badge">Sistema de Control de Acceso RFID</div>
          <h2 className="login-showcase-heading">
            Seguridad física centralizada para campus, laboratorios y áreas críticas.
          </h2>
          <p className="login-showcase-copy">
            Administra personal acreditado, tarjetas RFID, vigencias de acceso y controladores
            ESP32-S3 con operación continua incluso sin conexión.
          </p>

          <ul className="login-feature-list">
            <li className="login-feature-item">
              <Cpu size={18} aria-hidden="true" />
              <div>
                <strong>Controladores ESP32-S3 offline-first</strong>
                <span>Validación local en lector y sincronización resiliente de eventos.</span>
              </div>
            </li>
            <li className="login-feature-item">
              <Activity size={18} aria-hidden="true" />
              <div>
                <strong>Bitácora inmutable y reportes PDF</strong>
                <span>Trazabilidad completa con hora del lector, servidor y filtros en vivo.</span>
              </div>
            </li>
            <li className="login-feature-item">
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <strong>Acceso por perfil operativo</strong>
                <span>Permisos diferenciados para Administrador, Operador, Auditor y Monitor.</span>
              </div>
            </li>
          </ul>
        </aside>

        <section className="login-card">
          <div className="login-brand-row">
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
              <h1 id="login-title" className="login-title">
                {mode === 'signin' ? 'Consola Administrativa' : 'Recuperar contraseña'}
              </h1>
              <p className="login-subtitle">Accesa · Control de Acceso RFID</p>
            </div>
          </div>

          {activeError ? (
            <div className="alert-banner error" role="alert">
              <span>{activeError}</span>
            </div>
          ) : null}

          {mode === 'forgot' ? (
            recoverySent ? (
              <div className="page-stack">
                <div className="alert-banner success" role="status">
                  <span className="dashboard-alert-copy">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    Si el correo está registrado, recibirás un enlace para restablecer tu
                    contraseña en unos minutos.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => switchMode('signin')}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={(e) => void handleForgotSubmit(e)}
                className="login-form"
                aria-busy={busy}
              >
                <p className="form-hint" style={{ margin: 0 }}>
                  Ingresa tu correo institucional y te enviaremos un enlace seguro para definir
                  una nueva contraseña.
                </p>

                <div className="form-field">
                  <label className="form-label" htmlFor="login-email">
                    Correo electrónico institucional
                  </label>
                  <input
                    ref={emailRef}
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

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                  aria-busy={busy}
                >
                  <Mail size={16} aria-hidden="true" />
                  <span>{submitting ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => switchMode('signin')}
                  disabled={busy}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Volver al inicio de sesión
                </button>
              </form>
            )
          ) : (
            <form
              noValidate
              onSubmit={(e) => void handleSignInSubmit(e)}
              className="login-form"
              aria-busy={busy}
            >
              <div className="form-field">
                <label className="form-label" htmlFor="login-email">
                  Correo electrónico institucional
                </label>
                <input
                  ref={emailRef}
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
                <div className="login-label-row">
                  <label className="form-label" htmlFor="login-password">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    className="login-recovery-link"
                    onClick={() => switchMode('forgot')}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="password-field-wrapper">
                  <input
                    ref={passwordRef}
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input-control password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm password-toggle-btn"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                      ? 'Verificando sesión…'
                      : 'Ingresar a la consola'}
                </span>
              </button>

              {submitting ? (
                <p className="form-hint" role="status" aria-live="polite" style={{ margin: 0 }}>
                  La verificación puede tardar hasta 60 segundos si el servidor de Render está
                  despertando.
                </p>
              ) : null}
            </form>
          )}

          <div className="login-footer">
            Acceso exclusivo para personal con rol Administrador, Operador, Auditor o Monitor. Si
            el servicio estuvo suspendido en Render, la primera autenticación puede tardar hasta 60
            segundos.
          </div>
        </section>
      </div>
    </main>
  )
}
