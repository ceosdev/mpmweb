import { api } from '@/services/api-client'
import type { Paginated, Service, ServiceType } from '@/types/api'

export interface ServiceListParams {
  description?: string
  type?: ServiceType
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateServicePayload {
  description: string
  serviceGroupId: number
  /** Reference price in reais. Omit when empty. */
  suggestedValue?: number
  type: ServiceType
  notes?: string
  isActive?: boolean
}

export type UpdateServicePayload = Partial<CreateServicePayload>

export const servicesApi = {
  list: (params: ServiceListParams) =>
    api.get<Paginated<Service>>('/services', { params }).then((r) => r.data),

  get: (id: number) => api.get<Service>(`/services/${id}`).then((r) => r.data),

  create: (payload: CreateServicePayload) =>
    api.post<Service>('/services', payload).then((r) => r.data),

  update: (id: number, payload: UpdateServicePayload) =>
    api.put<Service>(`/services/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/services/${id}`).then(() => undefined),
}
