import { useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, Moon, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < 8) {
      setFormError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden.')
      return
    }
    if (!updatePassword) {
      setFormError('El servicio de recuperación no está disponible en este momento.')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await updatePassword(password)
      setCompleted(true)
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-screen" aria-labelledby="reset-password-title">
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

      <section className="login-card" style={{ maxWidth: 440 }}>
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
            <h1 id="reset-password-title" className="login-title">
              Restablecer contraseña
            </h1>
            <p className="login-subtitle">Accesa · Recuperación de acceso</p>
          </div>
        </div>

        {completed ? (
          <div className="page-stack">
            <div className="alert-banner success" role="status">
              <span className="dashboard-alert-copy">
                <CheckCircle2 size={18} aria-hidden="true" />
                Tu contraseña se actualizó correctamente. Ya puedes ingresar con tus nuevas
                credenciales.
              </span>
            </div>
            <Link to="/login" className="btn btn-primary">
              Ir al inicio de sesión
            </Link>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => void handleSubmit(e)}
            className="login-form"
            aria-busy={submitting}
          >
            {formError ? (
              <div className="alert-banner error" role="alert">
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="form-field">
              <label className="form-label" htmlFor="reset-new-password">
                Nueva contraseña
              </label>
              <div className="password-field-wrapper">
                <input
                  id="reset-new-password"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="input-control password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
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

            <div className="form-field">
              <label className="form-label" htmlFor="reset-confirm-password">
                Confirmar nueva contraseña
              </label>
              <input
                id="reset-confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                className="input-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              aria-busy={submitting}
            >
              <KeyRound size={16} aria-hidden="true" />
              <span>{submitting ? 'Guardando…' : 'Guardar nueva contraseña'}</span>
            </button>

            <Link to="/login" className="btn btn-secondary">
              Volver al inicio de sesión
            </Link>
          </form>
        )}
      </section>
    </main>
  )
}
