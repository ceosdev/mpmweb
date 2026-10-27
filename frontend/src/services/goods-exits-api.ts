import { api } from '@/services/api-client'
import type {
  GoodsExit,
  GoodsExitFinalizePreview,
  GoodsExitListParams,
  GoodsExitPayload,
  Paginated,
} from '@/types/api'

export const goodsExitsApi = {
  list: ({ statuses, ...params }: GoodsExitListParams) =>
    api
      .get<Paginated<GoodsExit>>('/goods-exits', {
        params: {
          ...params,
          // Lista vazia = todas: o param some da querystring.
          status: statuses?.length ? statuses.join(',') : undefined,
        },
      })
      .then((r) => r.data),

  get: (id: number) => api.get<GoodsExit>(`/goods-exits/${id}`).then((r) => r.data),

  create: (payload: GoodsExitPayload) =>
    api.post<GoodsExit>('/goods-exits', payload).then((r) => r.data),

  update: (id: number, payload: GoodsExitPayload) =>
    api.put<GoodsExit>(`/goods-exits/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/goods-exits/${id}`).then(() => undefined),

  finalizePreview: (id: number) =>
    api.get<GoodsExitFinalizePreview>(`/goods-exits/${id}/finalize-preview`).then((r) => r.data),

  finalize: (id: number, items: { productId: number; consumedQuantity: string }[]) =>
    api.post<GoodsExit>(`/goods-exits/${id}/finalize`, { items }).then((r) => r.data),

  deliver: (id: number) => api.post<GoodsExit>(`/goods-exits/${id}/deliver`).then((r) => r.data),

  returnTools: (id: number) => api.post<GoodsExit>(`/goods-exits/${id}/return`).then((r) => r.data),

  /** Protocolo em PDF (blob). Use via `openPdf`. */
  protocol: (id: number) =>
    api
      .get<Blob>(`/goods-exits/${id}/protocol`, { responseType: 'blob' })
      .then((r) => r.data),
}
