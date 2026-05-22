import { api } from '@/services/api-client'
import type { Paginated, UnitOfMeasure } from '@/types/api'

export interface UnitOfMeasureListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateUnitOfMeasurePayload {
  description: string
  isActive?: boolean
}

export interface UpdateUnitOfMeasurePayload {
  description?: string
  isActive?: boolean
}

export const unitsOfMeasureApi = {
  list: (params: UnitOfMeasureListParams) =>
    api.get<Paginated<UnitOfMeasure>>('/units-of-measure', { params }).then((r) => r.data),

  get: (id: number) => api.get<UnitOfMeasure>(`/units-of-measure/${id}`).then((r) => r.data),

  create: (payload: CreateUnitOfMeasurePayload) =>
    api.post<UnitOfMeasure>('/units-of-measure', payload).then((r) => r.data),

  update: (id: number, payload: UpdateUnitOfMeasurePayload) =>
    api.put<UnitOfMeasure>(`/units-of-measure/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/units-of-measure/${id}`).then(() => undefined),
}
