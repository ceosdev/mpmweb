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
