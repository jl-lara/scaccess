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

    expect(screen.getByLabelText('Correo electronico institucional')).toHaveValue('')
    const passwordInput = screen.getByLabelText('Contrasena')
    expect(passwordInput).toHaveValue('')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(screen.queryByDisplayValue('QaAccess!2026#Admin')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('admin.qa@scaccess.local')).not.toBeInTheDocument()
    expect(screen.getByText(/puede tardar hasta 60 segundos/i)).toBeInTheDocument()
  })

  it('submits credentials and toggles password visibility with an accessible control', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(<LoginPage />, createAuth({ signIn }))

    const emailInput = screen.getByLabelText('Correo electronico institucional')
    const passwordInput = screen.getByLabelText('Contrasena')

    fireEvent.change(emailInput, { target: { value: 'admin.qa@scaccess.local' } })
    fireEvent.change(passwordInput, { target: { value: 'QaAccess!2026#Admin' } })

    const showButton = screen.getByRole('button', { name: 'Mostrar contrasena' })
    expect(showButton).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(showButton)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar contrasena' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ingresar a la consola' }))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('admin.qa@scaccess.local', 'QaAccess!2026#Admin')
    })
  })

  it('announces authentication errors and disables the submit while a session is verified', () => {
    const { rerender } = renderWithAuth(
      <LoginPage />,
      createAuth({ error: 'Credenciales invalidas. Verifica tu correo y contrasena.' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Credenciales invalidas')

    rerender(
      <AuthContext.Provider value={createAuth({ loading: true })}>
        <LoginPage />
      </AuthContext.Provider>,
    )

    const submitButton = screen.getByRole('button', { name: /Verificando sesion/ })
    expect(submitButton).toBeDisabled()
  })
})
