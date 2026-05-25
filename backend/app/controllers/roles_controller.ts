import { HttpContext } from '@adonisjs/core/http'
import roleService from '#services/role_service'
import { createRoleValidator, updateRoleValidator } from '#validators/role_validators'

/**
 * CRUD for roles (per-company profiles). Always scoped by the active tenant;
 * the platform-level ROOT role is invisible to this controller — the
 * repository filters it out.
 */
export default class RolesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return roleService.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  /** Lite list for the user-form role dropdown. */
  async options({ tenant }: HttpContext) {
    return roleService.options(tenant)
  }

  async show({ tenant, params }: HttpContext) {
    return roleService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createRoleValidator)
    const row = await roleService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateRoleValidator)
    return roleService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await roleService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
