import { queryDate, queryInt, queryPositiveInt } from '#utils/query_params'
import { HttpContext } from '@adonisjs/core/http'
import payableService, { type PayableStatusFilter } from '#services/payable_service'
import { PAYABLE_STATUSES } from '#models/payable'
import {
  createPayableValidator,
  updatePayableValidator,
} from '#validators/payable_validators'

const VALID_FILTERS: readonly string[] = [...PAYABLE_STATUSES, 'overdue']

/**
 * Status filter — **multiple choice**. Nothing selected means *all*.
 *
 * Accepts both shapes: `?status=open` arrives as a string, while
 * `?status=open,paid` is already split into an array by the query-string parser
 * (and axios sends the comma unescaped). Unknown values are dropped rather than
 * rejected — a stale bookmark should not 422.
 *
 * `overdue` is accepted but is not a stored status: it is a date comparison.
 */
function parseStatuses(raw: unknown): PayableStatusFilter[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined

  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const statuses = parts
    .map((part) => String(part).trim())
    .filter((part) => VALID_FILTERS.includes(part)) as PayableStatusFilter[]

  return statuses.length > 0 ? statuses : undefined
}

export default class PayablesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return payableService.list(tenant, {
      id: queryInt(request, 'id'),
      documentNumber: request.input('documentNumber') || undefined,
      supplierId: queryInt(request, 'supplierId'),
      dueFrom: queryDate(request, 'dueFrom'),
      dueTo: queryDate(request, 'dueTo'),
      issueFrom: queryDate(request, 'issueFrom'),
      issueTo: queryDate(request, 'issueTo'),
      statuses: parseStatuses(request.input('status')),
      page: queryPositiveInt(request, 'page'),
      perPage: queryPositiveInt(request, 'perPage'),
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return payableService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createPayableValidator)
    const row = await payableService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updatePayableValidator)
    return payableService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await payableService.destroy(tenant, Number(params.id))
    return response.noContent()
  }

  async cancel({ tenant, params }: HttpContext) {
    return payableService.cancel(tenant, Number(params.id))
  }
}
