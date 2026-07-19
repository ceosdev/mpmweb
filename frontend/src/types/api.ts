/**
 * Shared API contract types — mirror the JSON returned by the AdonisJS
 * backend. Field names are in English (the API speaks English); only the
 * text rendered to the user is in Portuguese.
 */

export interface AuthUser {
  id: number
  name: string
  email: string
  isRoot: boolean
}

/** A company the user can switch into. */
export interface CompanySummary {
  id: number
  legalName: string
  tradeName: string | null
  slug: string
  /** Relative path under the API host, e.g. `/uploads/logos/abc.png`. */
  logoUrl: string | null
  role: string | null
}

export interface LoginResponse {
  user: AuthUser
  companies: CompanySummary[]
  accessToken: string
  refreshToken: string
}

export interface MeResponse {
  user: AuthUser
  companies: CompanySummary[]
}

/** Resolved access context for the active company. */
export interface TenantContext {
  companyId: number
  company: { id: number; legalName: string; tradeName: string | null; slug: string }
  role: string | null
  isRoot: boolean
  permissions: string[]
}

export interface ContextResponse {
  user: AuthUser
  tenant: TenantContext
}

export interface Permission {
  id: number
  name: string
  slug: string
  module: string
  action: string
  description: string | null
}

export interface Role {
  id: number
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  permissions?: Permission[]
}

export interface RoleListItem {
  id: number
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  permissionsCount: number
  createdAt: string | null
}

export interface UserListItem {
  id: number
  membershipId: number
  name: string
  email: string
  isRoot: boolean
  isActive: boolean
  lastLoginAt: string | null
  role: { id: number; name: string; slug: string } | null
  createdAt: string | null
}

export interface UserDetail extends UserListItem {
  extraPermissions: { id: number; slug: string; name: string }[]
}

/** Slim representation of a user that can be imported from another company. */
export interface ImportableUser {
  id: number
  name: string
  email: string
}

/** Slim representation of a company eligible as the source of an import. */
export interface ImportSourceCompany {
  id: number
  legalName: string
  tradeName: string | null
}

export interface Company {
  id: number
  legalName: string
  tradeName: string | null
  taxId: string | null
  stateRegistration: string | null
  municipalRegistration: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  city: string | null
  zipCode: string | null
  state: string | null
  phone: string | null
  email: string | null
  /** Relative path under the API host (`/uploads/logos/...`). */
  logoUrl: string | null
  slug: string
  isActive: boolean
  createdAt: string | null
}

