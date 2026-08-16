import { HttpContext } from '@adonisjs/core/http'
import brandService from '#services/brand_service'
import { createBrandValidator, updateBrandValidator } from '#validators/brand_validators'

export default class BrandsController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return brandService.list(tenant, {
      id: request.input('id') ? Number(request.input('id')) : undefined,
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return brandService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createBrandValidator)
    const row = await brandService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateBrandValidator)
    return brandService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await brandService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
