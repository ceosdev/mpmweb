import { api } from '@/services/api-client'
import type { Permission, Role } from '@/types/api'

/**
 * RBAC catalog endpoints — roles options (manageable roles of the active
 * company) and the full permission catalog.
 */
export const catalogApi = {
  roles: () => api.get<Role[]>('/roles/options').then((r) => r.data),
  permissions: () => api.get<Permission[]>('/permissions').then((r) => r.data),
}
