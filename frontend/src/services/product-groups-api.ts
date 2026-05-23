import { api } from '@/services/api-client'
import type { Paginated, ProductGroup } from '@/types/api'

export interface ProductGroupListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateProductGroupPayload {
  description: string
  isActive?: boolean
}

export interface UpdateProductGroupPayload {
  description?: string
  isActive?: boolean
}

export const productGroupsApi = {
  list: (params: ProductGroupListParams) =>
    api.get<Paginated<ProductGroup>>('/product-groups', { params }).then((r) => r.data),

  get: (id: number) => api.get<ProductGroup>(`/product-groups/${id}`).then((r) => r.data),

  create: (payload: CreateProductGroupPayload) =>
    api.post<ProductGroup>('/product-groups', payload).then((r) => r.data),

  update: (id: number, payload: UpdateProductGroupPayload) =>
    api.put<ProductGroup>(`/product-groups/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/product-groups/${id}`).then(() => undefined),
}
