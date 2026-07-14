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
const RolesController = () => import('#controllers/roles_controller')
const PaymentTypesController = () => import('#controllers/payment_types_controller')
const DocumentTypesController = () => import('#controllers/document_types_controller')
const UnitsOfMeasureController = () => import('#controllers/units_of_measure_controller')
const ServiceGroupsController = () => import('#controllers/service_groups_controller')
const ProductGroupsController = () => import('#controllers/product_groups_controller')
const ProductSubgroupsController = () => import('#controllers/product_subgroups_controller')
const SuppliersController = () => import('#controllers/suppliers_controller')
const CustomersController = () => import('#controllers/customers_controller')
const ServicesController = () => import('#controllers/services_controller')
const ProductsController = () => import('#controllers/products_controller')
const ProductAssetsController = () => import('#controllers/product_assets_controller')
const BrandsController = () => import('#controllers/brands_controller')
const BrandModelsController = () => import('#controllers/brand_models_controller')
const PayablesController = () => import('#controllers/payables_controller')

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
    router
      .get('/users/importable', [UsersController, 'importable'])
      .use(middleware.permission('users.import'))
    router
      .post('/users/import', [UsersController, 'import'])
      .use(middleware.permission('users.import'))
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
      .get('/companies/import-sources', [CompaniesController, 'importSources'])
      .use(middleware.permission('users.import'))
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
    router
      .get('/permissions', [CatalogController, 'permissions'])
      .use(middleware.permission('permissions.view'))

    // Roles (perfis por empresa)
    router.get('/roles', [RolesController, 'index']).use(middleware.permission('roles.view'))
    router
      .get('/roles/options', [RolesController, 'options'])
      .use(middleware.permission('permissions.view'))
    router.post('/roles', [RolesController, 'store']).use(middleware.permission('roles.create'))
    router.get('/roles/:id', [RolesController, 'show']).use(middleware.permission('roles.view'))
    router.put('/roles/:id', [RolesController, 'update']).use(middleware.permission('roles.edit'))
    router
      .delete('/roles/:id', [RolesController, 'destroy'])
      .use(middleware.permission('roles.delete'))

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

    // Grupos de serviço
    router
      .get('/service-groups', [ServiceGroupsController, 'index'])
      .use(middleware.permission('service_groups.view'))
    router
      .post('/service-groups', [ServiceGroupsController, 'store'])
      .use(middleware.permission('service_groups.create'))
    router
      .get('/service-groups/:id', [ServiceGroupsController, 'show'])
      .use(middleware.permission('service_groups.view'))
    router
      .put('/service-groups/:id', [ServiceGroupsController, 'update'])
      .use(middleware.permission('service_groups.edit'))
    router
      .delete('/service-groups/:id', [ServiceGroupsController, 'destroy'])
      .use(middleware.permission('service_groups.delete'))

    // Grupos de produto
    router
      .get('/product-groups', [ProductGroupsController, 'index'])
      .use(middleware.permission('product_groups.view'))
    router
      .post('/product-groups', [ProductGroupsController, 'store'])
      .use(middleware.permission('product_groups.create'))
    router
      .get('/product-groups/:id', [ProductGroupsController, 'show'])
      .use(middleware.permission('product_groups.view'))
    router
      .put('/product-groups/:id', [ProductGroupsController, 'update'])
      .use(middleware.permission('product_groups.edit'))
    router
      .delete('/product-groups/:id', [ProductGroupsController, 'destroy'])
      .use(middleware.permission('product_groups.delete'))

    // Subgrupos de produto (filhos de product_groups, escopados pelo path :groupId)
    router
      .get('/product-groups/:groupId/subgroups', [ProductSubgroupsController, 'index'])
      .use(middleware.permission('product_subgroups.view'))
    router
      .post('/product-groups/:groupId/subgroups', [ProductSubgroupsController, 'store'])
      .use(middleware.permission('product_subgroups.create'))
    router
      .get('/product-groups/:groupId/subgroups/:id', [ProductSubgroupsController, 'show'])
      .use(middleware.permission('product_subgroups.view'))
    router
      .put('/product-groups/:groupId/subgroups/:id', [ProductSubgroupsController, 'update'])
      .use(middleware.permission('product_subgroups.edit'))
    router
      .delete('/product-groups/:groupId/subgroups/:id', [ProductSubgroupsController, 'destroy'])
      .use(middleware.permission('product_subgroups.delete'))

    // Fornecedores
    router
      .get('/suppliers', [SuppliersController, 'index'])
      .use(middleware.permission('suppliers.view'))
    router
      .post('/suppliers', [SuppliersController, 'store'])
      .use(middleware.permission('suppliers.create'))
    // Lookup do EntityPicker: sem middleware.permission (basta ter acesso à tela
    // que usa o componente). DEVE vir antes de '/suppliers/:id', senão o router
    // casa 'lookup' como um id.
    router.get('/suppliers/lookup', [SuppliersController, 'lookup'])
    router
      .get('/suppliers/:id', [SuppliersController, 'show'])
      .use(middleware.permission('suppliers.view'))
    router
      .put('/suppliers/:id', [SuppliersController, 'update'])
      .use(middleware.permission('suppliers.edit'))
    router
      .delete('/suppliers/:id', [SuppliersController, 'destroy'])
      .use(middleware.permission('suppliers.delete'))

    // Clientes
    router
      .get('/customers', [CustomersController, 'index'])
      .use(middleware.permission('customers.view'))
    router
      .post('/customers', [CustomersController, 'store'])
      .use(middleware.permission('customers.create'))
    // Lookup do EntityPicker — ver a nota em '/suppliers/lookup'.
    router.get('/customers/lookup', [CustomersController, 'lookup'])
    router
      .get('/customers/:id', [CustomersController, 'show'])
      .use(middleware.permission('customers.view'))
    router
      .put('/customers/:id', [CustomersController, 'update'])
      .use(middleware.permission('customers.edit'))
    router
      .delete('/customers/:id', [CustomersController, 'destroy'])
      .use(middleware.permission('customers.delete'))

    // Serviços
    router
      .get('/services', [ServicesController, 'index'])
      .use(middleware.permission('services.view'))
    router
      .post('/services', [ServicesController, 'store'])
      .use(middleware.permission('services.create'))
    router
      .get('/services/:id', [ServicesController, 'show'])
      .use(middleware.permission('services.view'))
    router
      .put('/services/:id', [ServicesController, 'update'])
      .use(middleware.permission('services.edit'))
    router
      .delete('/services/:id', [ServicesController, 'destroy'])
      .use(middleware.permission('services.delete'))

    // Produtos
    router
      .get('/products', [ProductsController, 'index'])
      .use(middleware.permission('products.view'))
    router
      .post('/products', [ProductsController, 'store'])
      .use(middleware.permission('products.create'))
    router
      .get('/products/:id', [ProductsController, 'show'])
      .use(middleware.permission('products.view'))
    router
      .put('/products/:id', [ProductsController, 'update'])
      .use(middleware.permission('products.edit'))
    router
      .delete('/products/:id', [ProductsController, 'destroy'])
      .use(middleware.permission('products.delete'))

    // Ativos (filhos de products, escopados pelo path :productId — só produtos fixed_asset)
    router
      .get('/products/:productId/assets', [ProductAssetsController, 'index'])
      .use(middleware.permission('product_assets.view'))
    router
      .post('/products/:productId/assets', [ProductAssetsController, 'store'])
      .use(middleware.permission('product_assets.create'))
    router
      .get('/products/:productId/assets/:id', [ProductAssetsController, 'show'])
      .use(middleware.permission('product_assets.view'))
    router
      .put('/products/:productId/assets/:id', [ProductAssetsController, 'update'])
      .use(middleware.permission('product_assets.edit'))
    router
      .delete('/products/:productId/assets/:id', [ProductAssetsController, 'destroy'])
      .use(middleware.permission('product_assets.delete'))

    // Marcas
    router.get('/brands', [BrandsController, 'index']).use(middleware.permission('brands.view'))
    router.post('/brands', [BrandsController, 'store']).use(middleware.permission('brands.create'))
    router.get('/brands/:id', [BrandsController, 'show']).use(middleware.permission('brands.view'))
    router.put('/brands/:id', [BrandsController, 'update']).use(middleware.permission('brands.edit'))
    router
      .delete('/brands/:id', [BrandsController, 'destroy'])
      .use(middleware.permission('brands.delete'))

    // Modelos (filhos de brands, escopados pelo path :brandId)
    router
      .get('/brands/:brandId/models', [BrandModelsController, 'index'])
      .use(middleware.permission('brand_models.view'))
    router
      .post('/brands/:brandId/models', [BrandModelsController, 'store'])
      .use(middleware.permission('brand_models.create'))
    router
      .get('/brands/:brandId/models/:id', [BrandModelsController, 'show'])
      .use(middleware.permission('brand_models.view'))
    router
      .put('/brands/:brandId/models/:id', [BrandModelsController, 'update'])
      .use(middleware.permission('brand_models.edit'))
    router
      .delete('/brands/:brandId/models/:id', [BrandModelsController, 'destroy'])
      .use(middleware.permission('brand_models.delete'))

    // Contas a pagar (financeiro)
    router
      .get('/payables', [PayablesController, 'index'])
      .use(middleware.permission('payables.view'))
    router
      .post('/payables', [PayablesController, 'store'])
      .use(middleware.permission('payables.create'))
    router
      .get('/payables/:id', [PayablesController, 'show'])
      .use(middleware.permission('payables.view'))
    router
      .put('/payables/:id', [PayablesController, 'update'])
      .use(middleware.permission('payables.edit'))
    router
      .delete('/payables/:id', [PayablesController, 'destroy'])
      .use(middleware.permission('payables.delete'))
  })
  .prefix('/api')
  .use([middleware.auth(), middleware.tenant()])
