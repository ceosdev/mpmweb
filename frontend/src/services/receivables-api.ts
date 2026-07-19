import { api } from '@/services/api-client'
import type { Paginated, Receivable, ReceivableStatusFilter } from '@/types/api'

export interface ReceivableListParams {
  documentNumber?: string
  customerId?: number
  dueFrom?: string
  dueTo?: string
  issueFrom?: string
  issueTo?: string
  /** Múltipla escolha. Lista vazia = **todos** (o param nem é enviado). */
  statuses?: ReceivableStatusFilter[]
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * `status` e `paidAmount` **não** entram no payload: são resultado, não entrada.
 * Ver `docs/spec/financeiro/004-contas-a-receber.md`.
 */
export interface CreateReceivablePayload {
  documentNumber: string
  installment: number
  customerId: number
  issueDate: string
  dueDate: string
  amount: number
  discount: number
  fine: number
  interest: number
  notes?: string
}

export type UpdateReceivablePayload = Partial<CreateReceivablePayload>

/** Resultado do recebimento em lote (uma baixa por título, na mesma transação). */
export interface BatchSettleResult {
  settledCount: number
  totalPaid: number
}

export const receivablesApi = {
  list: ({ statuses, ...params }: ReceivableListParams) =>
    api
      .get<Paginated<Receivable>>('/receivables', {
        params: {
          ...params,
          // Lista vazia = todos: o param some da querystring em vez de virar um
          // filtro vazio (que não devolveria nada).
          status: statuses?.length ? statuses.join(',') : undefined,
        },
      })
      .then((r) => r.data),

  get: (id: number) => api.get<Receivable>(`/receivables/${id}`).then((r) => r.data),

  create: (payload: CreateReceivablePayload) =>
    api.post<Receivable>('/receivables', payload).then((r) => r.data),

  update: (id: number, payload: UpdateReceivablePayload) =>
    api.put<Receivable>(`/receivables/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/receivables/${id}`).then(() => undefined),

  /** Cancela o título: exclui todas as baixas e marca como cancelado. */
  cancel: (id: number) => api.post<Receivable>(`/receivables/${id}/cancel`).then((r) => r.data),

  /**
   * Recebimento em lote: baixa vários títulos com a mesma forma de pagamento, na
   * data de hoje, cada um pelo saldo restante. Só ids + tipo — o backend deriva
   * valor e data.
   */
  batchSettle: (receivableIds: number[], paymentTypeId: number) =>
    api
      .post<BatchSettleResult>('/receivables/batch-settlements', {
        receivableIds,
        paymentTypeId,
      })
      .then((r) => r.data),
}
