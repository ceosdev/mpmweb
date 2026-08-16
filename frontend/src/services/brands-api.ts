import { api } from '@/services/api-client'
import type { Paginated, Brand } from '@/types/api'

export interface BrandListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateBrandPayload {
  description: string
  isActive?: boolean
}

export interface UpdateBrandPayload {
  description?: string
  isActive?: boolean
}

export const brandsApi = {
  list: (params: BrandListParams) =>
    api.get<Paginated<Brand>>('/brands', { params }).then((r) => r.data),

  get: (id: number) => api.get<Brand>(`/brands/${id}`).then((r) => r.data),

  create: (payload: CreateBrandPayload) =>
    api.post<Brand>('/brands', payload).then((r) => r.data),

  update: (id: number, payload: UpdateBrandPayload) =>
    api.put<Brand>(`/brands/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/brands/${id}`).then(() => undefined),
}
