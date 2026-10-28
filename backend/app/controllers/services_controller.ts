import { queryInt, queryPositiveInt } from '#utils/query_params'
import { HttpContext } from '@adonisjs/core/http'
import serviceService from '#services/service_service'
import type { ServiceType } from '#models/service'
import { createServiceValidator, updateServiceValidator } from '#validators/service_validators'

function parseType(raw: unknown): ServiceType | undefined {
  if (raw === 'internal' || raw === 'third_party') return raw
  return undefined
}

export default class ServicesController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return serviceService.list(tenant, {
      id: queryInt(request, 'id'),
      description: request.input('description') || undefined,
      type: parseType(request.input('type')),
      page: queryPositiveInt(request, 'page'),
      perPage: queryPositiveInt(request, 'perPage'),
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return serviceService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createServiceValidator)
    const row = await serviceService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateServiceValidator)
    return serviceService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await serviceService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
