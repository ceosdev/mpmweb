import { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import Permission from '#models/permission'

/**
 * Read-only RBAC catalog: roles and permissions. Consumed by the user form
 * (role dropdown, extra permissions selector) and the permissions screen.
 */
export default class CatalogController {
  async roles(_ctx: HttpContext) {
    return Role.query().preload('permissions').orderBy('id', 'asc')
  }

  async permissions(_ctx: HttpContext) {
    return Permission.query().orderBy('module', 'asc').orderBy('action', 'asc')
  }
}
