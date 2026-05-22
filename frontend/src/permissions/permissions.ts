/**
 * Pure permission helpers. The frontend mirrors the exact same rules the
 * backend enforces: a root user holds the wildcard `*` and matches every
 * check. UI gating is a convenience — the API is always the source of truth.
 */
export const WILDCARD = '*'

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(WILDCARD) || permissions.includes(required)
}

export function hasAnyPermission(permissions: string[], required: string[]): boolean {
  return required.some((permission) => hasPermission(permissions, permission))
}

export function hasAllPermissions(permissions: string[], required: string[]): boolean {
  return required.every((permission) => hasPermission(permissions, permission))
}
