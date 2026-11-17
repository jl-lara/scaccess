import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../src/context/AuthContext'

export function renderWithAuth(ui: ReactElement, auth: AuthContextValue) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  )
}
