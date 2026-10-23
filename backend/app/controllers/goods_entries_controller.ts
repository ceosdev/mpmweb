import { HttpContext } from '@adonisjs/core/http'
import goodsEntryService from '#services/goods_entry_service'
import { GOODS_ENTRY_STATUSES, type GoodsEntryStatus } from '#models/goods_entry'
import {
  createGoodsEntryValidator,
  finalizeGoodsEntryValidator,
  updateGoodsEntryValidator,
} from '#validators/goods_entry_validators'

const VALID_STATUSES: readonly string[] = GOODS_ENTRY_STATUSES

/**
 * Status filter — **multiple choice**. Nothing selected means *all*.
 *
 * Accepts both shapes: `?status=open` arrives as a string, while
 * `?status=open,finalized` is already split into an array by the query-string
 * parser. Unknown values are dropped rather than rejected — a stale bookmark
 * should not 422.
 */
function parseStatuses(raw: unknown): GoodsEntryStatus[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined

  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const statuses = parts
    .map((part) => String(part).trim())
    .filter((part) => VALID_STATUSES.includes(part)) as GoodsEntryStatus[]

  return statuses.length > 0 ? statuses : undefined
}

export default class GoodsEntriesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'
    return goodsEntryService.list(tenant, {
      id: request.input('id') ? Number(request.input('id')) : undefined,
      documentNumber: request.input('documentNumber') || undefined,
      supplierId: request.input('supplierId') ? Number(request.input('supplierId')) : undefined,
      operationFrom: request.input('operationFrom') || undefined,
      operationTo: request.input('operationTo') || undefined,
      issueFrom: request.input('issueFrom') || undefined,
      issueTo: request.input('issueTo') || undefined,
      statuses: parseStatuses(request.input('status')),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return goodsEntryService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createGoodsEntryValidator)
    const row = await goodsEntryService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateGoodsEntryValidator)
    return goodsEntryService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await goodsEntryService.destroy(tenant, Number(params.id))
    return response.noContent()
  }

  async finalizePreview({ tenant, params }: HttpContext) {
    return goodsEntryService.finalizePreview(tenant, Number(params.id))
  }

  async finalize({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(finalizeGoodsEntryValidator)
    return goodsEntryService.finalize(tenant, Number(params.id), payload.dueDates)
  }

  async cancel({ tenant, params }: HttpContext) {
    return goodsEntryService.cancel(tenant, Number(params.id))
  }
}
