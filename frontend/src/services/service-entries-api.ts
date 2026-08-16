import { api } from '@/services/api-client'
import type { Paginated, ServiceEntry, ServiceEntryListParams, ServiceEntryPayload } from '@/types/api'

export const serviceEntriesApi = {
  list: ({ statuses, ...params }: ServiceEntryListParams) =>
    api
      .get<Paginated<ServiceEntry>>('/service-entries', {
        params: {
          ...params,
          // Lista vazia = todas: o param some da querystring em vez de virar um
          // filtro vazio (que não devolveria nada).
          status: statuses?.length ? statuses.join(',') : undefined,
        },
      })
      .then((r) => r.data),

  get: (id: number) => api.get<ServiceEntry>(`/service-entries/${id}`).then((r) => r.data),

  create: (payload: ServiceEntryPayload) =>
    api.post<ServiceEntry>('/service-entries', payload).then((r) => r.data),

  update: (id: number, payload: ServiceEntryPayload) =>
    api.put<ServiceEntry>(`/service-entries/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/service-entries/${id}`).then(() => undefined),

  finalize: (id: number) =>
    api.post<ServiceEntry>(`/service-entries/${id}/finalize`).then((r) => r.data),

  cancel: (id: number) =>
    api.post<ServiceEntry>(`/service-entries/${id}/cancel`).then((r) => r.data),
}
