import { api } from '@/services/api-client'
import type {
  GoodsEntry,
  GoodsEntryFinalizePreview,
  GoodsEntryListParams,
  GoodsEntryPayload,
  Paginated,
} from '@/types/api'

export const goodsEntriesApi = {
  list: ({ statuses, ...params }: GoodsEntryListParams) =>
    api
      .get<Paginated<GoodsEntry>>('/goods-entries', {
        params: {
          ...params,
          // Lista vazia = todas: o param some da querystring.
          status: statuses?.length ? statuses.join(',') : undefined,
        },
      })
      .then((r) => r.data),

  get: (id: number) => api.get<GoodsEntry>(`/goods-entries/${id}`).then((r) => r.data),

  create: (payload: GoodsEntryPayload) =>
    api.post<GoodsEntry>('/goods-entries', payload).then((r) => r.data),

  update: (id: number, payload: GoodsEntryPayload) =>
    api.put<GoodsEntry>(`/goods-entries/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/goods-entries/${id}`).then(() => undefined),

  finalizePreview: (id: number) =>
    api
      .get<GoodsEntryFinalizePreview>(`/goods-entries/${id}/finalize-preview`)
      .then((r) => r.data),

  finalize: (id: number, dueDates: string[]) =>
    api.post<GoodsEntry>(`/goods-entries/${id}/finalize`, { dueDates }).then((r) => r.data),

  cancel: (id: number) => api.post<GoodsEntry>(`/goods-entries/${id}/cancel`).then((r) => r.data),
}
