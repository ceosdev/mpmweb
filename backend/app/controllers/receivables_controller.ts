import { HttpContext } from '@adonisjs/core/http'
import receivableService, { type ReceivableStatusFilter } from '#services/receivable_service'
import { RECEIVABLE_STATUSES } from '#models/receivable'
import {
  createReceivableValidator,
  updateReceivableValidator,
} from '#validators/receivable_validators'

const VALID_FILTERS: readonly string[] = [...RECEIVABLE_STATUSES, 'overdue']

/**
 * Status filter — **multiple choice**. Nothing selected means *all*. Accepts both
 * `?status=open` (string) and `?status=open,paid` (already split into an array by
 * the query-string parser). Unknown values are dropped rather than rejected.
 * `overdue` is accepted but is not a stored status: it is a date comparison.
 */
function parseStatuses(raw: unknown): ReceivableStatusFilter[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined

  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const statuses = parts
    .map((part) => String(part).trim())
    .filter((part) => VALID_FILTERS.includes(part)) as ReceivableStatusFilter[]

  return statuses.length > 0 ? statuses : undefined
}

export default class ReceivablesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return receivableService.list(tenant, {
      documentNumber: request.input('documentNumber') || undefined,
      customerId: request.input('customerId') ? Number(request.input('customerId')) : undefined,
      dueFrom: request.input('dueFrom') || undefined,
      dueTo: request.input('dueTo') || undefined,
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
    return receivableService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createReceivableValidator)
    const row = await receivableService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateReceivableValidator)
    return receivableService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await receivableService.destroy(tenant, Number(params.id))
    return response.noContent()
  }

  async cancel({ tenant, params }: HttpContext) {
    return receivableService.cancel(tenant, Number(params.id))
  }
}
