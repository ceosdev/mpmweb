import { api } from '@/services/api-client'
import type { PayableSettlement } from '@/types/api'

/**
 * Baixas (pagamentos) de um título, aninhadas em
 * `/payables/:payableId/settlements`. Escopadas server-side pela empresa ativa
 * (header `x-company-id`). Sem paginação — a lista de baixas de um título é curta.
 */
export interface CreatePayableSettlementPayload {
  settlementDate: string
  paymentTypeId: number
  amount: number
  documentNumber?: string
  notes?: string
}

export type UpdatePayableSettlementPayload = Partial<CreatePayableSettlementPayload>

export const payableSettlementsApi = {
  list: (payableId: number) =>
    api
      .get<PayableSettlement[]>(`/payables/${payableId}/settlements`)
      .then((r) => r.data),

  create: (payableId: number, payload: CreatePayableSettlementPayload) =>
    api
      .post<PayableSettlement>(`/payables/${payableId}/settlements`, payload)
      .then((r) => r.data),

  update: (payableId: number, id: number, payload: UpdatePayableSettlementPayload) =>
    api
      .put<PayableSettlement>(`/payables/${payableId}/settlements/${id}`, payload)
      .then((r) => r.data),

  remove: (payableId: number, id: number) =>
    api.delete(`/payables/${payableId}/settlements/${id}`).then(() => undefined),
}
