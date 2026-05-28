import { api } from '@/services/api-client'
import type { Paginated, Supplier, SupplierType } from '@/types/api'

export interface SupplierListParams {
  name?: string
  taxId?: string
  type?: SupplierType
  status?: 'all' | 'active' | 'inactive'
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateSupplierPayload {
  taxId: string
  name: string
  type: SupplierType
  address?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  phone?: string
  mobile?: string
  contactName?: string
  isActive?: boolean
}

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>

export const suppliersApi = {
  list: (params: SupplierListParams) =>
    api.get<Paginated<Supplier>>('/suppliers', { params }).then((r) => r.data),

  get: (id: number) => api.get<Supplier>(`/suppliers/${id}`).then((r) => r.data),

  create: (payload: CreateSupplierPayload) =>
    api.post<Supplier>('/suppliers', payload).then((r) => r.data),

  update: (id: number, payload: UpdateSupplierPayload) =>
    api.put<Supplier>(`/suppliers/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/suppliers/${id}`).then(() => undefined),
}
