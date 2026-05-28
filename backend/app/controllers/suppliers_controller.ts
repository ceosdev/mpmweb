import { HttpContext } from '@adonisjs/core/http'
import supplierService from '#services/supplier_service'
import type { SupplierType } from '#models/supplier'
import {
  createSupplierValidator,
  updateSupplierValidator,
} from '#validators/supplier_validators'

function parseType(raw: unknown): SupplierType | undefined {
  if (raw === 'goods' || raw === 'service') return raw
  return undefined
}

function parseStatus(raw: unknown): 'all' | 'active' | 'inactive' | undefined {
  if (raw === 'active' || raw === 'inactive' || raw === 'all') return raw
  return undefined
}

export default class SuppliersController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return supplierService.list(tenant, {
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
    return supplierService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createSupplierValidator)
    const row = await supplierService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateSupplierValidator)
    return supplierService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await supplierService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
