import { api } from '@/services/api-client'
import type { Paginated, BrandModel } from '@/types/api'

export interface BrandModelListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateBrandModelPayload {
  description: string
  isActive?: boolean
}

export interface UpdateBrandModelPayload {
  description?: string
  isActive?: boolean
}

/**
 * Endpoints for models are nested under their parent brand:
 * `/api/brands/:brandId/models`.
 */
export const brandModelsApi = {
  list: (brandId: number, params: BrandModelListParams) =>
    api
      .get<Paginated<BrandModel>>(`/brands/${brandId}/models`, { params })
      .then((r) => r.data),

  get: (brandId: number, id: number) =>
    api.get<BrandModel>(`/brands/${brandId}/models/${id}`).then((r) => r.data),

  create: (brandId: number, payload: CreateBrandModelPayload) =>
    api.post<BrandModel>(`/brands/${brandId}/models`, payload).then((r) => r.data),

  update: (brandId: number, id: number, payload: UpdateBrandModelPayload) =>
    api.put<BrandModel>(`/brands/${brandId}/models/${id}`, payload).then((r) => r.data),

  remove: (brandId: number, id: number) =>
    api.delete(`/brands/${brandId}/models/${id}`).then(() => undefined),
}
