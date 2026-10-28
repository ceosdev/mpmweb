import { queryDate, queryInt, queryPositiveInt } from '#utils/query_params'
import { HttpContext } from '@adonisjs/core/http'
import goodsExitService from '#services/goods_exit_service'
import { GOODS_EXIT_STATUSES, type GoodsExitStatus } from '#models/goods_exit'
import {
  createGoodsExitValidator,
  finalizeGoodsExitValidator,
  updateGoodsExitValidator,
} from '#validators/goods_exit_validators'

const VALID_STATUSES: readonly string[] = GOODS_EXIT_STATUSES

/**
 * Status filter — **multiple choice**; nothing selected means *all*. Accepts
 * `?status=open` (string) and `?status=open,finalized` (array). Unknown values
 * are dropped rather than rejected.
 */
function parseStatuses(raw: unknown): GoodsExitStatus[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined

  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const statuses = parts
    .map((part) => String(part).trim())
    .filter((part) => VALID_STATUSES.includes(part)) as GoodsExitStatus[]

  return statuses.length > 0 ? statuses : undefined
}

export default class GoodsExitsController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'
    const exitType = request.input('exitType')
    return goodsExitService.list(tenant, {
      id: queryInt(request, 'id'),
      consumer: request.input('consumer') || undefined,
      exitType: exitType === 'normal' || exitType === 'tool' ? exitType : undefined,
      operationFrom: queryDate(request, 'operationFrom'),
      operationTo: queryDate(request, 'operationTo'),
      statuses: parseStatuses(request.input('status')),
      page: queryPositiveInt(request, 'page'),
      perPage: queryPositiveInt(request, 'perPage'),
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return goodsExitService.show(tenant, Number(params.id))
  }

  async protocol({ tenant, params, response }: HttpContext) {
    const id = Number(params.id)
    const pdf = await goodsExitService.protocol(tenant, id)
    response.header('content-type', 'application/pdf')
    response.header('content-disposition', `inline; filename="saida-${id}.pdf"`)
    return response.send(pdf)
  }

  async store({ tenant, request, response, currentUser }: HttpContext) {
    const payload = await request.validateUsing(createGoodsExitValidator)
    const row = await goodsExitService.create(tenant, payload, currentUser.id)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateGoodsExitValidator)
    return goodsExitService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await goodsExitService.destroy(tenant, Number(params.id))
    return response.noContent()
  }

  async finalizePreview({ tenant, params }: HttpContext) {
    return goodsExitService.finalizePreview(tenant, Number(params.id))
  }

  async finalize({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(finalizeGoodsExitValidator)
    return goodsExitService.finalize(tenant, Number(params.id), payload.items)
  }

  async deliver({ tenant, params }: HttpContext) {
    return goodsExitService.deliver(tenant, Number(params.id))
  }

  async returnTools({ tenant, params }: HttpContext) {
    return goodsExitService.returnTools(tenant, Number(params.id))
  }
}
