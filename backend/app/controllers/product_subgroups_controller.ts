import { HttpContext } from '@adonisjs/core/http'
import productSubgroupService from '#services/product_subgroup_service'
import {
  createProductSubgroupValidator,
  updateProductSubgroupValidator,
} from '#validators/product_subgroup_validators'

/**
 * CRUD scoped to a parent product group (`/api/product-groups/:groupId/subgroups`).
 * `groupId` is always read from the path; clients cannot inject a parent via body.
 */
export default class ProductSubgroupsController {
  async index({ tenant, request, params }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return productSubgroupService.list(tenant, Number(params.groupId), {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return productSubgroupService.show(tenant, Number(params.groupId), Number(params.id))
  }

  async store({ tenant, request, params, response }: HttpContext) {
    const payload = await request.validateUsing(createProductSubgroupValidator)
    const row = await productSubgroupService.create(tenant, Number(params.groupId), payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateProductSubgroupValidator)
    return productSubgroupService.update(
      tenant,
      Number(params.groupId),
      Number(params.id),
      payload
    )
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await productSubgroupService.destroy(tenant, Number(params.groupId), Number(params.id))
    return response.noContent()
  }
}
