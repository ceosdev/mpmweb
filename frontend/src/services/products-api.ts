import { api } from '@/services/api-client'
import type { Paginated, Product, ProductType } from '@/types/api'

export interface ProductListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  description?: string
  productGroupId?: number
  type?: ProductType
  controlsStock?: boolean
  status?: 'all' | 'active' | 'inactive'
  lowStock?: boolean
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateProductPayload {
  description: string
  type: ProductType
  productGroupId?: number | null
  productSubgroupId?: number | null
  unitOfMeasureId?: number | null
  controlsStock?: boolean
  minimumStock?: number | null
  /** Set only on create — immutable afterwards. */
  quantityInStock?: number | null
  /** Cost price in reais. */
  costPrice?: number | null
  isActive?: boolean
}

/** Update omits `quantityInStock` — the balance is immutable after create. */
export type UpdateProductPayload = Omit<Partial<CreateProductPayload>, 'quantityInStock'>

export const productsApi = {
  list: (params: ProductListParams) =>
    api.get<Paginated<Product>>('/products', { params }).then((r) => r.data),

  get: (id: number) => api.get<Product>(`/products/${id}`).then((r) => r.data),

  create: (payload: CreateProductPayload) =>
    api.post<Product>('/products', payload).then((r) => r.data),

  update: (id: number, payload: UpdateProductPayload) =>
    api.put<Product>(`/products/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/products/${id}`).then(() => undefined),
}
