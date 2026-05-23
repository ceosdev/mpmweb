import { HttpContext } from '@adonisjs/core/http'
import productGroupService from '#services/product_group_service'
import {
  createProductGroupValidator,
  updateProductGroupValidator,
} from '#validators/product_group_validators'

export default class ProductGroupsController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return productGroupService.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return productGroupService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createProductGroupValidator)
    const row = await productGroupService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateProductGroupValidator)
    return productGroupService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await productGroupService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
