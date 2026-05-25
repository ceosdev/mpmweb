import { api } from '@/services/api-client'
import type { Company, ImportSourceCompany, Paginated } from '@/types/api'

export interface CompanyListParams {
  search?: string
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface CompanyFormData {
  legalName: string
  tradeName?: string
  taxId?: string
  stateRegistration?: string
  municipalRegistration?: string
  address?: string
  addressNumber?: string
  neighborhood?: string
  city?: string
  zipCode?: string
  state?: string
  phone?: string
  email?: string
  isActive?: boolean
}

export type CreateCompanyPayload = CompanyFormData
export type UpdateCompanyPayload = Partial<CompanyFormData>

export interface CompanyMutationInput<T> {
  data: T
  logo?: File | null
  removeLogo?: boolean
}

function buildFormData(input: CompanyMutationInput<Partial<CompanyFormData>>): FormData {
  const form = new FormData()
  const { data, logo, removeLogo } = input

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'boolean') {
      form.append(key, value ? 'true' : 'false')
    } else if (typeof value === 'string') {
      form.append(key, value)
    } else {
      form.append(key, String(value))
    }
  }

  if (logo) {
    form.append('logo', logo)
  }
  if (removeLogo) {
    form.append('removeLogo', 'true')
  }

  return form
}

/**
 * Companies endpoints. Create/update accept multipart/form-data so the logo
 * upload travels in the same request as the textual fields.
 */
export const companiesApi = {
  list: (params: CompanyListParams) =>
    api.get<Paginated<Company>>('/companies', { params }).then((r) => r.data),

  get: (id: number) => api.get<Company>(`/companies/${id}`).then((r) => r.data),

  create: (input: CompanyMutationInput<CreateCompanyPayload>) =>
    api.post<Company>('/companies', buildFormData(input)).then((r) => r.data),

  update: (id: number, input: CompanyMutationInput<UpdateCompanyPayload>) =>
    api.put<Company>(`/companies/${id}`, buildFormData(input)).then((r) => r.data),

  remove: (id: number) => api.delete(`/companies/${id}`).then(() => undefined),

  importSources: () =>
    api.get<ImportSourceCompany[]>('/companies/import-sources').then((r) => r.data),
}
