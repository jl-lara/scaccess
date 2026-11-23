import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/lib/api'
import { EmployeesPage } from '../src/pages/EmployeesPage'
import {
  EMPLOYEE_ANA,
  EMPLOYEE_CREATED,
  EMPLOYEES,
  makeAuth,
  paginated,
} from './fixtures'
import { renderWithAuth } from './renderWithAuth'

vi.mock('../src/lib/api', () => ({
  api: {
    listEmployees: vi.fn(),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
  },
}))

describe('EmployeesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listEmployees).mockResolvedValue(paginated(EMPLOYEES))
    vi.mocked(api.createEmployee).mockResolvedValue(EMPLOYEE_CREATED)
    vi.mocked(api.updateEmployee).mockResolvedValue(EMPLOYEE_ANA)
  })

  it('renders the directory with Spanish status labels and write actions for operators', async () => {
    renderWithAuth(<EmployeesPage />, makeAuth(['operator']))

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Ana Torres')).toBeInTheDocument()
    expect(within(table).getByText('EMP-001')).toBeInTheDocument()
    expect(within(table).getByText('Activo')).toBeInTheDocument()
    expect(within(table).getByText('Inactivo')).toBeInTheDocument()
    expect(screen.getByText('2 empleados en total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo empleado' })).toBeInTheDocument()
  })

  it('uses singular grammar when only one employee matches (H11)', async () => {
    vi.mocked(api.listEmployees).mockResolvedValue(paginated([EMPLOYEE_ANA]))
    renderWithAuth(<EmployeesPage />, makeAuth(['operator']))

    await screen.findByRole('table')
    expect(screen.getByText('1 empleado en total')).toBeInTheDocument()
  })

  it('hides write actions for read-only roles', async () => {
    renderWithAuth(<EmployeesPage />, makeAuth(['auditor']))

    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Nuevo empleado' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Solo lectura').length).toBeGreaterThan(0)
  })

  it('applies the status filter through the API', async () => {
    renderWithAuth(<EmployeesPage />, makeAuth(['operator']))

    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), {
      target: { value: 'suspended' },
    })

    await waitFor(() => {
      expect(api.listEmployees).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'suspended', page: 1 }),
      )
    })
  })

  it('creates an employee from the modal form', async () => {
    renderWithAuth(<EmployeesPage />, makeAuth(['operator']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo empleado' }))

    const dialog = screen.getByRole('dialog', { name: 'Nuevo empleado' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const codeInput = within(dialog).getByLabelText('Código de empleado')
    expect(codeInput).toHaveValue('EMP-003')
    fireEvent.change(codeInput, {
      target: { value: 'EMP-004' },
    })
    fireEvent.change(within(dialog).getByLabelText('Nombre(s)'), {
      target: { value: 'Luis' },
    })
    fireEvent.change(within(dialog).getByLabelText('Apellidos'), {
      target: { value: 'Mendoza' },
    })
    fireEvent.change(within(dialog).getByLabelText('Correo electrónico'), {
      target: { value: 'luis.mendoza@scaccess.local' },
    })
    fireEvent.change(within(dialog).getByLabelText('Departamento'), {
      target: { value: 'Mantenimiento' },
    })
    fireEvent.change(within(dialog).getByLabelText('Puesto'), {
      target: { value: 'Técnico' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar empleado' }))

    await waitFor(() => {
      expect(api.createEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeCode: 'EMP-004',
          firstName: 'Luis',
          lastName: 'Mendoza',
          department: 'Mantenimiento',
          position: 'Técnico',
          status: 'active',
        }),
      )
    })
    expect(await screen.findByText('Empleado registrado correctamente.')).toBeInTheDocument()
  })

  it('rejects numeric-only employee names and positions in the creation modal (H4)', async () => {
    renderWithAuth(<EmployeesPage />, makeAuth(['operator']))

    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo empleado' }))

    const dialog = screen.getByRole('dialog', { name: 'Nuevo empleado' })
    fireEvent.change(within(dialog).getByLabelText('Nombre(s)'), {
      target: { value: '12345' },
    })
    fireEvent.change(within(dialog).getByLabelText('Apellidos'), {
      target: { value: '67890' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar empleado' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/letras/i)
    expect(api.createEmployee).not.toHaveBeenCalled()
  })

  it('edits an existing employee', async () => {
    renderWithAuth(<EmployeesPage />, makeAuth(['admin']))

    const table = await screen.findByRole('table')
    const row = within(table).getByText('Ana Torres').closest('tr')
    if (!row) throw new Error('No se encontro la fila de Ana Torres')

    fireEvent.click(within(row).getByRole('button', { name: 'Editar empleado Ana Torres' }))

    const dialog = screen.getByRole('dialog', { name: 'Editar empleado' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    fireEvent.change(within(dialog).getByLabelText('Nombre(s)'), {
      target: { value: 'Ana Maria' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar empleado' }))

    await waitFor(() => {
      expect(api.updateEmployee).toHaveBeenCalledWith(
        'emp-1',
        expect.objectContaining({ firstName: 'Ana Maria', status: 'active' }),
      )
    })
    expect(await screen.findByText('Empleado actualizado correctamente.')).toBeInTheDocument()
  })

  it('shows an actionable empty state and clears filters from it', async () => {
    vi.mocked(api.listEmployees).mockResolvedValue(paginated([]))
    renderWithAuth(<EmployeesPage />, makeAuth(['operator']))

    expect(await screen.findByText('Sin empleados registrados')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByRole('button', { name: 'Registrar empleado' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por estado'), {
      target: { value: 'suspended' },
    })

    expect(await screen.findByText('Sin empleados que coincidan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => {
      expect(api.listEmployees).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: undefined, page: 1 }),
      )
    })
    expect(await screen.findByText('Sin empleados registrados')).toBeInTheDocument()
  })

  it('explains the Render cold start while the directory is loading', async () => {
    vi.mocked(api.listEmployees).mockReturnValueOnce(new Promise<never>(() => undefined))
    renderWithAuth(<EmployeesPage />, makeAuth(['operator']))

    expect(await screen.findByText('Cargando empleados…')).toBeInTheDocument()
    expect(
      screen.getByText(/la primera respuesta puede tardar hasta 60 segundos/i),
    ).toBeInTheDocument()
  })

  it('reports a load error and retries the directory', async () => {
    vi.mocked(api.listEmployees).mockRejectedValueOnce(
      new Error('Sin conexion con el servidor'),
    )
    renderWithAuth(<EmployeesPage />, makeAuth(['operator']))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexion con el servidor')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(api.listEmployees).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument()
  })
})
