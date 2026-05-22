import Company from '#models/company'

/**
 * Data access for companies (tenants). Every query excludes soft-deleted rows.
 */
export class CompanyRepository {
  /** Base query scoped to non-deleted companies. */
  query() {
    return Company.query().whereNull('deleted_at')
  }

  findById(id: number) {
    return this.query().where('id', id).first()
  }

  findBySlug(slug: string) {
    return this.query().where('slug', slug).first()
  }

  /** All companies a root user is allowed to enter (every active company). */
  listActive() {
    return this.query().where('is_active', true).orderBy('legal_name', 'asc')
  }
}

export default new CompanyRepository()
