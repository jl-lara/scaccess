import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { AuthContext } from '../src/context/AuthContext'
import { api } from '../src/lib/api'
import { EMPLOYEES, makeAuth, paginated } from './fixtures'

vi.mock('../src/lib/api', () => ({
  api: {
    getHealth: vi.fn(),
    listEmployees: vi.fn(),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
  },
}))

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getHealth).mockResolvedValue({
      status: 'ok',
      service: 'scaccess-api',
      timestamp: '2026-11-10T12:00:00.000Z',
      uptimeSeconds: 120,
    })
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES))
    vi.mocked(api.createEmployee).mockResolvedValue(EMPLOYEES[0]!)
    vi.mocked(api.updateEmployee).mockResolvedValue(EMPLOYEES[0]!)
  })

  it('connects the real employees module inside the administrative shell', async () => {
    render(
      <MemoryRouter initialEntries={['/employees']}>
        <AuthContext.Provider value={makeAuth(['admin'])}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Empleados' })).toBeInTheDocument()
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Menu administrativo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bitacora de accesos' })).toBeInTheDocument()
  })
})
