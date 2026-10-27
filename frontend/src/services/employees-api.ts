import { api } from '@/services/api-client'
import type { Employee, Paginated } from '@/types/api'

export interface EmployeeListParams {
  /** Busca exata pelo código (autoincremento). */
  id?: number
  name?: string
  taxId?: string
  status?: 'all' | 'active' | 'inactive'
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
}

/**
 * Optional fields go as `null` when empty: the backend treats `null` as
 * "clear it", so an edit can blank a field that was filled before.
 * Dates are ISO (`YYYY-MM-DD`).
 */
export interface EmployeePayload {
  name: string
  roleTitle: string | null
  birthDate: string | null
  taxId: string | null
  idNumber: string | null
  workCard: string | null
  pis: string | null
  driverLicense: string | null
  address: string | null
  addressNumber: string | null
  addressComplement: string | null
  neighborhood: string | null
  city: string | null
  zipCode: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  hiredAt: string | null
  terminatedAt: string | null
  isActive: boolean
}

export const employeesApi = {
  list: (params: EmployeeListParams) =>
    api.get<Paginated<Employee>>('/employees', { params }).then((r) => r.data),

  get: (id: number) => api.get<Employee>(`/employees/${id}`).then((r) => r.data),

  create: (payload: EmployeePayload) =>
    api.post<Employee>('/employees', payload).then((r) => r.data),

  update: (id: number, payload: EmployeePayload) =>
    api.put<Employee>(`/employees/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/employees/${id}`).then(() => undefined),
}
