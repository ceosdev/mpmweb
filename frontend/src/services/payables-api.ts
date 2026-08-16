import { api } from '@/services/api-client'
import type { Paginated, Payable, PayableStatusFilter } from '@/types/api'

export interface PayableListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  documentNumber?: string
  supplierId?: number
  dueFrom?: string
  dueTo?: string
  issueFrom?: string
  issueTo?: string
  /** Múltipla escolha. Lista vazia = **todos** (o param nem é enviado). */
  statuses?: PayableStatusFilter[]
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * `status` e `paidAmount` **não** entram no payload: são resultado, não entrada.
 * Ver `docs/spec/financeiro/001-criar-tela-contas-a-pagar.md`.
 */
export interface CreatePayablePayload {
  documentNumber: string
  installment: number
  supplierId: number
  issueDate: string
  dueDate: string
  amount: number
  discount: number
  fine: number
  interest: number
  notes?: string
}

export type UpdatePayablePayload = Partial<CreatePayablePayload>

/** Resultado do pagamento em lote (uma baixa por título, na mesma transação). */
export interface BatchSettleResult {
  settledCount: number
  totalPaid: number
}

export const payablesApi = {
  list: ({ statuses, ...params }: PayableListParams) =>
    api
      .get<Paginated<Payable>>('/payables', {
        params: {
          ...params,
          // Lista vazia = todos: o param some da querystring em vez de virar um
          // filtro vazio (que não devolveria nada).
          status: statuses?.length ? statuses.join(',') : undefined,
        },
      })
      .then((r) => r.data),

  get: (id: number) => api.get<Payable>(`/payables/${id}`).then((r) => r.data),

  create: (payload: CreatePayablePayload) =>
    api.post<Payable>('/payables', payload).then((r) => r.data),

  update: (id: number, payload: UpdatePayablePayload) =>
    api.put<Payable>(`/payables/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/payables/${id}`).then(() => undefined),

  /** Cancela o título: exclui todas as baixas e marca como cancelado. */
  cancel: (id: number) => api.post<Payable>(`/payables/${id}/cancel`).then((r) => r.data),

  /**
   * Pagamento em lote: baixa vários títulos com a mesma forma de pagamento, na
   * data de hoje, cada um pelo saldo restante. Só ids + tipo — o backend deriva
   * valor e data.
   */
  batchSettle: (payableIds: number[], paymentTypeId: number) =>
    api
      .post<BatchSettleResult>('/payables/batch-settlements', { payableIds, paymentTypeId })
      .then((r) => r.data),
}