export interface PaginationMeta {
  total: number
  page: number
  perPage: number
  lastPage: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface DashboardStats {
  activeUsers: number
  companies: number
  roles: number
  permissions: number
}

export interface PaymentType {
  id: number
  description: string
  isActive: boolean
  /** Whether this payment type performs the automatic write-off (baixa) of a title. */
  autoSettlement: boolean
  createdAt: string | null
}

export interface DocumentType {
  id: number
  description: string
  isActive: boolean
  createdAt: string | null
}

export interface UnitOfMeasure {
  id: number
  description: string
  isActive: boolean
  createdAt: string | null
}

export interface ServiceGroup {
  id: number
  description: string
  isActive: boolean
  createdAt: string | null
}

export interface ProductGroup {
  id: number
  description: string
  isActive: boolean
  createdAt: string | null
}

export interface ProductSubgroup {
  id: number
  productGroupId: number
  description: string
  isActive: boolean
  createdAt: string | null
}

export type SupplierType = 'goods' | 'service'

export interface Supplier {
  id: number
  taxId: string
  name: string
  type: SupplierType
  address: string | null
  neighborhood: string | null
  city: string | null
  zipCode: string | null
  phone: string | null
  mobile: string | null
  contactName: string | null
  isActive: boolean
  createdAt: string | null
}

export type ServiceType = 'internal' | 'third_party'

export interface Service {
  id: number
  serviceGroupId: number
  /** Description of the parent service group, returned by the listing. */
  groupDescription: string | null
  description: string
  /** Reference price in reais. */
  suggestedValue: number | null
  type: ServiceType
  notes: string | null
  isActive: boolean
  createdAt: string | null
}

export type ProductType = 'consumable' | 'fixed_asset'

export interface Product {
  id: number
  description: string
  type: ProductType
  productGroupId: number | null
  /** Description of the parent product group, returned by the listing. */
  groupDescription: string | null
  productSubgroupId: number | null
  unitOfMeasureId: number | null
  /** Description of the unit of measure, returned by the listing. */
  unitDescription: string | null
  controlsStock: boolean
  minimumStock: number | null
  quantityInStock: number | null
  /** Cost price in reais. */
  costPrice: number | null
  isActive: boolean
  createdAt: string | null
}

export type CustomerType = 'individual' | 'company'

export interface Customer {
  id: number
  type: CustomerType
  legalName: string
  tradeName: string | null
  taxId: string
  address: string | null
  addressNumber: string | null
  addressComplement: string | null
  neighborhood: string | null
  city: string | null
  zipCode: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  /** ISO date (YYYY-MM-DD). */
  customerSince: string | null
  contactName: string | null
  isActive: boolean
  isInternal: boolean
  createdAt: string | null
}

export interface Brand {
  id: number
  description: string
  isActive: boolean
  createdAt: string | null
}

export interface BrandModel {
  id: number
  brandId: number
  description: string
  isActive: boolean
  createdAt: string | null
}

export type AssetSituation = 'available' | 'allocated' | 'sold'

export interface ProductAsset {
  id: number
  productId: number
  description: string
  assetCode: string | null
  brandId: number | null
  brandModelId: number | null
  manufactureYear: string | null
  btu: string | null
  situation: AssetSituation
  equipmentExists: boolean
  notes: string | null
  createdAt: string | null
}

/**
 * Lookup — projeções mínimas consumidas pelo EntityPicker
 * (`GET /api/<entidade>/lookup`). Só o suficiente para identificar o registro:
 * o endpoint é acessível a qualquer usuário do tenant, sem a permissão do
 * cadastro. Ver `docs/spec/comum/001-componente-entity-picker.md`.
 */
export interface LookupResponse<T> {
  data: T[]
  /** Havia mais resultados além do limite — a UI pede para refinar a busca. */
  hasMore: boolean
}

export interface SupplierLookup {
  id: number
  name: string
  taxId: string
  isActive: boolean
}

export interface CustomerLookup {
  id: number
  legalName: string
  tradeName: string | null
  taxId: string
  isActive: boolean
}

/**
 * Título a pagar. `status`, `total`, `balance` e `isOverdue` vêm **resolvidos
 * pelo backend** — o cliente não recalcula nenhum deles (em especial `isOverdue`,
 * que depende de "hoje" no fuso da aplicação; o servidor roda em UTC).
 * Ver `docs/spec/financeiro/001-criar-tela-contas-a-pagar.md`.
 */
export type PayableStatus = 'open' | 'partially_paid' | 'paid' | 'cancelled'

/** `overdue` é virtual: não é status gravado, é comparação de data. */
export type PayableStatusFilter = PayableStatus | 'overdue'

export interface Payable {
  id: number
  supplierId: number
  supplierName: string | null
  documentNumber: string
  installment: number
  issueDate: string
  dueDate: string
  amount: number
  discount: number
  fine: number
  interest: number
  paidAmount: number
  status: PayableStatus
  notes: string | null
  /** amount - discount + fine + interest. É o que a coluna "Valor" exibe. */
  total: number
  /** max(0, total - paidAmount); 0 quando cancelado. */
  balance: number
  isOverdue: boolean
  createdAt: string | null
}

/** Baixa (pagamento) de um título a pagar. Ver `docs/spec/financeiro/002`. */
export interface PayableSettlement {
  id: number
  payableId: number
  paymentTypeId: number
  paymentTypeName: string | null
  settlementDate: string
  amount: number
  documentNumber: string | null
  notes: string | null
  createdAt: string | null
}
