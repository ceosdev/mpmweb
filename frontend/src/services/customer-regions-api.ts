import { api } from '@/services/api-client'
import type { Paginated, CustomerRegion } from '@/types/api'

export interface CustomerRegionListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  search?: string
  status?: 'all' | 'active' | 'inactive'
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateCustomerRegionPayload {
  description: string
  isActive?: boolean
}

export interface UpdateCustomerRegionPayload {
  description?: string
  isActive?: boolean
}

/**
 * Endpoints for regions are nested under their parent customer:
 * `/api/customers/:customerId/regions`.
 */
export const customerRegionsApi = {
  list: (customerId: number, params: CustomerRegionListParams) =>
    api
      .get<Paginated<CustomerRegion>>(`/customers/${customerId}/regions`, { params })
      .then((r) => r.data),

  get: (customerId: number, id: number) =>
    api.get<CustomerRegion>(`/customers/${customerId}/regions/${id}`).then((r) => r.data),

  create: (customerId: number, payload: CreateCustomerRegionPayload) =>
    api.post<CustomerRegion>(`/customers/${customerId}/regions`, payload).then((r) => r.data),

  update: (customerId: number, id: number, payload: UpdateCustomerRegionPayload) =>
    api
      .put<CustomerRegion>(`/customers/${customerId}/regions/${id}`, payload)
      .then((r) => r.data),

  remove: (customerId: number, id: number) =>
    api.delete(`/customers/${customerId}/regions/${id}`).then(() => undefined),
}
