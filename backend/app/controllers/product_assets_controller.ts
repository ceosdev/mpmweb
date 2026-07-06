import { HttpContext } from '@adonisjs/core/http'
import productAssetService from '#services/product_asset_service'
import type { AssetSituation } from '#models/product_asset'
import {
  createProductAssetValidator,
  updateProductAssetValidator,
} from '#validators/product_asset_validators'

function parseSituation(raw: unknown): AssetSituation | undefined {
  if (raw === 'available' || raw === 'allocated' || raw === 'sold') return raw
  return undefined
}

/**
 * CRUD scoped to a parent product (`/api/products/:productId/assets`).
 * `productId` is always read from the path; clients cannot inject a parent via
 * body. Only `fixed_asset` products may own assets (enforced in the service).
 */
export default class ProductAssetsController {
  async index({ tenant, request, params }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return productAssetService.list(tenant, Number(params.productId), {
      assetCode: request.input('assetCode') || undefined,
      description: request.input('description') || undefined,
      situation: parseSituation(request.input('situation')),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return productAssetService.show(tenant, Number(params.productId), Number(params.id))
  }

  async store({ tenant, request, params, response }: HttpContext) {
    const payload = await request.validateUsing(createProductAssetValidator)
    const row = await productAssetService.create(tenant, Number(params.productId), payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateProductAssetValidator)
    return productAssetService.update(
      tenant,
      Number(params.productId),
      Number(params.id),
      payload
    )
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await productAssetService.destroy(tenant, Number(params.productId), Number(params.id))
    return response.noContent()
  }
}
