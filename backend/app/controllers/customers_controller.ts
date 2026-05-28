import { HttpContext } from '@adonisjs/core/http'
import customerService from '#services/customer_service'
import type { CustomerType } from '#models/customer'
import {
  createCustomerValidator,
  updateCustomerValidator,
} from '#validators/customer_validators'

function parseType(raw: unknown): CustomerType | undefined {
  if (raw === 'individual' || raw === 'company') return raw
  return undefined
}

function parseStatus(raw: unknown): 'all' | 'active' | 'inactive' | undefined {
  if (raw === 'active' || raw === 'inactive' || raw === 'all') return raw
  return undefined
}

export default class CustomersController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return customerService.list(tenant, {
      name: request.input('name') || undefined,
      taxId: request.input('taxId') || undefined,
      type: parseType(request.input('type')),
      status: parseStatus(request.input('status')),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return customerService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createCustomerValidator)
    const row = await customerService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateCustomerValidator)
    return customerService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await customerService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
