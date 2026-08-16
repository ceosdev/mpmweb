import { HttpContext } from '@adonisjs/core/http'
import serviceEntryService from '#services/service_entry_service'
import { SERVICE_ENTRY_STATUSES, type ServiceEntryStatus } from '#models/service_entry'
import {
  createServiceEntryValidator,
  updateServiceEntryValidator,
} from '#validators/service_entry_validators'

const VALID_STATUSES: readonly string[] = SERVICE_ENTRY_STATUSES

/**
 * Status filter — **multiple choice**. Nothing selected means *all*.
 *
 * Accepts both shapes: `?status=open` arrives as a string, while
 * `?status=open,finalized` is already split into an array by the query-string
 * parser (and axios sends the comma unescaped). Unknown values are dropped
 * rather than rejected — a stale bookmark should not 422.
 */
function parseStatuses(raw: unknown): ServiceEntryStatus[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined

  const parts = Array.isArray(raw) ? raw : String(raw).split(',')
  const statuses = parts
    .map((part) => String(part).trim())
    .filter((part) => VALID_STATUSES.includes(part)) as ServiceEntryStatus[]

  return statuses.length > 0 ? statuses : undefined
}

export default class ServiceEntriesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'
    return serviceEntryService.list(tenant, {
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
    return serviceEntryService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createServiceEntryValidator)
    const row = await serviceEntryService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateServiceEntryValidator)
    return serviceEntryService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await serviceEntryService.destroy(tenant, Number(params.id))
    return response.noContent()
  }

  async finalize({ tenant, params }: HttpContext) {
    return serviceEntryService.finalize(tenant, Number(params.id))
  }

  async cancel({ tenant, params }: HttpContext) {
    return serviceEntryService.cancel(tenant, Number(params.id))
  }
}
