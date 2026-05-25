import { HttpContext } from '@adonisjs/core/http'
import userService from '#services/user_service'
import {
  createUserValidator,
  importUserValidator,
  updateUserValidator,
} from '#validators/user_validators'

/**
 * CRUD for users of the active company. Every route is gated by a
 * `users.*` permission in the router. The active company comes from
 * `ctx.tenant`, so data is always tenant-scoped.
 */
export default class UsersController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return userService.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return userService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator)
    const user = await userService.create(tenant, payload)
    return response.created(user)
  }

  async update({ tenant, request, currentUser, params }: HttpContext) {
    const payload = await request.validateUsing(updateUserValidator)
    return userService.update(tenant, Number(params.id), payload, currentUser.id)
  }

  async destroy({ tenant, currentUser, params, response }: HttpContext) {
    await userService.destroy(tenant, Number(params.id), currentUser.id)
    return response.noContent()
  }

  /**
   * Lists users from another company that can be imported into the active
   * one. Requires `users.import` on the active tenant.
   */
  async importable({ tenant, request }: HttpContext) {
    const companyId = Number(request.input('companyId'))
    if (!Number.isInteger(companyId) || companyId <= 0) {
      return []
    }
    const search = request.input('search') || undefined
    return userService.listImportable(tenant, companyId, search)
  }

  /**
   * Imports an existing platform user into the active company (new membership).
   * Requires `users.import` on the active tenant.
   */
  async import({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(importUserValidator)
    const user = await userService.importExisting(tenant, payload)
    return response.created(user)
  }
}
