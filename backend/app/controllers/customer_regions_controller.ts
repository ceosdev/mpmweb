import { queryInt, queryPositiveInt } from '#utils/query_params'
import { HttpContext } from '@adonisjs/core/http'
import customerRegionService from '#services/customer_region_service'
import {
  createCustomerRegionValidator,
  updateCustomerRegionValidator,
} from '#validators/customer_region_validators'

function parseStatus(raw: unknown): 'all' | 'active' | 'inactive' | undefined {
  if (raw === 'active' || raw === 'inactive' || raw === 'all') return raw
  return undefined
}

/**
 * CRUD scoped to a parent customer (`/api/customers/:customerId/regions`).
 * `customerId` is always read from the path; clients cannot inject a parent
 * via body.
 */
export default class CustomerRegionsController {
  async index({ tenant, request, params }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return customerRegionService.list(tenant, Number(params.customerId), {
      id: queryInt(request, 'id'),
      search: request.input('search'),
      status: parseStatus(request.input('status')),
      page: queryPositiveInt(request, 'page'),
      perPage: queryPositiveInt(request, 'perPage'),
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return customerRegionService.show(tenant, Number(params.customerId), Number(params.id))
  }

  async store({ tenant, request, params, response }: HttpContext) {
    const payload = await request.validateUsing(createCustomerRegionValidator)
    const row = await customerRegionService.create(tenant, Number(params.customerId), payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateCustomerRegionValidator)
    return customerRegionService.update(
      tenant,
      Number(params.customerId),
      Number(params.id),
      payload
    )
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await customerRegionService.destroy(tenant, Number(params.customerId), Number(params.id))
    return response.noContent()
  }
}
