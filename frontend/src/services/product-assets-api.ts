import { api } from '@/services/api-client'
import type { Paginated, ProductAsset, AssetSituation } from '@/types/api'

export interface ProductAssetListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  assetCode?: string
  description?: string
  situation?: AssetSituation
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateProductAssetPayload {
  description: string
  assetCode?: string | null
  brandId?: number | null
  brandModelId?: number | null
  manufactureYear?: string | null
  btu?: string | null
  situation?: AssetSituation
  equipmentExists?: boolean
  notes?: string | null
}

export type UpdateProductAssetPayload = Partial<CreateProductAssetPayload>

/**
 * Endpoints for assets are nested under their parent product:
 * `/api/products/:productId/assets`.
 */
export const productAssetsApi = {
  list: (productId: number, params: ProductAssetListParams) =>
    api
      .get<Paginated<ProductAsset>>(`/products/${productId}/assets`, { params })
      .then((r) => r.data),

  get: (productId: number, id: number) =>
    api.get<ProductAsset>(`/products/${productId}/assets/${id}`).then((r) => r.data),

  create: (productId: number, payload: CreateProductAssetPayload) =>
    api.post<ProductAsset>(`/products/${productId}/assets`, payload).then((r) => r.data),

  update: (productId: number, id: number, payload: UpdateProductAssetPayload) =>
    api.put<ProductAsset>(`/products/${productId}/assets/${id}`, payload).then((r) => r.data),

  remove: (productId: number, id: number) =>
    api.delete(`/products/${productId}/assets/${id}`).then(() => undefined),
}
