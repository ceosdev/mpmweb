import { HttpContext } from '@adonisjs/core/http'
import Permission from '#models/permission'

/**
 * Read-only catalog endpoints. The roles listing moved to `RolesController`
 * (per-company) — this file is now just the permission catalog.
 */
export default class CatalogController {
  async permissions(_ctx: HttpContext) {
    return Permission.query().orderBy('module', 'asc').orderBy('action', 'asc')
  }
}
