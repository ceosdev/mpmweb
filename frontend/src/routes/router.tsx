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
const RolesPage = lazy(() =>
  import('@/modules/roles/roles-page').then((m) => ({ default: m.RolesPage }))
)
const RoleFormPage = lazy(() =>
  import('@/modules/roles/role-form-page').then((m) => ({ default: m.RoleFormPage }))
)
const PaymentTypesPage = lazy(() =>
  import('@/modules/payment-types/payment-types-page').then((m) => ({
    default: m.PaymentTypesPage,
  }))
)
const DocumentTypesPage = lazy(() =>
  import('@/modules/document-types/document-types-page').then((m) => ({
    default: m.DocumentTypesPage,
  }))
)
const UnitsOfMeasurePage = lazy(() =>
  import('@/modules/units-of-measure/units-of-measure-page').then((m) => ({
    default: m.UnitsOfMeasurePage,
  }))
)
const ServiceGroupsPage = lazy(() =>
  import('@/modules/service-groups/service-groups-page').then((m) => ({
    default: m.ServiceGroupsPage,
  }))
)
const ProductGroupsPage = lazy(() =>
  import('@/modules/product-groups/product-groups-page').then((m) => ({
    default: m.ProductGroupsPage,
  }))
)
const ProductSubgroupsPage = lazy(() =>
  import('@/modules/product-subgroups/product-subgroups-page').then((m) => ({
    default: m.ProductSubgroupsPage,
  }))
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
          {
            element: <PermissionRoute permission="roles.view" />,
            children: [{ path: 'roles', element: <RolesPage /> }],
          },
          {
            element: <PermissionRoute permission="roles.create" />,
            children: [{ path: 'roles/new', element: <RoleFormPage /> }],
          },
          {
            element: <PermissionRoute permission="roles.edit" />,
            children: [{ path: 'roles/:id/edit', element: <RoleFormPage /> }],
          },
          {
            element: <PermissionRoute permission="payment_types.view" />,
            children: [{ path: 'payment-types', element: <PaymentTypesPage /> }],
          },
          {
            element: <PermissionRoute permission="document_types.view" />,
            children: [{ path: 'document-types', element: <DocumentTypesPage /> }],
          },
          {
            element: <PermissionRoute permission="units_of_measure.view" />,
            children: [{ path: 'units-of-measure', element: <UnitsOfMeasurePage /> }],
          },
          {
            element: <PermissionRoute permission="service_groups.view" />,
            children: [{ path: 'service-groups', element: <ServiceGroupsPage /> }],
          },
          {
            element: <PermissionRoute permission="product_groups.view" />,
            children: [{ path: 'product-groups', element: <ProductGroupsPage /> }],
          },
          {
            element: <PermissionRoute permission="product_subgroups.view" />,
            children: [
              {
                path: 'product-groups/:groupId/subgroups',
                element: <ProductSubgroupsPage />,
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
