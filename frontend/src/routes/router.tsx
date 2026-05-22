import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AuthLayout } from '@/layouts/auth-layout'
import { AppLayout } from '@/layouts/app-layout'
import {
  AuthenticatedRoute,
  PermissionRoute,
  ProtectedRoute,
  PublicRoute,
} from '@/routes/guards'

const LoginPage = lazy(() =>
  import('@/modules/auth/login-page').then((m) => ({ default: m.LoginPage }))
)
const ForgotPasswordPage = lazy(() =>
  import('@/modules/auth/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage }))
)
const ResetPasswordPage = lazy(() =>
  import('@/modules/auth/reset-password-page').then((m) => ({ default: m.ResetPasswordPage }))
)
const SelectCompanyPage = lazy(() =>
  import('@/modules/auth/select-company-page').then((m) => ({ default: m.SelectCompanyPage }))
)
const DashboardPage = lazy(() =>
  import('@/modules/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage }))
)
const UsersPage = lazy(() =>
  import('@/modules/users/users-page').then((m) => ({ default: m.UsersPage }))
)
const CompaniesPage = lazy(() =>
  import('@/modules/companies/companies-page').then((m) => ({ default: m.CompaniesPage }))
)
const CompanyFormPage = lazy(() =>
  import('@/modules/companies/company-form-page').then((m) => ({ default: m.CompanyFormPage }))
)
const PermissionsPage = lazy(() =>
  import('@/modules/permissions/permissions-page').then((m) => ({ default: m.PermissionsPage }))
)
const NotFoundPage = lazy(() =>
  import('@/modules/misc/not-found-page').then((m) => ({ default: m.NotFoundPage }))
)

/**
 * Application router. Route guards layer the access rules:
 * public → authenticated → active company → RBAC permission.
 *
 * Page components are lazy-loaded so that each route ships its own chunk and
 * the initial bundle stays small (a Suspense boundary in `app.tsx` shows the
 * full-page loader while the chunk is fetched).
 */
export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <AuthenticatedRoute />,
    children: [{ path: '/select-company', element: <SelectCompanyPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            element: <PermissionRoute permission="users.view" />,
            children: [{ path: 'users', element: <UsersPage /> }],
          },
          {
            element: <PermissionRoute permission="companies.view" />,
            children: [{ path: 'companies', element: <CompaniesPage /> }],
          },
          {
            element: <PermissionRoute permission="companies.create" />,
            children: [{ path: 'companies/new', element: <CompanyFormPage /> }],
          },
          {
            element: <PermissionRoute permission="companies.edit" />,
            children: [{ path: 'companies/:id/edit', element: <CompanyFormPage /> }],
          },
          {
            element: <PermissionRoute permission="permissions.view" />,
            children: [{ path: 'permissions', element: <PermissionsPage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
