import { api } from '@/services/api-client'
import type { Paginated, PaymentType } from '@/types/api'

export interface PaymentTypeListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreatePaymentTypePayload {
  description: string
  isActive?: boolean
}

export interface UpdatePaymentTypePayload {
  description?: string
  isActive?: boolean
}

/**
 * Payment types endpoints. Scoped server-side by the active company via the
 * `x-company-id` header injected by `api-client`.
 */
export const paymentTypesApi = {
  list: (params: PaymentTypeListParams) =>
    api.get<Paginated<PaymentType>>('/payment-types', { params }).then((r) => r.data),

  get: (id: number) => api.get<PaymentType>(`/payment-types/${id}`).then((r) => r.data),

  create: (payload: CreatePaymentTypePayload) =>
    api.post<PaymentType>('/payment-types', payload).then((r) => r.data),

  update: (id: number, payload: UpdatePaymentTypePayload) =>
    api.put<PaymentType>(`/payment-types/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/payment-types/${id}`).then(() => undefined),
}
