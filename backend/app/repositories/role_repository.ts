import Role from '#models/role'

/**
 * Data access for roles. The CRUD layer only operates on roles bound to a
 * specific company — the global ROOT role (`company_id IS NULL`,
 * `is_system = true`) is never returned by these queries.
 */
export class RoleRepository {
  /** Base query for the manageable roles of a single company. */
  query(companyId: number) {
    return Role.query().where('company_id', companyId).where('is_system', false)
  }

  findById(companyId: number, id: number) {
    return this.query(companyId).where('id', id).first()
  }

  /** Loads a role with its permissions preloaded — used for show/edit. */
  findByIdWithPermissions(companyId: number, id: number) {
    return this.query(companyId).preload('permissions').where('id', id).first()
  }

  /** Active manageable roles for the company; consumed by user-form selects. */
  options(companyId: number) {
    return Role.query()
      .where('company_id', companyId)
      .where('is_system', false)
      .where('is_active', true)
      .orderBy('name', 'asc')
  }
}

export default new RoleRepository()
