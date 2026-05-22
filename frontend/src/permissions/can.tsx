import type { ReactNode } from 'react'
import { usePermissions } from '@/permissions/use-permissions'

interface CanProps {
  /** A single permission slug, or a list (any match grants access). */
  permission: string | string[]
  children: ReactNode
  /** Rendered when the permission is missing. Defaults to nothing. */
  fallback?: ReactNode
}

/**
 * Conditionally renders children based on the active company's permissions.
 *
 *   <Can permission="users.create"><Button>Novo</Button></Can>
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can, canAny } = usePermissions()
  const allowed = Array.isArray(permission) ? canAny(permission) : can(permission)
  return <>{allowed ? children : fallback}</>
}
