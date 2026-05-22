import { api } from '@/services/api-client'
import type { Paginated, UserDetail, UserListItem } from '@/types/api'

export interface UserListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  roleId: number
  isActive?: boolean
  extraPermissions?: number[]
}

export interface UpdateUserPayload {
  name?: string
  password?: string
  roleId?: number
  isActive?: boolean
  extraPermissions?: number[]
}

/**
 * Users endpoints — scoped to the active company by the `x-company-id` header.
 */
export const usersApi = {
  list: (params: UserListParams) =>
    api.get<Paginated<UserListItem>>('/users', { params }).then((r) => r.data),

  get: (id: number) => api.get<UserDetail>(`/users/${id}`).then((r) => r.data),

  create: (payload: CreateUserPayload) =>
    api.post<UserListItem>('/users', payload).then((r) => r.data),

  update: (id: number, payload: UpdateUserPayload) =>
    api.put<UserListItem>(`/users/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/users/${id}`).then(() => undefined),
}
