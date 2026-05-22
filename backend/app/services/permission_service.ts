import type User from '#models/user'
import type Company from '#models/company'
import Membership from '#models/membership'
import { TenantContext } from '#services/tenant_context'
import { WILDCARD } from '#abilities/catalog'

/**
 * Resolves the effective permissions of a user inside a given company.
 *
 * Permissions come from two sources, merged together:
 *  - the role bound to the membership (`role_permissions`)
 *  - the extra permissions granted to the membership (`membership_permissions`)
 *
 * Root users bypass everything with a wildcard permission.
 */
export class PermissionService {
  /**
   * Build the tenant context for a request. Returns `null` when a non-root
   * user has no active membership in the company (i.e. no access).
   */
  async buildContext(user: User, company: Company): Promise<TenantContext | null> {
    if (user.isRoot) {
      const membership = await Membership.query()
        .where('user_id', user.id)
        .where('company_id', company.id)
        .whereNull('deleted_at')
        .preload('role')
        .first()
      return new TenantContext(company, membership, new Set([WILDCARD]), true)
    }

    const membership = await Membership.query()
      .where('user_id', user.id)
      .where('company_id', company.id)
      .where('is_active', true)
      .whereNull('deleted_at')
      .preload('role', (roleQuery) => roleQuery.preload('permissions'))
      .preload('extraPermissions')
      .first()

    if (!membership) {
      return null
    }

    const permissions = new Set<string>()
    membership.role.permissions.forEach((permission) => permissions.add(permission.slug))
    membership.extraPermissions.forEach((permission) => permissions.add(permission.slug))

    return new TenantContext(company, membership, permissions, false)
  }
}

export default new PermissionService()
