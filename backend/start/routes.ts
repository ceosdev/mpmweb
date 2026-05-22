/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes of the application.
| Every API route lives under `/api`.
|
| Middleware layers:
|  - public:             no authentication
|  - auth:               valid JWT access token required
|  - auth + tenant:      also requires an active company (x-company-id)
|  - + permission(...):  also requires a specific RBAC permission
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const MeController = () => import('#controllers/me_controller')
const CatalogController = () => import('#controllers/catalog_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const UsersController = () => import('#controllers/users_controller')
const CompaniesController = () => import('#controllers/companies_controller')
const PaymentTypesController = () => import('#controllers/payment_types_controller')
const DocumentTypesController = () => import('#controllers/document_types_controller')
const UnitsOfMeasureController = () => import('#controllers/units_of_measure_controller')

/**
 * Health check.
 */
router.get('/', () => ({ name: 'mpmweb-api', status: 'ok' }))

/**
 * Public authentication routes.
 */
router
  .group(() => {
    router.post('/login', [AuthController, 'login'])
    router.post('/refresh', [AuthController, 'refresh'])
    router.post('/forgot-password', [AuthController, 'forgotPassword'])
    router.post('/reset-password', [AuthController, 'resetPassword'])
  })
  .prefix('/api/auth')

/**
 * Authenticated routes that do NOT require an active company.
 * Used by the login / company-picker flow.
 */
router
  .group(() => {
    router.post('/auth/logout', [AuthController, 'logout'])
    router.get('/auth/me', [AuthController, 'me'])
  })
  .prefix('/api')
  .use(middleware.auth())

/**
 * Authenticated routes scoped to an active company.
 * Each resource route is additionally gated by an RBAC permission.
 */
router
  .group(() => {
    // Active access context (permissions + role for the dynamic menu).
    router.get('/me/context', [MeController, 'context'])

    // Dashboard
    router
      .get('/dashboard', [DashboardController, 'index'])
      .use(middleware.permission('dashboard.view'))

    // Users
    router.get('/users', [UsersController, 'index']).use(middleware.permission('users.view'))
    router.post('/users', [UsersController, 'store']).use(middleware.permission('users.create'))
    router.get('/users/:id', [UsersController, 'show']).use(middleware.permission('users.view'))
    router.put('/users/:id', [UsersController, 'update']).use(middleware.permission('users.edit'))
    router
      .delete('/users/:id', [UsersController, 'destroy'])
      .use(middleware.permission('users.delete'))

    // Companies
    router
      .get('/companies', [CompaniesController, 'index'])
      .use(middleware.permission('companies.view'))
    router
      .post('/companies', [CompaniesController, 'store'])
      .use(middleware.permission('companies.create'))
    router
      .get('/companies/:id', [CompaniesController, 'show'])
      .use(middleware.permission('companies.view'))
    router
      .put('/companies/:id', [CompaniesController, 'update'])
      .use(middleware.permission('companies.edit'))
    router
      .delete('/companies/:id', [CompaniesController, 'destroy'])
      .use(middleware.permission('companies.delete'))

    // RBAC catalog
    router.get('/roles', [CatalogController, 'roles']).use(middleware.permission('permissions.view'))
    router
      .get('/permissions', [CatalogController, 'permissions'])
      .use(middleware.permission('permissions.view'))

    // Payment types
    router
      .get('/payment-types', [PaymentTypesController, 'index'])
      .use(middleware.permission('payment_types.view'))
    router
      .post('/payment-types', [PaymentTypesController, 'store'])
      .use(middleware.permission('payment_types.create'))
    router
      .get('/payment-types/:id', [PaymentTypesController, 'show'])
      .use(middleware.permission('payment_types.view'))
    router
      .put('/payment-types/:id', [PaymentTypesController, 'update'])
      .use(middleware.permission('payment_types.edit'))
    router
      .delete('/payment-types/:id', [PaymentTypesController, 'destroy'])
      .use(middleware.permission('payment_types.delete'))

    // Tipos de documento
    router
      .get('/document-types', [DocumentTypesController, 'index'])
      .use(middleware.permission('document_types.view'))
    router
      .post('/document-types', [DocumentTypesController, 'store'])
      .use(middleware.permission('document_types.create'))
    router
      .get('/document-types/:id', [DocumentTypesController, 'show'])
      .use(middleware.permission('document_types.view'))
    router
      .put('/document-types/:id', [DocumentTypesController, 'update'])
      .use(middleware.permission('document_types.edit'))
    router
      .delete('/document-types/:id', [DocumentTypesController, 'destroy'])
      .use(middleware.permission('document_types.delete'))

    // Unidades de medida
    router
      .get('/units-of-measure', [UnitsOfMeasureController, 'index'])
      .use(middleware.permission('units_of_measure.view'))
    router
      .post('/units-of-measure', [UnitsOfMeasureController, 'store'])
      .use(middleware.permission('units_of_measure.create'))
    router
      .get('/units-of-measure/:id', [UnitsOfMeasureController, 'show'])
      .use(middleware.permission('units_of_measure.view'))
    router
      .put('/units-of-measure/:id', [UnitsOfMeasureController, 'update'])
      .use(middleware.permission('units_of_measure.edit'))
    router
      .delete('/units-of-measure/:id', [UnitsOfMeasureController, 'destroy'])
      .use(middleware.permission('units_of_measure.delete'))
  })
  .prefix('/api')
  .use([middleware.auth(), middleware.tenant()])
