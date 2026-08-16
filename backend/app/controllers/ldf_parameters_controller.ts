import { HttpContext } from '@adonisjs/core/http'
import ldfParameterService from '#services/ldf_parameter_service'
import {
  createLdfParameterValidator,
  updateLdfParameterValidator,
} from '#validators/ldf_parameter_validators'

/** Query filters are user input — a non-numeric value just drops the filter. */
function parsePositiveInt(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) return undefined
  return value
}

export default class LdfParametersController {
  async index({ tenant, request }: HttpContext) {
    const order = request.input('order') === 'desc' ? 'desc' : 'asc'
    return ldfParameterService.list(tenant, {
      code: parsePositiveInt(request.input('code')),
      description: request.input('description') || undefined,
      expenseGroupId: parsePositiveInt(request.input('expenseGroupId')),
      page: request.input('page') ? Number(request.input('page')) : undefined,
      perPage: request.input('perPage') ? Number(request.input('perPage')) : undefined,
      sort: request.input('sort') || undefined,
      order,
    })
  }

  async show({ tenant, params }: HttpContext) {
    return ldfParameterService.show(tenant, Number(params.id))
  }

  async store({ tenant, request, response }: HttpContext) {
    const payload = await request.validateUsing(createLdfParameterValidator)
    const row = await ldfParameterService.create(tenant, payload)
    return response.created(row)
  }

  async update({ tenant, request, params }: HttpContext) {
    const payload = await request.validateUsing(updateLdfParameterValidator)
    return ldfParameterService.update(tenant, Number(params.id), payload)
  }

  async destroy({ tenant, params, response }: HttpContext) {
    await ldfParameterService.destroy(tenant, Number(params.id))
    return response.noContent()
  }
}
