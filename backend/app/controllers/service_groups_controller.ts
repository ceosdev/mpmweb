import { HttpContext } from '@adonisjs/core/http'
import serviceGroupService from '#services/service_group_service'
import {
  createServiceGroupValidator,
  updateServiceGroupValidator,
} from '#validators/service_group_validators'

export default class ServiceGroupsController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return serviceGroupService.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return serviceGroupService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createServiceGroupValidator)
    const row = await serviceGroupService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateServiceGroupValidator)
    return serviceGroupService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await serviceGroupService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
