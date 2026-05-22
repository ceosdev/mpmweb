import { api } from '@/services/api-client'
import type { Paginated, ServiceGroup } from '@/types/api'

export interface ServiceGroupListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateServiceGroupPayload {
  description: string
  isActive?: boolean
}

export interface UpdateServiceGroupPayload {
  description?: string
  isActive?: boolean
}

export const serviceGroupsApi = {
  list: (params: ServiceGroupListParams) =>
    api.get<Paginated<ServiceGroup>>('/service-groups', { params }).then((r) => r.data),

  get: (id: number) => api.get<ServiceGroup>(`/service-groups/${id}`).then((r) => r.data),

  create: (payload: CreateServiceGroupPayload) =>
    api.post<ServiceGroup>('/service-groups', payload).then((r) => r.data),

  update: (id: number, payload: UpdateServiceGroupPayload) =>
    api.put<ServiceGroup>(`/service-groups/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/service-groups/${id}`).then(() => undefined),
}
