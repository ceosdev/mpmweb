import { queryInt, queryPositiveInt } from '#utils/query_params'
import { HttpContext } from '@adonisjs/core/http'
import customerUnitService from '#services/customer_unit_service'
import {
  createCustomerUnitValidator,
  updateCustomerUnitValidator,
} from '#validators/customer_unit_validators'

function parseStatus(raw: unknown): 'all' | 'active' | 'inactive' | undefined {
  if (raw === 'active' || raw === 'inactive' || raw === 'all') return raw
  return undefined
}

/**
 * CRUD scoped to a parent region
 * (`/api/customers/:customerId/regions/:regionId/units`).
 * Both parent ids are always read from the path; clients cannot inject a
 * parent via body.
 */
export default class CustomerUnitsController {
  async index({ tenant, request, params }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return customerUnitService.list(tenant, Number(params.customerId), Number(params.regionId), {
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
    return customerUnitService.show(
      tenant,
      Number(params.customerId),
      Number(params.regionId),
      Number(params.id)
    )
  }

  async store({ tenant, request, params, response }: HttpContext) {
    const payload = await request.validateUsing(createCustomerUnitValidator)
    const row = await customerUnitService.create(
      tenant,
      Number(params.customerId),
      Number(params.regionId),
      payload
    )
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateCustomerUnitValidator)
    return customerUnitService.update(
      tenant,
      Number(params.customerId),
      Number(params.regionId),
      Number(params.id),
      payload
    )
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await customerUnitService.destroy(
      tenant,
      Number(params.customerId),
      Number(params.regionId),
      Number(params.id)
    )
    return response.noContent()
  }
}
