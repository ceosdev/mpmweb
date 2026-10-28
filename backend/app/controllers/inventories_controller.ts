import { HttpContext } from '@adonisjs/core/http'
import inventoryService from '#services/inventory_service'
import { openInventoryValidator, updateItemValidator } from '#validators/inventory_validators'

export default class InventoriesController {
  async index({ tenant, request }: HttpContext) {
    const status = request.input('status')
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'
    return inventoryService.list(tenant, {
      openingFrom: request.input('openingFrom') || undefined,
      openingTo: request.input('openingTo') || undefined,
      status: status === 'open' || status === 'closed' ? status : undefined,
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params, request }: HttpContext) {
    const reveal = request.input('reveal') === '1'
    return inventoryService.show(tenant, Number(params.id), { reveal })
  }

  async store({ tenant, request, response, currentUser }: HttpContext) {
    const payload = await request.validateUsing(openInventoryValidator)
    const row = await inventoryService.open(tenant, currentUser, payload)
    return response.created(row)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await inventoryService.destroy(tenant, Number(params.id))
    return response.noContent()
  }

  async updateItem({ tenant, params, request }: HttpContext) {
    const { countedQuantity } = await request.validateUsing(updateItemValidator)
    return inventoryService.updateItem(
      tenant,
      Number(params.id),
      Number(params.itemId),
      countedQuantity
    )
  }

  async resetCount({ tenant, params, response }: HttpContext) {
    await inventoryService.resetCount(tenant, Number(params.id))
    return response.noContent()
  }

  async closePreview({ tenant, params }: HttpContext) {
    return inventoryService.closePreview(tenant, Number(params.id))
  }

  async close({ tenant, params, currentUser }: HttpContext) {
    return inventoryService.close(tenant, currentUser, Number(params.id))
  }
}
