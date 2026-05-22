import { HttpContext } from '@adonisjs/core/http'

/**
 * Returns the resolved access context for the active company: the role and
 * the effective permission set. The frontend uses this to build the dynamic
 * menu and gate buttons/actions.
 */
export default class MeController {
  async context({ currentUser, tenant }: HttpContext) {
    return {
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        isRoot: currentUser.isRoot,
      },
      tenant: tenant.toJSON(),
    }
  }
}
