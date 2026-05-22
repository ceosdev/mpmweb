import { HttpContext } from '@adonisjs/core/http'
import paymentTypeService from '#services/payment_type_service'
import {
  createPaymentTypeValidator,
  updatePaymentTypeValidator,
} from '#validators/payment_type_validators'

/**
 * CRUD for payment types. Always scoped by the active tenant; permission
 * gates are applied at the route layer.
 */
export default class PaymentTypesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return paymentTypeService.list(tenant, {
      search: request.input('search'),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return paymentTypeService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createPaymentTypeValidator)
    const row = await paymentTypeService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updatePaymentTypeValidator)
    return paymentTypeService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await paymentTypeService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
