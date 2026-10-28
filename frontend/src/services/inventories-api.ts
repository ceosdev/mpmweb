import { api } from '@/services/api-client'
import type {
  Inventory,
  InventoryClosePreview,
  InventoryItem,
  InventoryListMeta,
  InventoryListParams,
  InventoryOpenPayload,
} from '@/types/api'

export const inventoriesApi = {
  list: (params: InventoryListParams) =>
    api
      .get<{ data: Inventory[]; meta: InventoryListMeta }>('/inventories', { params })
      .then((r) => r.data),

  /** Contagem cega por default; `reveal` devolve estoque e diferença (fechado sempre revela). */
  get: (id: number, { reveal }: { reveal: boolean }) =>
    api
      .get<Inventory>(`/inventories/${id}`, { params: reveal ? { reveal: 1 } : undefined })
      .then((r) => r.data),

  open: (payload: InventoryOpenPayload) =>
    api.post<Inventory>('/inventories', payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/inventories/${id}`).then(() => undefined),

  /** `null` limpa a contagem do item ("não contado"). */
  updateItem: (id: number, itemId: number, countedQuantity: string | null) =>
    api
      .put<InventoryItem>(`/inventories/${id}/items/${itemId}`, { countedQuantity })
      .then((r) => r.data),

  resetCount: (id: number) =>
    api.post(`/inventories/${id}/reset-count`).then(() => undefined),

  closePreview: (id: number) =>
    api.get<InventoryClosePreview>(`/inventories/${id}/close-preview`).then((r) => r.data),

  close: (id: number) => api.post<Inventory>(`/inventories/${id}/close`).then((r) => r.data),

  /** Folha/relatório de contagem em PDF (blob). Use via `openPdf`. */
  countSheet: (id: number, { reveal }: { reveal: boolean }) =>
    api
      .get<Blob>(`/inventories/${id}/count-sheet`, {
        params: reveal ? { reveal: 1 } : undefined,
        responseType: 'blob',
      })
      .then((r) => r.data),
}
