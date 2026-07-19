import { api } from '@/services/api-client'
import type { ReceivableSettlement } from '@/types/api'

/**
 * Baixas (recebimentos) de um título, aninhadas em
 * `/receivables/:receivableId/settlements`. Escopadas server-side pela empresa
 * ativa (header `x-company-id`). Sem paginação — a lista de baixas é curta.
 */
export interface CreateReceivableSettlementPayload {
  settlementDate: string
  paymentTypeId: number
  amount: number
  documentNumber?: string
  notes?: string
}

export type UpdateReceivableSettlementPayload = Partial<CreateReceivableSettlementPayload>

export const receivableSettlementsApi = {
  list: (receivableId: number) =>
    api
      .get<ReceivableSettlement[]>(`/receivables/${receivableId}/settlements`)
      .then((r) => r.data),

  create: (receivableId: number, payload: CreateReceivableSettlementPayload) =>
    api
      .post<ReceivableSettlement>(`/receivables/${receivableId}/settlements`, payload)
      .then((r) => r.data),

  update: (receivableId: number, id: number, payload: UpdateReceivableSettlementPayload) =>
    api
      .put<ReceivableSettlement>(`/receivables/${receivableId}/settlements/${id}`, payload)
      .then((r) => r.data),

  remove: (receivableId: number, id: number) =>
    api.delete(`/receivables/${receivableId}/settlements/${id}`).then(() => undefined),
}
