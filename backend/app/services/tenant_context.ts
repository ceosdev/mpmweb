import type Company from '#models/company'
import type Membership from '#models/membership'
import { WILDCARD } from '#abilities/catalog'

/**
 * The resolved access context for a request: which company is active, which
 * membership the user holds there and the effective permission set. It is
 * attached to `HttpContext.tenant` by the tenant middleware.
 */
export class TenantContext {
  constructor(
    public company: Company,
    public membership: Membership | null,
    public permissions: Set<string>,
    public isRoot: boolean
  ) {}

  /**
   * The role slug active in this company. Root users have no membership
   * requirement, so they always resolve to `root`.
   */
  get roleSlug(): string | null {
    if (this.isRoot) return 'root'
    return this.membership?.role?.slug ?? null
  }

  /**
   * True when the request is allowed to perform `permission`. Root users
   * (wildcard) match everything.
   */
  can(permission: string): boolean {
    return this.permissions.has(WILDCARD) || this.permissions.has(permission)
  }

  /**
   * Serializable snapshot sent to the frontend so it can build menus and
   * gate UI elements with the exact same permission set.
   */
  toJSON() {
    return {
      companyId: this.company.id,
      company: {
        id: this.company.id,
        legalName: this.company.legalName,
        tradeName: this.company.tradeName,
        slug: this.company.slug,
      },
      role: this.roleSlug,
      isRoot: this.isRoot,
      permissions: [...this.permissions],
    }
  }
}
