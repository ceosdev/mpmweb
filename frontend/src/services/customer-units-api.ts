import { api } from '@/services/api-client'
import type { Paginated, CustomerUnit } from '@/types/api'

export interface CustomerUnitListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  search?: string
  status?: 'all' | 'active' | 'inactive'
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateCustomerUnitPayload {
  description: string
  isActive?: boolean
}

export interface UpdateCustomerUnitPayload {
  description?: string
  isActive?: boolean
}

/**
 * Endpoints for units are nested under their parent region (and its
 * customer): `/api/customers/:customerId/regions/:regionId/units`.
 */
const base = (customerId: number, regionId: number) =>
  `/customers/${customerId}/regions/${regionId}/units`

export const customerUnitsApi = {
  list: (customerId: number, regionId: number, params: CustomerUnitListParams) =>
    api
      .get<Paginated<CustomerUnit>>(base(customerId, regionId), { params })
      .then((r) => r.data),

  get: (customerId: number, regionId: number, id: number) =>
    api.get<CustomerUnit>(`${base(customerId, regionId)}/${id}`).then((r) => r.data),

  create: (customerId: number, regionId: number, payload: CreateCustomerUnitPayload) =>
    api.post<CustomerUnit>(base(customerId, regionId), payload).then((r) => r.data),

  update: (customerId: number, regionId: number, id: number, payload: UpdateCustomerUnitPayload) =>
    api.put<CustomerUnit>(`${base(customerId, regionId)}/${id}`, payload).then((r) => r.data),

  remove: (customerId: number, regionId: number, id: number) =>
    api.delete(`${base(customerId, regionId)}/${id}`).then(() => undefined),
}
