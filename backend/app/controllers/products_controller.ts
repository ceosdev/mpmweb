import { HttpContext } from '@adonisjs/core/http'
import productService from '#services/product_service'
import type { ProductType } from '#models/product'
import { createProductValidator, updateProductValidator } from '#validators/product_validators'

function parseType(raw: unknown): ProductType | undefined {
  if (raw === 'consumable' || raw === 'fixed_asset') return raw
  return undefined
}

function parseStatus(raw: unknown): 'all' | 'active' | 'inactive' | undefined {
  if (raw === 'all' || raw === 'active' || raw === 'inactive') return raw
  return undefined
}

function parseBool(raw: unknown): boolean | undefined {
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return undefined
}

export default class ProductsController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return productService.list(tenant, {
      id: request.input('id') ? Number(request.input('id')) : undefined,
      description: request.input('description') || undefined,
      productGroupId: request.input('productGroupId')
        ? Number(request.input('productGroupId'))
        : undefined,
      type: parseType(request.input('type')),
      controlsStock: parseBool(request.input('controlsStock')),
      status: parseStatus(request.input('status')),
      lowStock: parseBool(request.input('lowStock')) ?? false,
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return productService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createProductValidator)
    const row = await productService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateProductValidator)
    return productService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await productService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
