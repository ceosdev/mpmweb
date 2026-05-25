import { api } from '@/services/api-client'
import type { Paginated, Role, RoleListItem } from '@/types/api'

export interface RoleListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateRolePayload {
  name: string
  slug: string
  description?: string
  isActive?: boolean
  permissions?: number[]
}

export interface UpdateRolePayload {
  name?: string
  slug?: string
  description?: string | null
  isActive?: boolean
  permissions?: number[]
}

/**
 * Roles (per-company profiles) endpoints. Scoped server-side by the active
 * company; the platform-level ROOT role is never returned by any of these.
 */
export const rolesApi = {
  list: (params: RoleListParams) =>
    api.get<Paginated<RoleListItem>>('/roles', { params }).then((r) => r.data),

  get: (id: number) => api.get<Role>(`/roles/${id}`).then((r) => r.data),

  create: (payload: CreateRolePayload) =>
    api.post<Role>('/roles', payload).then((r) => r.data),

  update: (id: number, payload: UpdateRolePayload) =>
    api.put<Role>(`/roles/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/roles/${id}`).then(() => undefined),
}
