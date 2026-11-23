import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../src/context/AuthContext'
import { LoginPage } from '../src/pages/LoginPage'
import { makeAuth } from './fixtures'
import { renderWithAuth } from './renderWithAuth'

function createAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    ...makeAuth(['admin']),
    user: null,
    isAdmin: false,
    canWriteCatalog: false,
    ...overrides,
  }
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders labelled credential fields without prefilled QA secrets', () => {
    renderWithAuth(<LoginPage />, createAuth())

    expect(screen.getByLabelText('Correo electrónico institucional')).toHaveValue('')
    const passwordInput = screen.getByLabelText('Contraseña')
    expect(passwordInput).toHaveValue('')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(screen.queryByDisplayValue('QaAccess!2026#Admin')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('admin.qa@scaccess.local')).not.toBeInTheDocument()
    expect(screen.getByText(/puede tardar hasta 60 segundos/i)).toBeInTheDocument()
  })

  it('submits credentials and toggles password visibility with an accessible control', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(<LoginPage />, createAuth({ signIn }))

    const emailInput = screen.getByLabelText('Correo electrónico institucional')
    const passwordInput = screen.getByLabelText('Contraseña')

    fireEvent.change(emailInput, { target: { value: 'admin.qa@scaccess.local' } })
    fireEvent.change(passwordInput, { target: { value: 'QaAccess!2026#Admin' } })

    const showButton = screen.getByRole('button', { name: 'Mostrar contraseña' })
    expect(showButton).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(showButton)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ingresar a la consola' }))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('admin.qa@scaccess.local', 'QaAccess!2026#Admin')
    })
  })

  it('validates email in Spanish before submitting and supports password recovery (H7, H9)', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(<LoginPage />, createAuth({ signIn, requestPasswordReset }))

    fireEvent.change(screen.getByLabelText('Correo electrónico institucional'), {
      target: { value: 'correo-invalido' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'Secret123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar a la consola' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ingresa un correo electrónico válido.',
    )
    expect(signIn).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))
    fireEvent.change(screen.getByLabelText('Correo electrónico institucional'), {
      target: { value: 'admin.qa@scaccess.local' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith('admin.qa@scaccess.local')
    })
    expect(
      await screen.findByText(/recibirás un enlace para restablecer tu contraseña/i),
    ).toBeInTheDocument()
  })

  it('announces authentication errors and disables the submit while a session is verified', () => {
    const { rerender } = renderWithAuth(
      <LoginPage />,
      createAuth({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Credenciales inválidas')

    rerender(
      <AuthContext.Provider value={createAuth({ loading: true })}>
        <LoginPage />
      </AuthContext.Provider>,
    )

    const submitButton = screen.getByRole('button', { name: /Verificando sesión/ })
    expect(submitButton).toBeDisabled()
  })
})
