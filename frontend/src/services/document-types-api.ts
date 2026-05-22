import { api } from '@/services/api-client'
import type { Paginated, DocumentType } from '@/types/api'

export interface DocumentTypeListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CreateDocumentTypePayload {
  description: string
  isActive?: boolean
}

export interface UpdateDocumentTypePayload {
  description?: string
  isActive?: boolean
}

export const documentTypesApi = {
  list: (params: DocumentTypeListParams) =>
    api.get<Paginated<DocumentType>>('/document-types', { params }).then((r) => r.data),

  get: (id: number) => api.get<DocumentType>(`/document-types/${id}`).then((r) => r.data),

  create: (payload: CreateDocumentTypePayload) =>
    api.post<DocumentType>('/document-types', payload).then((r) => r.data),

  update: (id: number, payload: UpdateDocumentTypePayload) =>
    api.put<DocumentType>(`/document-types/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/document-types/${id}`).then(() => undefined),
}
