import { api } from '@/services/api-client'
import type { Paginated, ProductSubgroup } from '@/types/api'

export interface ProductSubgroupListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateProductSubgroupPayload {
  description: string
  isActive?: boolean
}

export interface UpdateProductSubgroupPayload {
  description?: string
  isActive?: boolean
}

/**
 * Endpoints for subgroups are nested under their parent product group:
 * `/api/product-groups/:groupId/subgroups`.
 */
export const productSubgroupsApi = {
  list: (groupId: number, params: ProductSubgroupListParams) =>
    api
      .get<Paginated<ProductSubgroup>>(`/product-groups/${groupId}/subgroups`, { params })
      .then((r) => r.data),

  get: (groupId: number, id: number) =>
    api
      .get<ProductSubgroup>(`/product-groups/${groupId}/subgroups/${id}`)
      .then((r) => r.data),

  create: (groupId: number, payload: CreateProductSubgroupPayload) =>
    api
      .post<ProductSubgroup>(`/product-groups/${groupId}/subgroups`, payload)
      .then((r) => r.data),

  update: (groupId: number, id: number, payload: UpdateProductSubgroupPayload) =>
    api
      .put<ProductSubgroup>(`/product-groups/${groupId}/subgroups/${id}`, payload)
      .then((r) => r.data),

  remove: (groupId: number, id: number) =>
    api.delete(`/product-groups/${groupId}/subgroups/${id}`).then(() => undefined),
}
