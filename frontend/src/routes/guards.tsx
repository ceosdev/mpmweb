import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/providers/auth-provider'
import { usePermissions } from '@/permissions/use-permissions'
import { FullPageLoader } from '@/components/full-page-loader'

/**
 * Route guards.
 *
 *  - PublicRoute:        only for unauthenticated visitors (login, etc.)
 *  - AuthenticatedRoute: requires a session, but no active company yet
 *  - ProtectedRoute:     requires a session AND an active company
 *  - PermissionRoute:    additionally requires an RBAC permission
 */

export function PublicRoute() {
  const { status } = useAuth()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}

export function AuthenticatedRoute() {
  const { status } = useAuth()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  return <Outlet />
}

export function ProtectedRoute() {
  const { status, activeCompanyId, tenant } = useAuth()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  if (!activeCompanyId || !tenant) return <Navigate to="/select-company" replace />
  return <Outlet />
}

export function PermissionRoute({ permission }: { permission: string }) {
  const { can } = usePermissions()
  if (!can(permission)) return <Navigate to="/" replace />
  return <Outlet />
}
