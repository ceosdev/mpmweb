import type User from '#models/user'
import type { TenantContext } from '#services/tenant_context'

/**
 * Ambient augmentation of the AdonisJS HttpContext. These properties are
 * populated by middleware and consumed by controllers:
 *  - `currentUser` is set by the `auth` middleware
 *  - `tenant` is set by the `tenant` middleware
 */
declare module '@adonisjs/core/http' {
  interface HttpContext {
    currentUser: User
    tenant: TenantContext
  }
}
