import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RoleGuard } from './components/auth/RoleGuard'
import { AppShell } from './components/layout/AppShell'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

// Route-level code splitting keeps the initial console bundle small: each
// administrative module is downloaded only when the user navigates to it.
const AccessEventsPage = lazy(() =>
  import('./pages/AccessEventsPage').then((module) => ({ default: module.AccessEventsPage })),
)
const AreasPage = lazy(() =>
  import('./pages/AreasPage').then((module) => ({ default: module.AreasPage })),
)
const CredentialsPage = lazy(() =>
  import('./pages/CredentialsPage').then((module) => ({ default: module.CredentialsPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const DevicesPage = lazy(() =>
  import('./pages/DevicesPage').then((module) => ({ default: module.DevicesPage })),
)
const EmployeesPage = lazy(() =>
  import('./pages/EmployeesPage').then((module) => ({ default: module.EmployeesPage })),
)
const PermissionsPage = lazy(() =>
  import('./pages/PermissionsPage').then((module) => ({ default: module.PermissionsPage })),
)
const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })),
)

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="login-screen" aria-busy="true">
        <div className="surface-card" style={{ textAlign: 'center', maxWidth: 380 }}>
          <p style={{ margin: 0, fontWeight: 600 }} role="status" aria-live="polite">
            Verificando sesión administrativa…
          </p>
          <p className="form-hint" style={{ margin: '0.45rem 0 0' }}>
            Si Render estaba suspendido, esta verificación puede tardar hasta 60 segundos.
          </p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <AppShell />
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoutes />}>
        <Route index element={<DashboardPage />} />
        <Route path="access-events" element={<AccessEventsPage />} />
        <Route
          path="employees"
          element={
            <RoleGuard require="catalogs">
              <EmployeesPage />
            </RoleGuard>
          }
        />
        <Route
          path="credentials"
          element={
            <RoleGuard require="catalogs">
              <CredentialsPage />
            </RoleGuard>
          }
        />
        <Route
          path="permissions"
          element={
            <RoleGuard require="catalogs">
              <PermissionsPage />
            </RoleGuard>
          }
        />
        <Route path="areas" element={<AreasPage />} />
        <Route
          path="devices"
          element={
            <RoleGuard require="catalogs">
              <DevicesPage />
            </RoleGuard>
          }
        />
        <Route
          path="users"
          element={
            <RoleGuard require="admin">
              <UsersPage />
            </RoleGuard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
