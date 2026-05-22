import User from '#models/user'

/**
 * Data access for platform users. Every query excludes soft-deleted rows.
 */
export class UserRepository {
  /** Base query scoped to non-deleted users. */
  query() {
    return User.query().whereNull('deleted_at')
  }

  findById(id: number) {
    return this.query().where('id', id).first()
  }

  /** Case-insensitive lookup — used by the auth flow. */
  findByEmail(email: string) {
    return this.query().whereRaw('lower(email) = ?', [email.toLowerCase()]).first()
  }
}

export default new UserRepository()
