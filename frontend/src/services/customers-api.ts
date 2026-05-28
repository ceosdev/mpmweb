import { api } from '@/services/api-client'
import type { Customer, CustomerType, Paginated } from '@/types/api'

export interface CustomerListParams {
  name?: string
  taxId?: string
  type?: CustomerType
  status?: 'all' | 'active' | 'inactive'
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateCustomerPayload {
  type: CustomerType
  legalName: string
  tradeName?: string
  taxId: string
  address?: string
  addressNumber?: string
  addressComplement?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  phone?: string
  mobile?: string
  email?: string
  /** ISO date (YYYY-MM-DD). When omitted, backend defaults to today on create. */
  customerSince?: string
  contactName?: string
  isActive?: boolean
  isInternal?: boolean
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>

export const customersApi = {
  list: (params: CustomerListParams) =>
    api.get<Paginated<Customer>>('/customers', { params }).then((r) => r.data),

  get: (id: number) => api.get<Customer>(`/customers/${id}`).then((r) => r.data),

  create: (payload: CreateCustomerPayload) =>
    api.post<Customer>('/customers', payload).then((r) => r.data),

  update: (id: number, payload: UpdateCustomerPayload) =>
    api.put<Customer>(`/customers/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/customers/${id}`).then(() => undefined),
}
