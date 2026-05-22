import Membership from '#models/membership'

/**
 * Data access for memberships (the link between a user and a company).
 * Every query excludes soft-deleted rows.
 */
export class MembershipRepository {
  /** Base query scoped to non-deleted memberships. */
  query() {
    return Membership.query().whereNull('deleted_at')
  }

  /** The membership of a user in a specific company, if any. */
  findMembership(userId: number, companyId: number) {
    return this.query().where('user_id', userId).where('company_id', companyId).first()
  }

  /** Active memberships of a user, with company and role preloaded. */
  listByUser(userId: number) {
    return this.query()
      .where('user_id', userId)
      .where('is_active', true)
      .preload('company')
      .preload('role')
  }
}

export default new MembershipRepository()
