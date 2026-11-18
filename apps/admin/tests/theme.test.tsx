import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue } from '../src/context/AuthContext'
import { THEME_STORAGE_KEY, ThemeProvider } from '../src/context/ThemeContext'
import { LoginPage } from '../src/pages/LoginPage'
import { makeAuth } from './fixtures'

function createSignedOutAuth(): AuthContextValue {
  return {
    ...makeAuth(['admin']),
    user: null,
    isAdmin: false,
    canWriteCatalog: false,
  }
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={createSignedOutAuth()}>
        <ThemeProvider>
          <LoginPage />
        </ThemeProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
    document.documentElement.style.colorScheme = ''
  })

  it('starts in light mode by default', () => {
    renderLogin()

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('switches to dark mode and persists the choice', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('button', { name: 'Cambiar a modo claro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('returns to light mode when toggled again', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
