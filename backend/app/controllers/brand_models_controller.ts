import { queryInt, queryPositiveInt } from '#utils/query_params'
import { HttpContext } from '@adonisjs/core/http'
import brandModelService from '#services/brand_model_service'
import {
  createBrandModelValidator,
  updateBrandModelValidator,
} from '#validators/brand_model_validators'

/**
 * CRUD scoped to a parent brand (`/api/brands/:brandId/models`).
 * `brandId` is always read from the path; clients cannot inject a parent via body.
 */
export default class BrandModelsController {
  async index({ tenant, request, params }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return brandModelService.list(tenant, Number(params.brandId), {
      id: queryInt(request, 'id'),
      search: request.input('search'),
      page: queryPositiveInt(request, 'page'),
      perPage: queryPositiveInt(request, 'perPage'),
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return brandModelService.show(tenant, Number(params.brandId), Number(params.id))
  }

  async store({ tenant, request, params, response }: HttpContext) {
    const payload = await request.validateUsing(createBrandModelValidator)
    const row = await brandModelService.create(tenant, Number(params.brandId), payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateBrandModelValidator)
    return brandModelService.update(tenant, Number(params.brandId), Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await brandModelService.destroy(tenant, Number(params.brandId), Number(params.id))
    return response.noContent()
  }
}
