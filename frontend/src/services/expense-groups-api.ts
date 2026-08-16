import { api } from '@/services/api-client'
import type { Paginated, ExpenseGroup } from '@/types/api'

export interface ExpenseGroupListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateExpenseGroupPayload {
  description: string
  isActive?: boolean
}

export interface UpdateExpenseGroupPayload {
  description?: string
  isActive?: boolean
}

export const expenseGroupsApi = {
  list: (params: ExpenseGroupListParams) =>
    api.get<Paginated<ExpenseGroup>>('/expense-groups', { params }).then((r) => r.data),

  get: (id: number) => api.get<ExpenseGroup>(`/expense-groups/${id}`).then((r) => r.data),

  create: (payload: CreateExpenseGroupPayload) =>
    api.post<ExpenseGroup>('/expense-groups', payload).then((r) => r.data),

  update: (id: number, payload: UpdateExpenseGroupPayload) =>
    api.put<ExpenseGroup>(`/expense-groups/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/expense-groups/${id}`).then(() => undefined),
}
