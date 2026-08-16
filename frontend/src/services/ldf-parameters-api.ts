import { api } from '@/services/api-client'
import type { Paginated, LdfParameter } from '@/types/api'

export interface LdfParameterListParams {
  /** Igualdade exata com o id da linha (exibido como "Código"). */
  code?: number
  description?: string
  expenseGroupId?: number
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateLdfParameterPayload {
  description: string
  expenseGroupId: number
  isActive?: boolean
}

export type UpdateLdfParameterPayload = Partial<CreateLdfParameterPayload>

export const ldfParametersApi = {
  list: (params: LdfParameterListParams) =>
    api.get<Paginated<LdfParameter>>('/ldf-parameters', { params }).then((r) => r.data),

  get: (id: number) => api.get<LdfParameter>(`/ldf-parameters/${id}`).then((r) => r.data),

  create: (payload: CreateLdfParameterPayload) =>
    api.post<LdfParameter>('/ldf-parameters', payload).then((r) => r.data),

  update: (id: number, payload: UpdateLdfParameterPayload) =>
    api.put<LdfParameter>(`/ldf-parameters/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/ldf-parameters/${id}`).then(() => undefined),
}
