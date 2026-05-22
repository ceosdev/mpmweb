import { api } from '@/services/api-client'
import type { Permission, Role } from '@/types/api'

/**
 * RBAC catalog endpoints — roles and permissions.
 */
export const catalogApi = {
  roles: () => api.get<Role[]>('/roles').then((r) => r.data),
  permissions: () => api.get<Permission[]>('/permissions').then((r) => r.data),
}
