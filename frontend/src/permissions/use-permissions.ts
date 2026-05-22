import { useAuth } from '@/providers/auth-provider'
import { hasAllPermissions, hasAnyPermission, hasPermission } from '@/permissions/permissions'

/**
 * Permission helpers bound to the active company. Returns the resolved
 * permission set plus convenience checkers used across the UI.
 */
export function usePermissions() {
  const { tenant } = useAuth()
  const permissions = tenant?.permissions ?? []

  return {
    permissions,
    isRoot: tenant?.isRoot ?? false,
    role: tenant?.role ?? null,
    can: (permission: string) => hasPermission(permissions, permission),
    canAny: (required: string[]) => hasAnyPermission(permissions, required),
    canAll: (required: string[]) => hasAllPermissions(permissions, required),
  }
}
